import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { createHash } from "crypto";
import { checkDatabaseHealth, db } from "./db";
import { 
  materials, halls, stations, stands, boxes, taskEvents, tasks, warehouseContainers, users, departments, taskSchedules,
  scanEvents, activityLogs,
  assertAutomotiveTransition, getAutomotiveTimestampFieldForStatus,
  type Material, type Hall, type Station, type Stand, type Box, type TaskEvent, type TaskSchedule
} from "@shared/schema";
import { eq, and, desc, notInArray, isNull, gte, lte, sql, inArray, count, sum, avg, or, ilike } from "drizzle-orm";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if the request has a valid user ID
 * Note: In production, this should verify a session token
 * For now, we check x-user-id header or userId in body
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"] as string || req.body?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ error: "Invalid user" });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Account is deactivated" });
  }

  // Attach user to request for downstream handlers
  (req as any).authUser = user;
  next();
}

/**
 * Middleware to check if the authenticated user has admin role
 * Must be used after requireAuth
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).authUser;
  
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const role = user.role?.toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

// Normalize user role to lowercase for frontend consistency
function normalizeUserRole<T extends { role?: string }>(user: T): T {
  return {
    ...user,
    role: user.role?.toLowerCase() || "driver",
  };
}

// Helper to prepare user for API response (without password, with normalized role)
function prepareUserResponse<T extends { password?: string; role?: string }>(user: T): Omit<T, "password"> {
  const { password, ...userWithoutPassword } = user;
  return normalizeUserRole(userWithoutPassword);
}

// ============================================================================
// BERLIN TIMEZONE HELPERS (Europe/Berlin)
// ============================================================================

function getTodayBerlin(): Date {
  const berlinDateStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' });
  const berlinDate = new Date(berlinDateStr);
  berlinDate.setHours(0, 0, 0, 0);
  return berlinDate;
}

function formatDateBerlin(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}

// ============================================================================
// AUDIT EVENT HELPER
// ============================================================================

interface AuditEventParams {
  taskId: string;
  actorUserId?: string;
  actorRole?: string;
  actorDepartmentId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  beforeData?: any;
  afterData?: any;
  metaJson?: {
    stationId?: string;
    hallId?: string;
    standId?: string;
    boxId?: string;
    materialId?: string;
    containerId?: string;
    qrType?: string;
    source?: string;
    [key: string]: any;
  };
}

/**
 * Creates a comprehensive audit event in the taskEvents table
 * Automatically fetches actor's role and departmentId if actorUserId is provided
 */
async function createAuditEvent({
  taskId,
  actorUserId,
  actorRole,
  actorDepartmentId,
  action,
  entityType,
  entityId,
  beforeData,
  afterData,
  metaJson
}: AuditEventParams): Promise<void> {
  try {
    let finalActorRole = actorRole;
    let finalActorDepartmentId = actorDepartmentId;

    // If actorUserId is provided but role/department are not, fetch from user
    if (actorUserId && (!actorRole || !actorDepartmentId)) {
      const user = await storage.getUser(actorUserId);
      if (user) {
        if (!finalActorRole) {
          finalActorRole = user.role || undefined;
        }
        if (!finalActorDepartmentId) {
          finalActorDepartmentId = user.departmentId || undefined;
        }
      }
    }

    await db.insert(taskEvents).values({
      taskId,
      actorUserId: actorUserId || null,
      actorRole: finalActorRole || null,
      actorDepartmentId: finalActorDepartmentId || null,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      beforeData: beforeData || null,
      afterData: afterData || null,
      metaJson: metaJson || null,
    });
  } catch (error) {
    console.error("[AuditEvent] Failed to create audit event:", error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Helper to build metaJson context from stand/station/hall hierarchy
 */
async function buildStandContextMeta(standId: string): Promise<{
  standId: string;
  stationId?: string;
  hallId?: string;
  materialId?: string;
}> {
  const meta: any = { standId };
  
  try {
    const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
    if (stand) {
      if (stand.materialId) meta.materialId = stand.materialId;
      if (stand.stationId) {
        meta.stationId = stand.stationId;
        const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
        if (station?.hallId) {
          meta.hallId = station.hallId;
        }
      }
    }
  } catch (error) {
    console.error("[AuditEvent] Failed to build stand context:", error);
  }
  
  return meta;
}

// ============================================================================
// CLAIM TTL HELPER
// ============================================================================

const CLAIM_TTL_MINUTES = 30;

function isClaimExpired(claimedAt: Date | null): boolean {
  if (!claimedAt) return true;
  const now = new Date();
  const expiry = new Date(claimedAt.getTime() + CLAIM_TTL_MINUTES * 60 * 1000);
  return now > expiry;
}

// ============================================================================
// DAILY TASK SCHEDULER
// ============================================================================

async function generateDailyTasksScheduled() {
  try {
    console.log("[DailyTaskScheduler] Running scheduled task generation...");
    const today = getTodayBerlin();
    const todayStr = formatDateBerlin(new Date());
    
    // Cancel previous OPEN daily tasks from earlier dates
    const openDailyTasks = await db.select().from(tasks).where(
      and(eq(tasks.taskType, "DAILY_FULL"), eq(tasks.status, "OPEN"))
    );
    let cancelledCount = 0;
    for (const task of openDailyTasks) {
      if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
        const beforeStatus = task.status;
        await db.update(tasks).set({
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Auto-cancelled: New daily task generated",
          updatedAt: new Date()
        }).where(eq(tasks.id, task.id));
        
        // Audit log for auto-cancellation
        const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};
        await createAuditEvent({
          taskId: task.id,
          action: "STATUS_CHANGED",
          entityType: "task",
          entityId: task.id,
          beforeData: { status: beforeStatus },
          afterData: { status: "CANCELLED", reason: "Auto-cancelled: New daily task generated" },
          metaJson: {
            ...standMeta,
            boxId: task.boxId || undefined,
            source: "DAILY_SCHEDULER",
          },
        });
        
        cancelledCount++;
      }
    }
    if (cancelledCount > 0) {
      console.log(`[DailyTaskScheduler] Auto-cancelled ${cancelledCount} previous OPEN daily tasks.`);
    }
    
    // Get dailyFull stands
    const dailyFullStands = await db.select().from(stands).where(
      and(eq(stands.dailyFull, true), eq(stands.isActive, true))
    );
    
    let createdCount = 0;
    let skippedCount = 0;
    for (const stand of dailyFullStands) {
      const dedupKey = `DAILY:${stand.id}:${todayStr}`;
      try {
        const [newTask] = await db.insert(tasks).values({
          title: `Tägliche Abholung - Stand ${stand.identifier}`,
          description: `Automatisch generierte tägliche Abholung`,
          containerID: null,
          boxId: null,
          standId: stand.id,
          materialType: stand.materialId || null,
          taskType: "DAILY_FULL",
          status: "OPEN",
          priority: "normal",
          scheduledFor: today,
          dedupKey,
        }).returning();
        
        await db.update(stands).set({
          lastDailyTaskGeneratedAt: new Date(),
          updatedAt: new Date()
        }).where(eq(stands.id, stand.id));
        
        // Audit log for daily task creation
        const standMeta = await buildStandContextMeta(stand.id);
        await createAuditEvent({
          taskId: newTask.id,
          action: "TASK_CREATED",
          entityType: "task",
          entityId: newTask.id,
          beforeData: null,
          afterData: { status: "OPEN", taskType: "DAILY_FULL", standId: stand.id },
          metaJson: {
            ...standMeta,
            source: "DAILY",
          },
        });
        
        createdCount++;
      } catch (e: any) {
        if (e?.code === '23505') {
          skippedCount++;
          continue;
        }
        console.error(`[DailyTaskScheduler] Failed to create task for stand ${stand.id}:`, e);
      }
    }
    console.log(`[DailyTaskScheduler] Completed. Created: ${createdCount}, Skipped (duplicates): ${skippedCount}`);
  } catch (error) {
    console.error("[DailyTaskScheduler] Error:", error);
  }
}

// ============================================================================
// FLEXIBLE TASK SCHEDULER
// Generates tasks based on TaskSchedule rules (DAILY, WEEKLY, INTERVAL)
// ============================================================================

/**
 * Get date in specific timezone as a Date object with time set to midnight local
 */
function getDateInTimezone(date: Date, timezone: string): Date {
  const dateStr = date.toLocaleString('en-US', { timeZone: timezone });
  const localDate = new Date(dateStr);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
}

/**
 * Format date as YYYY-MM-DD in specified timezone
 */
function formatDateInTimezone(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

/**
 * Get day of week (1=Monday, 7=Sunday) in specified timezone
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const dateStr = date.toLocaleString('en-US', { timeZone: timezone });
  const localDate = new Date(dateStr);
  const day = localDate.getDay();
  return day === 0 ? 7 : day; // Convert Sunday from 0 to 7
}

/**
 * Calculate days between two dates (ignoring time)
 */
function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a task should be generated for a specific date based on schedule rule
 */
function shouldGenerateForDate(
  schedule: TaskSchedule,
  targetDate: Date,
  timezone: string
): boolean {
  const { ruleType, weekdays, everyNDays, startDate } = schedule;

  switch (ruleType) {
    case 'DAILY':
      return true;

    case 'WEEKLY':
      if (!weekdays || !Array.isArray(weekdays) || weekdays.length === 0) {
        return false;
      }
      const dayOfWeek = getDayOfWeekInTimezone(targetDate, timezone);
      return weekdays.includes(dayOfWeek);

    case 'INTERVAL':
      if (!everyNDays || everyNDays < 1 || !startDate) {
        return false;
      }
      const days = daysBetween(startDate, targetDate);
      return days >= 0 && days % everyNDays === 0;

    default:
      return false;
  }
}

/**
 * Main flexible scheduler function
 * Runs through all active schedules and generates tasks for upcoming days
 */
async function generateFlexibleScheduledTasks() {
  try {
    console.log("[FlexibleScheduler] Running scheduled task generation...");
    
    // Get all active schedules
    const activeSchedules = await db.select()
      .from(taskSchedules)
      .where(eq(taskSchedules.isActive, true));
    
    if (activeSchedules.length === 0) {
      console.log("[FlexibleScheduler] No active schedules found.");
      return;
    }
    
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const schedule of activeSchedules) {
      const timezone = schedule.timezone || 'Europe/Berlin';
      const createDaysAhead = schedule.createDaysAhead || 7;
      
      // Get stand info for task creation
      const [stand] = await db.select().from(stands).where(eq(stands.id, schedule.standId));
      if (!stand || !stand.isActive) {
        console.log(`[FlexibleScheduler] Stand ${schedule.standId} not found or inactive, skipping schedule ${schedule.id}`);
        continue;
      }
      
      // Generate tasks for today + createDaysAhead days
      const now = new Date();
      for (let dayOffset = 0; dayOffset <= createDaysAhead; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + dayOffset);
        
        // Check if this date should have a task based on rule type
        if (!shouldGenerateForDate(schedule, targetDate, timezone)) {
          continue;
        }
        
        const dateStr = formatDateInTimezone(targetDate, timezone);
        const dedupKey = `SCHED:${schedule.id}:${dateStr}`;
        
        // Create scheduled date at the specified time
        const [hours, minutes] = (schedule.timeLocal || '06:00').split(':').map(Number);
        const scheduledFor = getDateInTimezone(targetDate, timezone);
        scheduledFor.setHours(hours || 6, minutes || 0, 0, 0);
        
        try {
          const [newTask] = await db.insert(tasks).values({
            title: `${schedule.name} - Stand ${stand.identifier}`,
            description: `Automatisch generiert durch Zeitplan: ${schedule.name}`,
            containerID: null,
            boxId: null,
            standId: stand.id,
            materialType: stand.materialId || null,
            taskType: "DAILY_FULL",
            source: "SCHEDULED",
            scheduleId: schedule.id,
            status: "OPEN",
            priority: "normal",
            scheduledFor,
            dedupKey,
          }).returning();
          
          // Audit log for task creation
          const standMeta = await buildStandContextMeta(stand.id);
          await createAuditEvent({
            taskId: newTask.id,
            action: "TASK_CREATED",
            entityType: "task",
            entityId: newTask.id,
            beforeData: null,
            afterData: { 
              status: "OPEN", 
              taskType: "DAILY_FULL", 
              source: "SCHEDULED",
              scheduleId: schedule.id,
              standId: stand.id,
              scheduledFor: scheduledFor.toISOString(),
            },
            metaJson: {
              ...standMeta,
              source: "FLEXIBLE_SCHEDULER",
              ruleType: schedule.ruleType,
            },
          });
          
          totalCreated++;
        } catch (e: any) {
          if (e?.code === '23505') {
            // Duplicate key - task already exists for this schedule+date
            totalSkipped++;
            continue;
          }
          console.error(`[FlexibleScheduler] Failed to create task for schedule ${schedule.id}, date ${dateStr}:`, e);
          totalErrors++;
        }
      }
    }
    
    console.log(`[FlexibleScheduler] Completed. Created: ${totalCreated}, Skipped (duplicates): ${totalSkipped}, Errors: ${totalErrors}`);
  } catch (error) {
    console.error("[FlexibleScheduler] Error:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Quick ping endpoint - no database, instant response for connectivity testing
  app.get("/api/debug/ping", (req, res) => {
    res.json({ 
      pong: true, 
      timestamp: new Date().toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL,
        requestId: (req as any).requestId,
      }
    });
  });

  // Health check endpoint - verifies backend is running and database is connected
  // Used for monitoring and validating Supabase/PostgreSQL connectivity
  app.head("/api/health", async (_req, res) => {
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.connected) {
      return res.status(200).end();
    }
    return res.status(503).end();
  });

  app.get("/api/health", async (req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      
      if (dbHealth.connected) {
        res.status(200).json({ 
          status: "ok", 
          database: "connected",
          timestamp: new Date().toISOString() 
        });
      } else {
        res.status(503).json({ 
          status: "degraded", 
          database: "disconnected",
          error: dbHealth.error,
          timestamp: new Date().toISOString() 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        database: "unknown",
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString() 
      });
    }
  });

  app.get("/api/auth/replit", (req, res) => {
    const userId = req.headers["x-replit-user-id"];
    const userName = req.headers["x-replit-user-name"];
    const userRoles = req.headers["x-replit-user-roles"];

    if (!userId || !userName) {
      return res.status(401).json({ 
        error: "Not authenticated with Replit",
        authenticated: false 
      });
    }

    res.json({
      authenticated: true,
      replitUser: {
        id: userId as string,
        name: userName as string,
        roles: userRoles ? (userRoles as string).split(",") : [],
      }
    });
  });

  app.post("/api/auth/replit/login", async (req, res) => {
    try {
      const userId = req.headers["x-replit-user-id"];
      const userName = req.headers["x-replit-user-name"];

      if (!userId || !userName) {
        return res.status(401).json({ error: "Not authenticated with Replit" });
      }

      const replitId = `replit-${userId}`;
      const replitEmail = `${userName}@replit.user`;

      let user = await storage.getUserByEmail(replitEmail);

      if (!user) {
        const existingUsers = await storage.getUsers();
        const isFirstUser = existingUsers.length === 0;

        user = await storage.createUser({
          email: replitEmail,
          password: hashPassword(`replit-${userId}-${Date.now()}`),
          name: userName as string,
          role: isFirstUser ? "admin" : "driver",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }

      res.json({ user: prepareUserResponse(user) });
    } catch (error) {
      console.error("Replit auth error:", error);
      res.status(500).json({ error: "Replit login failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }

      res.json({ user: prepareUserResponse(user) });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map((user) => prepareUserResponse(user));
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(prepareUserResponse(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Admin-only: Create new user
  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "Email already exists" });
      }

      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: role || "driver",
      });

      res.status(201).json(prepareUserResponse(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(prepareUserResponse(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ============================================================================
  // DEPARTMENTS
  // ============================================================================

  app.get("/api/departments", async (req, res) => {
    try {
      const departmentList = await storage.getDepartments();
      res.json(departmentList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.get("/api/departments/:id", async (req, res) => {
    try {
      const department = await storage.getDepartment(req.params.id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  app.post("/api/departments", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }

      const department = await storage.createDepartment({
        name,
        code,
        description: description || null,
      });

      res.status(201).json(department);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "Department code already exists" });
      }
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const department = await storage.updateDepartment(req.params.id, req.body);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "Department code already exists" });
      }
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteDepartment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json({ success: true, message: "Department deactivated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // ============================================================================
  // TASK SCHEDULES - Flexible scheduling for automated task generation
  // ============================================================================

  app.get("/api/admin/schedules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schedulesList = await db.select({
        schedule: taskSchedules,
        stand: stands,
        station: stations,
      })
        .from(taskSchedules)
        .leftJoin(stands, eq(taskSchedules.standId, stands.id))
        .leftJoin(stations, eq(taskSchedules.stationId, stations.id))
        .orderBy(desc(taskSchedules.createdAt));

      const result = schedulesList.map(row => ({
        ...row.schedule,
        stand: row.stand,
        station: row.station,
      }));

      res.json(result);
    } catch (error) {
      console.error("[Schedules] Failed to fetch schedules:", error);
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  app.get("/api/admin/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [schedule] = await db.select({
        schedule: taskSchedules,
        stand: stands,
        station: stations,
      })
        .from(taskSchedules)
        .leftJoin(stands, eq(taskSchedules.standId, stands.id))
        .leftJoin(stations, eq(taskSchedules.stationId, stations.id))
        .where(eq(taskSchedules.id, req.params.id));

      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      res.json({
        ...schedule.schedule,
        stand: schedule.stand,
        station: schedule.station,
      });
    } catch (error) {
      console.error("[Schedules] Failed to fetch schedule:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/admin/schedules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { name, standId, stationId, ruleType, timeLocal, weekdays, everyNDays, startDate, timezone, createDaysAhead } = req.body;

      if (!name || !standId || !ruleType || !timeLocal) {
        return res.status(400).json({ error: "Name, standId, ruleType, and timeLocal are required" });
      }

      if (!["DAILY", "WEEKLY", "INTERVAL"].includes(ruleType)) {
        return res.status(400).json({ error: "ruleType must be DAILY, WEEKLY, or INTERVAL" });
      }

      if (ruleType === "WEEKLY" && (!weekdays || !Array.isArray(weekdays) || weekdays.length === 0)) {
        return res.status(400).json({ error: "weekdays is required for WEEKLY rule type" });
      }

      if (ruleType === "INTERVAL" && (!everyNDays || everyNDays < 1)) {
        return res.status(400).json({ error: "everyNDays (>=1) is required for INTERVAL rule type" });
      }

      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const resolvedStationId = stationId || stand.stationId;

      const [newSchedule] = await db.insert(taskSchedules).values({
        name,
        standId,
        stationId: resolvedStationId,
        ruleType,
        timeLocal,
        weekdays: ruleType === "WEEKLY" ? weekdays : null,
        everyNDays: ruleType === "INTERVAL" ? everyNDays : null,
        startDate: ruleType === "INTERVAL" && startDate ? new Date(startDate) : null,
        timezone: timezone || "Europe/Berlin",
        createDaysAhead: createDaysAhead ?? 7,
        createdById: authUser.id,
        isActive: true,
      }).returning();

      res.status(201).json(newSchedule);
    } catch (error) {
      console.error("[Schedules] Failed to create schedule:", error);
      res.status(500).json({ error: "Failed to create schedule" });
    }
  });

  app.patch("/api/admin/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, standId, stationId, ruleType, timeLocal, weekdays, everyNDays, startDate, timezone, createDaysAhead, isActive } = req.body;

      const [existing] = await db.select().from(taskSchedules).where(eq(taskSchedules.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      const finalRuleType = ruleType ?? existing.ruleType;

      if (ruleType && !["DAILY", "WEEKLY", "INTERVAL"].includes(ruleType)) {
        return res.status(400).json({ error: "ruleType must be DAILY, WEEKLY, or INTERVAL" });
      }

      const updateData: Partial<typeof taskSchedules.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (standId !== undefined) updateData.standId = standId;
      if (stationId !== undefined) updateData.stationId = stationId;
      if (ruleType !== undefined) updateData.ruleType = ruleType;
      if (timeLocal !== undefined) updateData.timeLocal = timeLocal;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (createDaysAhead !== undefined) updateData.createDaysAhead = createDaysAhead;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (finalRuleType === "WEEKLY") {
        if (weekdays !== undefined) updateData.weekdays = weekdays;
        updateData.everyNDays = null;
        updateData.startDate = null;
      } else if (finalRuleType === "INTERVAL") {
        if (everyNDays !== undefined) updateData.everyNDays = everyNDays;
        if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
        updateData.weekdays = null;
      } else if (finalRuleType === "DAILY") {
        updateData.weekdays = null;
        updateData.everyNDays = null;
        updateData.startDate = null;
      }

      const [updated] = await db.update(taskSchedules)
        .set(updateData)
        .where(eq(taskSchedules.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("[Schedules] Failed to update schedule:", error);
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/admin/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const [existing] = await db.select().from(taskSchedules).where(eq(taskSchedules.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      await db.update(taskSchedules)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(taskSchedules.id, id));

      res.json({ success: true, message: "Schedule deactivated" });
    } catch (error) {
      console.error("[Schedules] Failed to delete schedule:", error);
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  app.post("/api/admin/schedules/:id/run", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const authUser = (req as any).authUser;

      const [schedule] = await db.select({
        schedule: taskSchedules,
        stand: stands,
      })
        .from(taskSchedules)
        .leftJoin(stands, eq(taskSchedules.standId, stands.id))
        .where(eq(taskSchedules.id, id));

      if (!schedule || !schedule.schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      if (!schedule.schedule.isActive) {
        return res.status(400).json({ error: "Cannot run inactive schedule" });
      }

      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(new Date());
      const dedupKey = `SCHED:${schedule.schedule.id}:${todayStr}`;

      const [existingTask] = await db.select().from(tasks).where(eq(tasks.dedupKey, dedupKey));
      if (existingTask) {
        return res.status(409).json({ 
          error: "Task already exists for this schedule today",
          existingTaskId: existingTask.id 
        });
      }

      const standIdentifier = schedule.stand?.identifier || "Unknown";
      const [newTask] = await db.insert(tasks).values({
        title: `${schedule.schedule.name} - Stand ${standIdentifier}`,
        description: `Manuell ausgelöst von ${authUser.name}`,
        containerID: schedule.schedule.standId,
        standId: schedule.schedule.standId,
        materialType: schedule.stand?.materialId || null,
        taskType: "MANUAL",
        source: "SCHEDULED",
        scheduleId: schedule.schedule.id,
        status: "OPEN",
        priority: "normal",
        scheduledFor: today,
        dedupKey,
        createdBy: authUser.id,
      }).returning();

      const standMeta = await buildStandContextMeta(schedule.schedule.standId);
      await createAuditEvent({
        taskId: newTask.id,
        actorUserId: authUser.id,
        action: "TASK_CREATED",
        entityType: "task",
        entityId: newTask.id,
        beforeData: null,
        afterData: { status: "OPEN", taskType: "MANUAL", source: "SCHEDULED", scheduleId: schedule.schedule.id },
        metaJson: {
          ...standMeta,
          source: "MANUAL_TRIGGER",
        },
      });

      res.status(201).json(newTask);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: "Task already exists for this schedule today" });
      }
      console.error("[Schedules] Failed to run schedule:", error);
      res.status(500).json({ error: "Failed to run schedule" });
    }
  });

  // ============================================================================
  // SCHEDULE PREVIEW ENDPOINT
  // Returns upcoming task dates based on schedule rules
  // ============================================================================

  app.get("/api/admin/schedules/:id/preview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const days = Math.min(parseInt(req.query.days as string) || 14, 90); // Max 90 days

      const [schedule] = await db.select().from(taskSchedules).where(eq(taskSchedules.id, id));
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      const timezone = schedule.timezone || 'Europe/Berlin';
      const now = new Date();
      const previewDates: { date: string; scheduledTime: string; dayOfWeek: number }[] = [];

      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + dayOffset);

        // For INTERVAL rules with future startDate, skip dates before start
        if (schedule.ruleType === 'INTERVAL' && schedule.startDate) {
          const startDateLocal = getDateInTimezone(schedule.startDate, timezone);
          const targetDateLocal = getDateInTimezone(targetDate, timezone);
          if (targetDateLocal < startDateLocal) {
            continue;
          }
        }

        if (shouldGenerateForDate(schedule, targetDate, timezone)) {
          const dateStr = formatDateInTimezone(targetDate, timezone);
          const [hours, minutes] = (schedule.timeLocal || '06:00').split(':').map(Number);
          const scheduledTime = `${String(hours || 6).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
          const dayOfWeek = getDayOfWeekInTimezone(targetDate, timezone);

          previewDates.push({
            date: dateStr,
            scheduledTime,
            dayOfWeek,
          });
        }
      }

      res.json({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        ruleType: schedule.ruleType,
        previewDays: days,
        dates: previewDates,
      });
    } catch (error) {
      console.error("[Schedules] Failed to generate preview:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // ============================================================================
  // MANUAL TASK CREATION
  // Create ad-hoc tasks not tied to schedules
  // ============================================================================

  app.post("/api/admin/tasks", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, standId, description, priority, scheduledFor, hallId, stationId } = req.body;
      const authUser = (req as any).authUser;

      const isAutomotivePayload = !!(hallId || stationId);

      // Automotive/manual flow for halls/stations/stands (used by mobile manual task screen)
      if (isAutomotivePayload) {
        if (!hallId || !stationId || !standId) {
          return res
            .status(400)
            .json({ error: "hallId, stationId, and standId are required" });
        }

        const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
        if (!station) {
          return res.status(404).json({ error: "Station not found" });
        }
        if (station.hallId !== hallId) {
          return res.status(400).json({ error: "Station does not belong to the specified hall" });
        }

        const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
        if (!stand) {
          return res.status(404).json({ error: "Stand not found" });
        }
        if (stand.stationId !== stationId) {
          return res.status(400).json({ error: "Stand does not belong to the specified station" });
        }
        if (!stand.isActive) {
          return res.status(400).json({ error: "Stand is not active" });
        }

        // Check for existing OPEN tasks for this stand (warning only - still allow creation)
        const [existingOpenTask] = await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.standId, standId), eq(tasks.status, "OPEN")));
        if (existingOpenTask) {
          console.log(
            `[ManualTask] Warning: Creating new task for stand ${standId} which already has an OPEN task ${existingOpenTask.id}`,
          );
        }

        const parsedDate = scheduledFor ? new Date(scheduledFor) : null;
        if (scheduledFor && (!parsedDate || isNaN(parsedDate.getTime()))) {
          return res.status(400).json({ error: "Invalid scheduledFor date format" });
        }

        const [newTask] = await db
          .insert(tasks)
          .values({
            title: title || `Manuelle Aufgabe - Stand ${stand.identifier}`,
            description: description ?? null,
            status: "OPEN",
            source: "MANUAL",
            taskType: "AUTOMOTIVE",
            standId,
            materialType: stand.materialId,
            scheduledFor: parsedDate,
            dedupKey: null,
            scheduleId: null,
            priority: priority || "normal",
          })
          .returning();

        await createAuditEvent({
          taskId: newTask.id,
          actorUserId: authUser?.id,
          action: "TASK_CREATED",
          entityType: "task",
          entityId: newTask.id,
          afterData: newTask,
          metaJson: {
            hallId,
            stationId,
            standId,
            materialId: stand.materialId || undefined,
            source: "MANUAL",
          },
        });

        console.log(`[Admin] Manual task created: ${newTask.id} for stand ${stand.identifier}`);
        return res.status(201).json(newTask);
      }

      if (!title || !standId) {
        return res.status(400).json({ error: "Title and standId are required" });
      }

      // Verify stand exists (legacy manual task flow)
      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }

      // Validate and parse scheduledFor (accepts any valid date string including ISO with timezone)
      let scheduledDate = new Date();
      if (scheduledFor) {
        const parsedDate = new Date(scheduledFor);
        if (!parsedDate || isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid scheduledFor date format" });
        }
        scheduledDate = parsedDate;
      }

      // Build stable dedup key using crypto hash for true idempotency
      const dateStr = formatDateBerlin(scheduledDate);
      const dedupSource = `${title}|${standId}|${dateStr}`;
      const dedupHash = createHash("sha256").update(dedupSource).digest("hex").substring(0, 16);
      const dedupKey = `MANUAL:${dedupHash}`;

      const [newTask] = await db
        .insert(tasks)
        .values({
          title,
          description: description || null,
          containerID: standId,
          standId,
          materialType: stand.materialId || null,
          taskType: "MANUAL",
          source: "MANUAL",
          status: "OPEN",
          priority: priority || "normal",
          scheduledFor: scheduledDate,
          dedupKey,
          createdBy: authUser.id,
        })
        .returning();

      // Audit log
      const standMeta = await buildStandContextMeta(standId);
      await createAuditEvent({
        taskId: newTask.id,
        actorUserId: authUser.id,
        action: "TASK_CREATED",
        entityType: "task",
        entityId: newTask.id,
        beforeData: null,
        afterData: { status: "OPEN", taskType: "MANUAL", source: "MANUAL", standId },
        metaJson: {
          ...standMeta,
          source: "MANUAL_CREATION",
        },
      });

      res.status(201).json(newTask);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: "A task with this title already exists for this stand and date" });
      }
      console.error("[Tasks] Failed to create manual task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // ============================================================================
  // WAREHOUSE CONTAINER EMPTY ENDPOINT
  // Mark a warehouse container as emptied
  // ============================================================================

  app.post("/api/warehouse-containers/:id/empty", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const authUser = (req as any).authUser;

      const [container] = await db.select().from(warehouseContainers).where(eq(warehouseContainers.id, id));
      if (!container) {
        return res.status(404).json({ error: "Warehouse container not found" });
      }

      const beforeData = {
        currentAmount: container.currentAmount,
        isFull: container.isFull,
        lastEmptied: container.lastEmptied,
      };

      const [updated] = await db.update(warehouseContainers)
        .set({
          currentAmount: 0,
          isFull: false,
          lastEmptied: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(warehouseContainers.id, id))
        .returning();

      // Create activity log
      await storage.createActivityLog({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_EMPTIED",
        description: `Warehouse container ${container.location} emptied`,
        userId: authUser.id,
        warehouseContainerId: container.id,
        metaData: {
          containerId: container.id,
          previousAmount: beforeData.currentAmount,
          location: container.location,
          materialType: container.materialType,
        },
      });

      res.json({
        success: true,
        container: updated,
        previousAmount: beforeData.currentAmount,
      });
    } catch (error) {
      console.error("[WarehouseContainers] Failed to empty container:", error);
      res.status(500).json({ error: "Failed to empty container" });
    }
  });

  // ============================================================================
  // CUSTOMERS (LEGACY - Original waste container management)
  // These routes support the original customer-based container workflow.
  // The app now primarily uses the Automotive Factory workflow.
  // Kept for backwards compatibility with existing data.
  // ============================================================================

  app.get("/api/customers", async (req, res) => {
    try {
      const customerList = await storage.getCustomers();
      res.json(customerList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Admin-only: Create new customer
  app.post("/api/customers", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, address, contactName, contactPhone, contactEmail, notes } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Customer name is required" });
      }

      const customer = await storage.createCustomer({
        name,
        address: address || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        notes: notes || null,
        isActive: true,
      });

      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // ============================================================================
  // CUSTOMER CONTAINERS (LEGACY - Original waste container management)
  // These routes support customer-site containers from the original workflow.
  // The app now primarily uses Boxes/Stands in the Automotive Factory workflow.
  // Kept for backwards compatibility with existing data.
  // ============================================================================

  app.get("/api/containers/customer", async (req, res) => {
    try {
      const containers = await storage.getCustomerContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer containers" });
    }
  });

  app.get("/api/containers/customer/:id", async (req, res) => {
    try {
      const container = await storage.getCustomerContainer(req.params.id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  app.get("/api/containers/customer/qr/:qrCode", async (req, res) => {
    try {
      // First try by QR code, then by container ID
      let container = await storage.getCustomerContainerByQR(req.params.qrCode);
      if (!container) {
        container = await storage.getCustomerContainer(req.params.qrCode);
      }
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  // Admin-only: Create customer container
  app.post("/api/containers/customer", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id, ...rest } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: "Container ID is required" });
      }
      
      // Generate stable QR code based on container type and ID (never changes)
      const stableQrCode = `customer-${id}`;
      
      const container = await storage.createCustomerContainer({
        id,
        ...rest,
        qrCode: stableQrCode, // Always use stable QR code
      });
      res.status(201).json(container);
    } catch (error) {
      console.error("Error creating customer container:", error);
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  app.patch("/api/containers/customer/:id", async (req, res) => {
    try {
      // IMPORTANT: Never allow qrCode to be changed via regular update
      // QR codes must remain stable - use regenerate endpoint for explicit changes
      const { qrCode, ...updateData } = req.body;
      
      const container = await storage.updateCustomerContainer(req.params.id, updateData);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to update container" });
    }
  });

  // Admin-only: Regenerate QR code for customer container
  app.post("/api/containers/customer/:id/regenerate-qr", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      const existingContainer = await storage.getCustomerContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }

      const oldQrCode = existingContainer.qrCode;
      // Generate new stable QR code with timestamp suffix for uniqueness
      const newQrCode = `customer-${req.params.id}-${Date.now()}`;
      
      const container = await storage.updateCustomerContainer(req.params.id, {
        qrCode: newQrCode,
      });

      if (!container) {
        return res.status(500).json({ error: "Failed to regenerate QR code" });
      }

      // Log this significant action
      await storage.createActivityLog({
        type: "SYSTEM_EVENT",
        action: "SYSTEM_EVENT",
        message: `QR-Code für Container ${req.params.id} wurde neu generiert. Bitte neuen Code ausdrucken und am Container anbringen.`,
        userId: userId || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: `Alter QR-Code: ${oldQrCode}`,
        metadata: { oldQrCode, newQrCode, action: "QR_CODE_REGENERATED" },
      });

      res.json(container);
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });

  // ============================================================================
  // WAREHOUSE CONTAINERS
  // ============================================================================

  app.get("/api/containers/warehouse", async (req, res) => {
    try {
      const containers = await storage.getWarehouseContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch warehouse containers" });
    }
  });

  app.get("/api/containers/warehouse/:id", async (req, res) => {
    try {
      const container = await storage.getWarehouseContainer(req.params.id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  app.get("/api/containers/warehouse/qr/:qrCode", async (req, res) => {
    try {
      // First try by QR code, then by container ID
      let container = await storage.getWarehouseContainerByQR(req.params.qrCode);
      if (!container) {
        container = await storage.getWarehouseContainer(req.params.qrCode);
      }
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  // Admin-only: Create warehouse container
  app.post("/api/containers/warehouse", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id, ...rest } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: "Container ID is required" });
      }
      
      // Generate stable QR code based on container type and ID (never changes)
      const stableQrCode = `warehouse-${id}`;
      
      const container = await storage.createWarehouseContainer({
        id,
        ...rest,
        qrCode: stableQrCode, // Always use stable QR code
      });
      res.status(201).json(container);
    } catch (error) {
      console.error("Error creating warehouse container:", error);
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  app.patch("/api/containers/warehouse/:id", async (req, res) => {
    try {
      // IMPORTANT: Never allow qrCode to be changed via regular update
      // QR codes must remain stable - use regenerate endpoint for explicit changes
      const { qrCode, ...updateData } = req.body;
      
      const container = await storage.updateWarehouseContainer(req.params.id, updateData);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      console.error("Error updating warehouse container:", error);
      res.status(500).json({ error: "Failed to update container", details: String(error) });
    }
  });

  // Admin-only: Regenerate QR code for warehouse container
  app.post("/api/containers/warehouse/:id/regenerate-qr", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      const existingContainer = await storage.getWarehouseContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }

      const oldQrCode = existingContainer.qrCode;
      // Generate new stable QR code with timestamp suffix for uniqueness
      const newQrCode = `warehouse-${req.params.id}-${Date.now()}`;
      
      const container = await storage.updateWarehouseContainer(req.params.id, {
        qrCode: newQrCode,
      });

      if (!container) {
        return res.status(500).json({ error: "Failed to regenerate QR code" });
      }

      // Log this significant action
      await storage.createActivityLog({
        type: "SYSTEM_EVENT",
        action: "SYSTEM_EVENT",
        message: `QR-Code für Container ${req.params.id} wurde neu generiert. Bitte neuen Code ausdrucken und am Container anbringen.`,
        userId: userId || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: `Alter QR-Code: ${oldQrCode}`,
        metadata: { oldQrCode, newQrCode, action: "QR_CODE_REGENERATED" },
      });

      res.json(container);
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });

  // Reset/Empty warehouse container - sets current amount to 0 (Admin and Driver)
  app.post("/api/containers/warehouse/:id/reset", requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      const authUser = (req as any).authUser;
      
      // Both admin and driver roles are allowed (normalize to lowercase for comparison)
      const userRole = authUser?.role?.toLowerCase();
      if (!authUser || (userRole !== "admin" && userRole !== "driver")) {
        return res.status(403).json({ error: "Only admin or driver roles can empty containers" });
      }
      
      const existingContainer = await storage.getWarehouseContainer(req.params.id);
      
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }

      // Check if container is already empty
      if (existingContainer.currentAmount === 0) {
        return res.json({ 
          message: "Container is already empty",
          container: existingContainer
        });
      }

      const previousAmount = existingContainer.currentAmount;
      const container = await storage.updateWarehouseContainer(req.params.id, {
        currentAmount: 0,
        lastEmptied: new Date(),
      });

      if (!container) {
        return res.status(500).json({ error: "Failed to reset container" });
      }

      // Record in fill history that container was emptied
      await storage.createFillHistory({
        warehouseContainerId: req.params.id,
        amountAdded: -previousAmount,
        quantityUnit: existingContainer.quantityUnit,
        taskId: null,
        recordedByUserId: authUser?.id || null,
      });

      const roleLabel = userRole === "admin" ? "Admin" : "Fahrer";
      await storage.createActivityLog({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_STATUS_CHANGED",
        message: `Lagercontainer ${req.params.id} wurde von ${roleLabel} ${authUser?.name || 'Unbekannt'} geleert (${previousAmount} ${existingContainer.quantityUnit} entfernt)`,
        userId: authUser?.id || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: reason || null,
        metadata: { previousAmount, reason, action: "CONTAINER_EMPTIED", role: authUser.role },
      });

      res.json({ 
        message: "Container successfully emptied",
        container 
      });
    } catch (error) {
      console.error("Error resetting warehouse container:", error);
      res.status(500).json({ error: "Failed to reset container" });
    }
  });

  app.get("/api/containers/warehouse/:id/history", async (req, res) => {
    try {
      const history = await storage.getFillHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fill history" });
    }
  });

  // ============================================================================
  // TASKS
  // ============================================================================

  // Get tasks with role-based filtering:
  // - ADMIN: sees all tasks (default: open tasks, can filter by status)
  // - DRIVER: sees only their own tasks
  app.get("/api/tasks", async (req, res) => {
    try {
      const { assignedTo, status, date, showAll } = req.query;
      const userId = req.headers["x-user-id"] as string || req.query.userId as string;
      
      // Get user to determine role
      let userRole = "DRIVER"; // Default to driver if no user
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          userRole = user.role?.toUpperCase() || "DRIVER";
        }
      }

      const filters: { assignedTo?: string; status?: string; date?: Date } = {};
      
      // Role-based filtering
      if (userRole === "ADMIN") {
        // Admin sees all tasks, can optionally filter
        if (assignedTo) filters.assignedTo = assignedTo as string;
        // By default, show open tasks (non-completed, non-cancelled) unless showAll is true
        if (status) {
          filters.status = status as string;
        }
      } else {
        // Driver only sees their own tasks
        if (userId) {
          filters.assignedTo = userId;
        } else if (assignedTo) {
          filters.assignedTo = assignedTo as string;
        }
        if (status) filters.status = status as string;
      }
      
      if (date) filters.date = new Date(date as string);

      let taskList = await storage.getTasks(Object.keys(filters).length > 0 ? filters : undefined);
      
      // For admin without specific status filter and not showAll, filter out completed/cancelled
      if (userRole === "ADMIN" && !status && showAll !== "true") {
        const FINAL_STATUSES = ["COMPLETED", "CANCELLED"];
        taskList = taskList.filter(t => !FINAL_STATUSES.includes(t.status));
      }
      
      res.json(taskList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Admin-only: Create new task
  // IMPORTANT: All new tasks start with status = OFFEN (open)
  // The client status value is ignored to ensure consistency
  // Pull-based model: assignedTo is null by default (drivers claim tasks)
  app.post("/api/tasks", requireAuth, requireAdmin, async (req, res) => {
    try {
      // Get container to derive materialType if not provided
      let materialType = req.body.materialType;
      if (!materialType && req.body.containerID) {
        const container = await storage.getCustomerContainer(req.body.containerID);
        if (container) {
          materialType = container.materialType || "";
        }
      }
      // Ensure materialType is never null (database constraint)
      materialType = materialType || "";

      // Convert date strings to Date objects for timestamp columns
      // Force status = OFFEN for all new tasks (ignore client value)
      // Force assignedTo = null for pull-based task claiming
      const taskData: Record<string, any> = {
        ...req.body,
        materialType, // Use derived or provided materialType
        status: "OFFEN", // Always start with OFFEN - never trust client status
        assignedTo: null, // Pull-based: no pre-assignment, drivers claim tasks
        claimedByUserId: null, // Not claimed yet
        claimedAt: null, // Not claimed yet
      };

      // Handle scheduledTime conversion
      if (taskData.scheduledTime) {
        const parsedDate = new Date(taskData.scheduledTime);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid scheduledTime format" });
        }
        taskData.scheduledTime = parsedDate;
      }

      // Handle other timestamp fields that might be passed as strings
      const timestampFields = ['assignedAt', 'acceptedAt', 'pickedUpAt', 'inTransitAt', 
                               'deliveredAt', 'completedAt', 'cancelledAt', 'pickupTimestamp', 'deliveryTimestamp'];
      for (const field of timestampFields) {
        if (taskData[field]) {
          const parsedDate = new Date(taskData[field]);
          if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: `Invalid ${field} format` });
          }
          taskData[field] = parsedDate;
        }
      }

      // Capacity validation: if deliveryContainerID is specified, check remaining capacity
      if (taskData.deliveryContainerID && taskData.plannedQuantity) {
        const targetContainer = await storage.getWarehouseContainer(taskData.deliveryContainerID);
        if (!targetContainer) {
          return res.status(400).json({ error: "Zielcontainer nicht gefunden" });
        }

        const remainingCapacity = targetContainer.maxCapacity - targetContainer.currentAmount;
        if (taskData.plannedQuantity > remainingCapacity) {
          return res.status(400).json({ 
            error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
            remainingCapacity,
            requestedAmount: taskData.plannedQuantity,
            unit: targetContainer.quantityUnit
          });
        }
      }

      const task = await storage.createTask(taskData as any);
      
      await storage.createActivityLog({
        type: "TASK_CREATED",
        action: "TASK_CREATED",
        message: `Auftrag erstellt für Container ${task.containerID}`,
        userId: req.body.createdBy || null,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: new Date(),
        details: null,
        metadata: null,
        location: null,
        scanEventId: null,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create task:", error);
      res.status(500).json({ error: "Failed to create task", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Admin-only: Delete a task
  // Removes the task and unlinks related scan events, activity logs, and fill history
  app.delete("/api/tasks/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const taskId = req.params.id;
      
      // Get task info before deletion for logging
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      // Delete the task (storage layer handles related data)
      const deleted = await storage.deleteTask(taskId);
      
      if (!deleted) {
        return res.status(500).json({ error: "Fehler beim Löschen des Auftrags" });
      }

      // Create activity log for the deletion (with null taskId since task is deleted)
      await storage.createActivityLog({
        type: "TASK_DELETED",
        action: "TASK_DELETED",
        message: `Auftrag ${taskId} wurde von Admin ${authUser?.name || 'Unbekannt'} gelöscht`,
        userId: authUser?.id || null,
        taskId: null, // Task no longer exists
        containerId: task.containerID,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: `Status vor Löschung: ${task.status}`,
        metadata: { 
          deletedTaskId: taskId,
          taskStatus: task.status,
          containerId: task.containerID,
          assignedTo: task.assignedTo
        },
      });

      res.json({ message: "Auftrag erfolgreich gelöscht" });
    } catch (error) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Fehler beim Löschen des Auftrags" });
    }
  });

  app.post("/api/tasks/:id/assign", async (req, res) => {
    try {
      const { userId, assignedBy } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "ASSIGNED", userId);
      if (!updatedTask) {
        return res.status(400).json({ error: "Invalid status transition" });
      }

      const driver = await storage.getUser(userId);
      const driverName = driver?.name || "Unbekannt";

      await storage.createActivityLog({
        type: "TASK_ASSIGNED",
        action: "TASK_ASSIGNED",
        message: `Auftrag ${task.id} wurde Fahrer ${driverName} zugewiesen`,
        userId: assignedBy || null,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: new Date(),
        details: null,
        metadata: null,
        location: null,
        scanEventId: null,
      });

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign task" });
    }
  });

  // ============================================================================
  // LEGACY TASK WORKFLOW ROUTES (Original waste container management)
  // These accept/pickup/delivery routes support the original 8-state workflow
  // for customer container pickup and warehouse delivery.
  // The app now primarily uses the Automotive Factory workflow with its own
  // 7-state lifecycle (OPEN -> PICKED_UP -> IN_TRANSIT -> DROPPED_OFF -> 
  // TAKEN_OVER -> WEIGHED -> DISPOSED).
  // Kept for backwards compatibility with existing data.
  // ============================================================================

  // Accept task - driver/admin scans customer container and starts the task
  // Transitions: PLANNED/ASSIGNED -> ACCEPTED (auto-assigns if needed)
  // Role logic: ADMIN can accept any task, DRIVER can only accept their own
  // Idempotent: If already in ACCEPTED or later state, return current state
  app.post("/api/tasks/:id/accept", async (req, res) => {
    try {
      const { userId, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Role-based authorization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      
      // ADMIN can accept any task, DRIVER can only accept their own
      if (!isAdmin && !isAssignedDriver && task.assignedTo) {
        return res.status(403).json({ 
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag annehmen.",
          assignedTo: task.assignedTo
        });
      }

      // Idempotent: If already accepted or in later state, return current state
      const LATER_STATES = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
      if (LATER_STATES.includes(task.status)) {
        // Already in progress, return current task state with container info
        const sourceContainer = await storage.getCustomerContainer(task.containerID);
        let targetContainer = null;
        if (task.deliveryContainerID) {
          targetContainer = await storage.getWarehouseContainer(task.deliveryContainerID);
        }
        
        const response: any = {
          task: task,
          alreadyAccepted: true,
          sourceContainer: sourceContainer ? {
            id: sourceContainer.id,
            label: sourceContainer.id,
            location: sourceContainer.location,
            content: sourceContainer.materialType,
            materialType: sourceContainer.materialType,
            customerName: sourceContainer.customerName,
            unit: task.plannedQuantityUnit || "kg",
            currentQuantity: task.estimatedAmount || 0,
            plannedPickupQuantity: task.plannedQuantity || task.estimatedAmount || 0,
          } : null,
        };
        
        if (targetContainer) {
          response.targetContainer = {
            id: targetContainer.id,
            label: targetContainer.id,
            location: targetContainer.location,
            content: targetContainer.materialType,
            materialType: targetContainer.materialType,
            capacity: targetContainer.maxCapacity,
            currentFill: targetContainer.currentAmount,
            remainingCapacity: targetContainer.maxCapacity - targetContainer.currentAmount,
            unit: targetContainer.quantityUnit,
          };
        }
        
        return res.json(response);
      }

      // Get source container (customer container)
      const sourceContainer = await storage.getCustomerContainer(task.containerID);
      if (!sourceContainer) {
        return res.status(404).json({ error: "Kundencontainer nicht gefunden" });
      }

      // Get target container (warehouse container) if specified
      let targetContainer = null;
      if (task.deliveryContainerID) {
        targetContainer = await storage.getWarehouseContainer(task.deliveryContainerID);
        
        if (targetContainer) {
          // Material match validation
          if (sourceContainer.materialType !== targetContainer.materialType) {
            return res.status(400).json({ 
              error: "Der Zielcontainer enthält ein anderes Material. Bitte wähle einen passenden Lagercontainer.",
              sourceMaterial: sourceContainer.materialType,
              targetMaterial: targetContainer.materialType
            });
          }

          // Capacity validation
          const remainingCapacity = targetContainer.maxCapacity - targetContainer.currentAmount;
          if (task.plannedQuantity && task.plannedQuantity > remainingCapacity) {
            return res.status(400).json({ 
              error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
              remainingCapacity,
              requestedAmount: task.plannedQuantity,
              unit: targetContainer.quantityUnit
            });
          }
        }
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "ACCEPTED", userId);
      if (!updatedTask) {
        return res.status(400).json({ error: "Ungültiger Status-Übergang. Aktueller Status: " + task.status });
      }

      await storage.updateTask(req.params.id, {
        pickupLocation: location,
      });

      const scanEvent = await storage.createScanEvent({
        containerId: task.containerID,
        containerType: "customer",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext: "TASK_ACCEPT_AT_CUSTOMER",
        locationType: "CUSTOMER",
        locationDetails: location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      const driver = await storage.getUser(userId);
      const driverName = driver?.name || "Unbekannt";

      await storage.createActivityLog({
        type: "TASK_ACCEPTED",
        action: "TASK_ACCEPTED",
        message: `Fahrer ${driverName} hat Auftrag ${task.id} beim Kunden angenommen`,
        userId,
        taskId: task.id,
        containerId: task.containerID,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: { autoAssigned: task.status === "PLANNED" },
      });

      // Build response with source and target container details
      const response: any = {
        task: updatedTask,
        sourceContainer: {
          id: sourceContainer.id,
          label: sourceContainer.id,
          location: sourceContainer.location,
          content: sourceContainer.materialType, // content field maps to materialType
          materialType: sourceContainer.materialType,
          customerName: sourceContainer.customerName,
          unit: updatedTask.plannedQuantityUnit || "kg",
          currentQuantity: updatedTask.estimatedAmount || 0,
          plannedPickupQuantity: updatedTask.plannedQuantity || updatedTask.estimatedAmount || 0,
        },
      };

      if (targetContainer) {
        response.targetContainer = {
          id: targetContainer.id,
          label: targetContainer.id,
          location: targetContainer.location,
          content: targetContainer.materialType, // content field maps to materialType
          materialType: targetContainer.materialType,
          capacity: targetContainer.maxCapacity,
          currentFill: targetContainer.currentAmount,
          remainingCapacity: targetContainer.maxCapacity - targetContainer.currentAmount,
          unit: targetContainer.quantityUnit,
        };
      }

      res.json(response);
    } catch (error) {
      console.error("Failed to accept task:", error);
      res.status(500).json({ error: "Fehler beim Annehmen des Auftrags" });
    }
  });

  // Pickup task - driver/admin confirms physical pickup of container
  // Transitions: ACCEPTED -> PICKED_UP
  // Role logic: ADMIN can pickup any task, DRIVER can only pickup their own
  // Idempotent: If already picked up or in later state, return current state
  app.post("/api/tasks/:id/pickup", async (req, res) => {
    try {
      const { userId, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Role-based authorization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      
      // ADMIN can pickup any task, DRIVER can only pickup their own
      if (!isAdmin && !isAssignedDriver) {
        return res.status(403).json({ 
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag abholen.",
          assignedTo: task.assignedTo
        });
      }

      // Idempotent: If already picked up or in later state, return current state
      const LATER_STATES = ["PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
      if (LATER_STATES.includes(task.status)) {
        return res.json({ ...task, alreadyPickedUp: true });
      }

      if (task.status !== "ACCEPTED") {
        return res.status(400).json({ 
          error: "Auftrag muss zuerst angenommen werden bevor er abgeholt werden kann",
          currentStatus: task.status
        });
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "PICKED_UP", userId);
      if (!updatedTask) {
        return res.status(400).json({ error: "Ungültiger Status-Übergang" });
      }

      const scanEvent = await storage.createScanEvent({
        containerId: task.containerID,
        containerType: "customer",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext: "TASK_PICKUP",
        locationType: "CUSTOMER",
        locationDetails: location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      const driver = await storage.getUser(userId);
      const driverName = driver?.name || "Unbekannt";

      await storage.createActivityLog({
        type: "TASK_PICKED_UP",
        action: "TASK_PICKED_UP",
        message: `Fahrer ${driverName} hat Container ${task.containerID} abgeholt`,
        userId,
        taskId: task.id,
        containerId: task.containerID,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: null,
      });

      res.json(updatedTask);
    } catch (error) {
      console.error("Failed to pickup task:", error);
      res.status(500).json({ error: "Fehler beim Abholen des Containers" });
    }
  });

  // Delivery endpoint - driver/admin scans warehouse container to complete delivery
  // Adds quantity to warehouse container and completes the task
  // Role logic: ADMIN can deliver any task, DRIVER can only deliver their own
  app.post("/api/tasks/:id/delivery", async (req, res) => {
    try {
      const { userId, warehouseContainerId, amount, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Role-based authorization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      
      // ADMIN can deliver any task, DRIVER can only deliver their own
      if (!isAdmin && !isAssignedDriver) {
        return res.status(403).json({ 
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag abliefern.",
          assignedTo: task.assignedTo
        });
      }

      // Idempotent: If already completed, return current state
      if (task.status === "COMPLETED") {
        return res.json({ ...task, alreadyCompleted: true });
      }

      const warehouseContainer = await storage.getWarehouseContainer(warehouseContainerId);
      if (!warehouseContainer) {
        return res.status(404).json({ error: "Lagercontainer nicht gefunden" });
      }

      if (warehouseContainer.materialType !== task.materialType) {
        return res.status(400).json({ 
          error: "Der Zielcontainer enthält ein anderes Material. Bitte wähle einen passenden Lagercontainer.",
          sourceMaterial: task.materialType,
          targetMaterial: warehouseContainer.materialType
        });
      }

      // Determine quantity to add: prefer actual/measured, then planned, then estimated
      const deliveredAmount = amount || task.plannedQuantity || task.estimatedAmount || 0;

      const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
      if (deliveredAmount > availableSpace) {
        return res.status(400).json({ 
          error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
          remainingCapacity: availableSpace,
          requestedAmount: deliveredAmount,
          unit: warehouseContainer.quantityUnit
        });
      }

      let updatedTask = await storage.updateTaskStatus(req.params.id, "DELIVERED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Ungültiger Status-Übergang" });
      }

      await storage.updateTask(req.params.id, {
        deliveryContainerID: warehouseContainerId,
      });

      const scanEvent = await storage.createScanEvent({
        containerId: warehouseContainerId,
        containerType: "warehouse",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext: "TASK_COMPLETE_AT_WAREHOUSE",
        locationType: "WAREHOUSE",
        locationDetails: warehouseContainer.warehouseZone || location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      await storage.createActivityLog({
        type: "TASK_DELIVERED",
        action: "TASK_DELIVERED",
        message: `Container ${task.containerID} wurde im Lager abgeliefert`,
        userId,
        taskId: task.id,
        containerId: warehouseContainerId,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: null,
      });

      // Update warehouse container with additive quantity
      const newAmount = warehouseContainer.currentAmount + deliveredAmount;
      await storage.updateWarehouseContainer(warehouseContainerId, {
        currentAmount: newAmount,
      });

      await storage.createFillHistory({
        warehouseContainerId,
        amountAdded: deliveredAmount,
        quantityUnit: warehouseContainer.quantityUnit,
        taskId: task.id,
        recordedByUserId: userId,
      });

      await storage.updateCustomerContainer(task.containerID, {
        lastEmptied: new Date(),
        status: "AT_CUSTOMER",
      });

      // Update task with actual quantity
      await storage.updateTask(req.params.id, {
        actualQuantity: deliveredAmount,
      });

      updatedTask = await storage.updateTaskStatus(req.params.id, "COMPLETED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Fehler beim Abschließen des Auftrags" });
      }

      await storage.createActivityLog({
        type: "TASK_COMPLETED",
        action: "TASK_COMPLETED",
        message: `Auftrag ${task.id} abgeschlossen, ${deliveredAmount} ${warehouseContainer.quantityUnit} erfasst`,
        userId,
        taskId: task.id,
        containerId: warehouseContainerId,
        timestamp: new Date(),
        metadata: { amountAdded: deliveredAmount, unit: warehouseContainer.quantityUnit },
        details: null,
        location: null,
        scanEventId: null,
      });

      // Return both task and updated container info
      res.json({
        task: updatedTask,
        targetContainer: {
          id: warehouseContainerId,
          label: warehouseContainerId,
          location: warehouseContainer.location,
          content: warehouseContainer.materialType,
          materialType: warehouseContainer.materialType,
          capacity: warehouseContainer.maxCapacity,
          currentFill: newAmount,
          remainingCapacity: warehouseContainer.maxCapacity - newAmount,
          unit: warehouseContainer.quantityUnit,
          amountAdded: deliveredAmount,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record delivery" });
    }
  });

  app.post("/api/tasks/:id/cancel", async (req, res) => {
    try {
      const { userId, reason } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "CANCELLED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Invalid status transition - task may already be completed" });
      }

      await storage.updateTask(req.params.id, {
        cancellationReason: reason,
      });

      await storage.createActivityLog({
        type: "TASK_CANCELLED",
        action: "TASK_CANCELLED",
        message: `Auftrag ${task.id} wurde storniert: ${reason || 'Kein Grund angegeben'}`,
        userId,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: new Date(),
        metadata: { reason },
        details: null,
        location: null,
        scanEventId: null,
      });

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel task" });
    }
  });

  // Claim task - Pull-based task claiming with TTL
  // Anyone can claim any task for collision protection (30 min TTL)
  // Claim does NOT change status - it's just a lock
  app.post("/api/tasks/:id/claim", requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      // Check if task is in a terminal state
      const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "DISPOSED"];
      if (TERMINAL_STATUSES.includes(task.status)) {
        return res.status(400).json({ 
          error: "Abgeschlossene Aufträge können nicht beansprucht werden",
          currentStatus: task.status
        });
      }

      const now = new Date();
      let autoReleasedExpired = false;

      // Check if already claimed and not expired
      if (task.claimedByUserId) {
        if (!isClaimExpired(task.claimedAt)) {
          // Claim exists and is NOT expired - reject
          const claimingUser = await storage.getUser(task.claimedByUserId);
          return res.status(409).json({ 
            error: "Auftrag wurde bereits von einem anderen Benutzer beansprucht",
            claimedBy: claimingUser?.name || "Unbekannt",
            claimedAt: task.claimedAt,
            expiresAt: task.claimedAt ? new Date(task.claimedAt.getTime() + CLAIM_TTL_MINUTES * 60 * 1000) : null
          });
        } else {
          // Claim exists but is expired - log auto-release and allow overwriting
          autoReleasedExpired = true;
          const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};
          await createAuditEvent({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "AUTO_RELEASE_EXPIRED",
            entityType: "task",
            entityId: task.id,
            beforeData: { claimedByUserId: task.claimedByUserId, claimedAt: task.claimedAt },
            afterData: { claimedByUserId: null, claimedAt: null },
            metaJson: {
              ...standMeta,
              boxId: task.boxId || undefined,
              reason: "Claim expired after TTL",
            },
          });
        }
      }

      // Update task with claim info only - do NOT change status
      await storage.updateTask(req.params.id, {
        claimedByUserId: authUser.id,
        claimedAt: now,
      });

      // Fetch updated task
      const updatedTask = await storage.getTask(req.params.id);

      // Create audit event for claim
      const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};
      await createAuditEvent({
        taskId: task.id,
        actorUserId: authUser.id,
        action: "CLAIM",
        entityType: "task",
        entityId: task.id,
        beforeData: { claimedByUserId: autoReleasedExpired ? null : task.claimedByUserId },
        afterData: { claimedByUserId: authUser.id, claimedAt: now },
        metaJson: {
          ...standMeta,
          boxId: task.boxId || undefined,
          autoReleasedExpired,
        },
      });

      res.json({ 
        task: updatedTask,
        claimed: true,
        expiresAt: new Date(now.getTime() + CLAIM_TTL_MINUTES * 60 * 1000),
        autoReleasedExpired,
      });
    } catch (error) {
      console.error("Failed to claim task:", error);
      res.status(500).json({ error: "Fehler beim Beanspruchen des Auftrags" });
    }
  });

  // Release task - Clear the claim on a task
  // Anyone can release any task (no ownership check)
  app.post("/api/tasks/:id/release", requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      const previousClaim = {
        claimedByUserId: task.claimedByUserId,
        claimedAt: task.claimedAt,
      };

      // Clear the claim
      await storage.updateTask(req.params.id, {
        claimedByUserId: null,
        claimedAt: null,
      });

      // Fetch updated task
      const updatedTask = await storage.getTask(req.params.id);

      // Create audit event for release
      const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};
      await createAuditEvent({
        taskId: task.id,
        actorUserId: authUser.id,
        action: "RELEASE",
        entityType: "task",
        entityId: task.id,
        beforeData: previousClaim,
        afterData: { claimedByUserId: null, claimedAt: null },
        metaJson: {
          ...standMeta,
          boxId: task.boxId || undefined,
        },
      });

      res.json({ 
        task: updatedTask,
        released: true,
      });
    } catch (error) {
      console.error("Failed to release task:", error);
      res.status(500).json({ error: "Fehler beim Freigeben des Auftrags" });
    }
  });

  // Transition task - Unified status transition endpoint
  // Validates transition, auto-claims if needed, auto-releases on DROPPED_OFF
  app.post("/api/tasks/:id/transition", requireAuth, async (req, res) => {
    try {
      const { toStatus, weightKg, targetWarehouseContainerId, reason } = req.body;
      const authUser = (req as any).authUser;
      
      if (!toStatus) {
        return res.status(400).json({ error: "toStatus is required" });
      }

      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      // Validate transition using assertAutomotiveTransition
      try {
        assertAutomotiveTransition(task.status, toStatus);
      } catch (error: any) {
        return res.status(409).json({ 
          error: error.message,
          currentStatus: task.status,
          requestedStatus: toStatus
        });
      }

      // Require weightKg for TAKEN_OVER → WEIGHED transition
      if (task.status === "TAKEN_OVER" && toStatus === "WEIGHED") {
        if (weightKg === undefined || weightKg === null) {
          return res.status(400).json({ error: "weightKg is required for WEIGHED status" });
        }
      }

      const now = new Date();
      let autoClaimed = false;
      let autoReleased = false;

      // Build metaJson context for audit events
      const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};

      // Auto-claim if not claimed or claim is expired
      if (!task.claimedByUserId || isClaimExpired(task.claimedAt)) {
        autoClaimed = true;
        // Log auto-claim event
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "AUTO_CLAIM",
          entityType: "task",
          entityId: task.id,
          beforeData: { claimedByUserId: task.claimedByUserId, claimedAt: task.claimedAt },
          afterData: { claimedByUserId: authUser.id, claimedAt: now },
          metaJson: {
            ...standMeta,
            boxId: task.boxId || undefined,
            reason: "Auto-claimed before status transition",
          },
        });
      }

      const beforeData = { 
        status: task.status, 
        weightKg: task.weightKg,
        targetWarehouseContainerId: task.targetWarehouseContainerId,
        claimedByUserId: task.claimedByUserId,
        claimedAt: task.claimedAt,
      };

      const updateData: any = {
        status: toStatus,
        updatedAt: now,
      };

      // Auto-claim if needed
      if (autoClaimed) {
        updateData.claimedByUserId = authUser.id;
        updateData.claimedAt = now;
      }

      // Auto-release on DROPPED_OFF transition (from IN_TRANSIT)
      if (toStatus === "DROPPED_OFF") {
        updateData.claimedByUserId = null;
        updateData.claimedAt = null;
        autoReleased = true;
      }

      // Set timestamp field for the status
      const timestampField = getAutomotiveTimestampFieldForStatus(toStatus);
      if (timestampField) {
        updateData[timestampField] = now;
      }

      if (weightKg !== undefined) {
        updateData.weightKg = weightKg;
        updateData.weighedByUserId = authUser.id;
      }

      if (targetWarehouseContainerId !== undefined) {
        updateData.targetWarehouseContainerId = targetWarehouseContainerId;
      }

      if (reason !== undefined) {
        updateData.cancellationReason = reason;
      }

      // Perform the update
      await storage.updateTask(req.params.id, updateData);

      // Handle box status updates for terminal states
      if ((toStatus === "DISPOSED" || toStatus === "CANCELLED") && task.boxId) {
        await db.update(boxes)
          .set({ 
            currentTaskId: null, 
            status: toStatus === "DISPOSED" ? "AT_WAREHOUSE" : "AT_STAND",
            updatedAt: now 
          })
          .where(eq(boxes.id, task.boxId));
      }

      const eventMetaJson = {
        ...standMeta,
        boxId: task.boxId || undefined,
        containerId: task.boxId || undefined,
        targetWarehouseContainerId: updateData.targetWarehouseContainerId || undefined,
        autoClaimed,
        autoReleased,
      };

      // Log STATUS_CHANGED event
      await createAuditEvent({
        taskId: task.id,
        actorUserId: authUser.id,
        action: "STATUS_CHANGED",
        entityType: "task",
        entityId: task.id,
        beforeData,
        afterData: { 
          status: toStatus, 
          weightKg: updateData.weightKg,
          targetWarehouseContainerId: updateData.targetWarehouseContainerId,
          claimedByUserId: updateData.claimedByUserId,
          reason
        },
        metaJson: eventMetaJson,
      });

      // Log auto-release event separately if it happened
      if (autoReleased) {
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "AUTO_RELEASE",
          entityType: "task",
          entityId: task.id,
          beforeData: { claimedByUserId: autoClaimed ? authUser.id : task.claimedByUserId },
          afterData: { claimedByUserId: null, claimedAt: null },
          metaJson: {
            ...standMeta,
            boxId: task.boxId || undefined,
            reason: "Auto-released on DROPPED_OFF transition",
          },
        });
      }

      // Log WEIGHT_RECORDED when weight is set during WEIGHED transition
      if (toStatus === "WEIGHED" && weightKg !== undefined) {
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "WEIGHT_RECORDED",
          entityType: "task",
          entityId: task.id,
          beforeData: { weightKg: task.weightKg },
          afterData: { weightKg },
          metaJson: eventMetaJson,
        });
      }

      // Fetch updated task
      const updatedTask = await storage.getTask(req.params.id);

      res.json({ 
        task: updatedTask,
        transitioned: true,
        fromStatus: task.status,
        toStatus,
        autoClaimed,
        autoReleased,
      });
    } catch (error) {
      console.error("Failed to transition task:", error);
      res.status(500).json({ error: "Fehler beim Statuswechsel des Auftrags" });
    }
  });

  // Handover task - Transfer task to another user
  // Admin or current owner can transfer the task
  // Updates claimedByUserId, assignedTo and sets handoverAt
  app.post("/api/tasks/:id/handover", requireAuth, async (req, res) => {
    try {
      const { newUserId } = req.body;
      const authUser = (req as any).authUser;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      if (!newUserId) {
        return res.status(400).json({ error: "newUserId ist erforderlich" });
      }

      // Check if new user exists
      const newUser = await storage.getUser(newUserId);
      if (!newUser) {
        return res.status(404).json({ error: "Neuer Benutzer nicht gefunden" });
      }

      // Authorization: Admin or current owner can transfer
      const userRole = authUser.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isCurrentOwner = task.claimedByUserId === authUser.id || task.assignedTo === authUser.id;

      if (!isAdmin && !isCurrentOwner) {
        return res.status(403).json({ 
          error: "Nur der aktuelle Besitzer oder ein Admin kann diesen Auftrag übergeben"
        });
      }

      // Check if task is in a transferable state (not completed or cancelled)
      const NON_TRANSFERABLE_STATUSES = ["COMPLETED", "CANCELLED"];
      if (NON_TRANSFERABLE_STATUSES.includes(task.status)) {
        return res.status(400).json({ 
          error: "Abgeschlossene oder stornierte Aufträge können nicht übergeben werden",
          currentStatus: task.status
        });
      }

      const oldUser = task.claimedByUserId ? await storage.getUser(task.claimedByUserId) : authUser;
      const oldUserName = oldUser?.name || "Unbekannt";
      const now = new Date();

      // Update task with handover info
      await storage.updateTask(req.params.id, {
        claimedByUserId: newUserId,
        assignedTo: newUserId,
        handoverAt: now,
      });

      // Fetch updated task
      const updatedTask = await storage.getTask(req.params.id);

      // Create activity log
      await storage.createActivityLog({
        type: "TASK_ASSIGNED",
        action: "TASK_ASSIGNED",
        message: `Auftrag übergeben von ${oldUserName} an ${newUser.name}`,
        userId: authUser.id,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: now,
        metadata: { 
          fromUserId: oldUser?.id,
          toUserId: newUserId,
          handoverAt: now.toISOString()
        },
        details: null,
        location: null,
        scanEventId: null,
      });

      res.json({ 
        task: updatedTask,
        handover: {
          from: { id: oldUser?.id, name: oldUserName },
          to: { id: newUser.id, name: newUser.name },
          at: now.toISOString()
        }
      });
    } catch (error) {
      console.error("Failed to handover task:", error);
      res.status(500).json({ error: "Fehler bei der Auftragsübergabe" });
    }
  });

  // ============================================================================
  // SCAN EVENTS
  // ============================================================================

  app.get("/api/scan-events", async (req, res) => {
    try {
      const { containerId, taskId, userId } = req.query;
      const filters: { containerId?: string; taskId?: string; userId?: string } = {};
      
      if (containerId) filters.containerId = containerId as string;
      if (taskId) filters.taskId = taskId as string;
      if (userId) filters.userId = userId as string;

      const events = await storage.getScanEvents(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scan events" });
    }
  });

  app.get("/api/scan-events/:id", async (req, res) => {
    try {
      const event = await storage.getScanEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Scan event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scan event" });
    }
  });

  app.post("/api/scan-events", async (req, res) => {
    try {
      const { containerId, containerType, userId, scanContext, locationType, locationDetails, geoLocation, taskId, measuredWeight } = req.body;
      
      if (!containerId || !containerType || !userId || !scanContext || !locationType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Special handling for TASK_COMPLETE_AT_WAREHOUSE - requires measuredWeight
      if (scanContext === "TASK_COMPLETE_AT_WAREHOUSE") {
        if (!taskId) {
          return res.status(400).json({ error: "taskId ist erforderlich für Lager-Abschluss-Scan" });
        }
        
        if (measuredWeight === undefined || measuredWeight === null) {
          return res.status(400).json({ error: "measuredWeight ist erforderlich für Lager-Abschluss-Scan" });
        }
        
        const weight = parseFloat(measuredWeight);
        if (isNaN(weight) || weight <= 0) {
          return res.status(400).json({ error: "measuredWeight muss größer als 0 sein" });
        }

        // Get task and validate
        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({ error: "Auftrag nicht gefunden" });
        }

        // Get warehouse container
        const warehouseContainer = await storage.getWarehouseContainer(containerId);
        if (!warehouseContainer) {
          return res.status(404).json({ error: "Lagercontainer nicht gefunden" });
        }

        // Check capacity
        const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
        if (weight > availableSpace) {
          return res.status(400).json({ 
            error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
            remainingCapacity: availableSpace,
            requestedAmount: weight,
            unit: warehouseContainer.quantityUnit
          });
        }

        // Create scan event
        const scanEvent = await storage.createScanEvent({
          containerId,
          containerType,
          taskId,
          scannedByUserId: userId,
          scannedAt: new Date(),
          scanContext,
          locationType,
          locationDetails: locationDetails || warehouseContainer.warehouseZone || null,
          geoLocation: geoLocation || null,
          scanResult: "SUCCESS",
          resultMessage: null,
          extraData: { measuredWeight: weight },
        });

        // Update task with measured weight
        await storage.updateTask(taskId, {
          measuredWeight: weight,
          actualQuantity: weight,
          deliveryContainerID: containerId,
        });

        // Add weight to warehouse container
        const newAmount = warehouseContainer.currentAmount + weight;
        await storage.updateWarehouseContainer(containerId, {
          currentAmount: newAmount,
        });

        // Create fill history entry
        await storage.createFillHistory({
          warehouseContainerId: containerId,
          amountAdded: weight,
          quantityUnit: warehouseContainer.quantityUnit,
          taskId,
          recordedByUserId: userId,
        });

        // Update customer container
        if (task.containerID) {
          await storage.updateCustomerContainer(task.containerID, {
            lastEmptied: new Date(),
            status: "AT_CUSTOMER",
          });
        }

        // Set task status to COMPLETED
        await storage.updateTaskStatus(taskId, "COMPLETED");

        const user = await storage.getUser(userId);
        const userName = user?.name || "Unbekannt";

        // Create activity log for weight recorded
        await storage.createActivityLog({
          type: "WEIGHT_RECORDED",
          action: "WEIGHT_RECORDED",
          message: `Gewicht erfasst: ${weight} ${warehouseContainer.quantityUnit} von ${userName}`,
          userId,
          taskId,
          containerId,
          scanEventId: scanEvent.id,
          location: geoLocation || null,
          timestamp: new Date(),
          details: null,
          metadata: { measuredWeight: weight, unit: warehouseContainer.quantityUnit },
        });

        // Create activity log for task completed
        await storage.createActivityLog({
          type: "TASK_COMPLETED",
          action: "TASK_COMPLETED",
          message: `Auftrag ${taskId} abgeschlossen, ${weight} ${warehouseContainer.quantityUnit} erfasst`,
          userId,
          taskId,
          containerId,
          scanEventId: scanEvent.id,
          location: geoLocation || null,
          timestamp: new Date(),
          details: null,
          metadata: { measuredWeight: weight, unit: warehouseContainer.quantityUnit },
        });

        // Fetch updated task
        const updatedTask = await storage.getTask(taskId);

        return res.status(201).json({
          scanEvent,
          task: updatedTask,
          targetContainer: {
            id: warehouseContainer.id,
            label: warehouseContainer.id,
            location: warehouseContainer.location,
            materialType: warehouseContainer.materialType,
            capacity: warehouseContainer.maxCapacity,
            currentFill: newAmount,
            remainingCapacity: warehouseContainer.maxCapacity - newAmount,
            unit: warehouseContainer.quantityUnit,
            amountAdded: weight,
          },
        });
      }

      // Default scan event handling (non-TASK_COMPLETE_AT_WAREHOUSE)
      const scanEvent = await storage.createScanEvent({
        containerId,
        containerType,
        taskId: taskId || null,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext,
        locationType,
        locationDetails: locationDetails || null,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      const logType = locationType === "WAREHOUSE" ? "CONTAINER_SCANNED_AT_WAREHOUSE" : "CONTAINER_SCANNED_AT_CUSTOMER";
      await storage.createActivityLog({
        type: logType,
        action: logType,
        message: `Container ${containerId} wurde gescannt (${scanContext})`,
        userId,
        taskId: taskId || null,
        containerId,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: null,
      });

      res.status(201).json(scanEvent);
    } catch (error) {
      console.error("Failed to create scan event:", error);
      res.status(500).json({ error: "Failed to create scan event" });
    }
  });

  // ============================================================================
  // ACTIVITY LOGS
  // ============================================================================

  app.get("/api/activity-logs", async (req, res) => {
    try {
      const { userId, containerId, type, taskId, startDate, endDate } = req.query;
      const filters: { userId?: string; containerId?: string; type?: string; taskId?: string } = {};
      
      if (userId) filters.userId = userId as string;
      if (containerId) filters.containerId = containerId as string;
      if (type) filters.type = type as string;
      if (taskId) filters.taskId = taskId as string;

      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/activity-logs/export/csv", async (req, res) => {
    try {
      const { userId, containerId, type, taskId, startDate, endDate } = req.query;
      const filters: { userId?: string; containerId?: string; type?: string; taskId?: string } = {};
      
      if (userId) filters.userId = userId as string;
      if (containerId) filters.containerId = containerId as string;
      if (type) filters.type = type as string;
      if (taskId) filters.taskId = taskId as string;

      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      const users = await storage.getUsers();
      
      const getUserName = (id: string | null) => {
        if (!id) return "System";
        const user = users.find(u => u.id === id);
        return user?.name || "Unknown";
      };

      const csvHeader = "ID,Datum,Uhrzeit,Benutzer,Typ,Nachricht,Container ID,Auftrag ID\n";
      const csvRows = logs.map(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString("de-DE");
        const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const userName = getUserName(log.userId).replace(/,/g, ";");
        const logType = (log.type || "").replace(/,/g, ";");
        const message = (log.message || "").replace(/,/g, ";").replace(/\n/g, " ");
        const containerId = (log.containerId || "").replace(/,/g, ";");
        const taskIdVal = (log.taskId || "").replace(/,/g, ";");
        return `${log.id},${dateStr},${timeStr},${userName},${logType},${message},${containerId},${taskIdVal}`;
      }).join("\n");

      const csv = csvHeader + csvRows;
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=aktivitaetslog-${new Date().toISOString().split("T")[0]}.csv`);
      res.send("\uFEFF" + csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export activity logs" });
    }
  });

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  app.get("/api/analytics/driver-performance", async (req, res) => {
    try {
      const allTasks = await storage.getTasks();
      const users = await storage.getUsers();
      const drivers = users.filter(u => u.role === "driver" || u.role === "DRIVER");
      
      const now = new Date();
      const today = now.toDateString();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const driverStats = drivers.map(driver => {
        const driverTasks = allTasks.filter(t => t.assignedTo === driver.id);
        const completedTasks = driverTasks.filter(t => t.status === "COMPLETED" || t.status === "completed");
        const completedToday = completedTasks.filter(t => {
          if (!t.completedAt) return false;
          return new Date(t.completedAt).toDateString() === today;
        });
        const completedThisWeek = completedTasks.filter(t => {
          if (!t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return completedDate >= startOfWeek;
        });

        const avgDeliveryTime = completedTasks.length > 0 
          ? completedTasks.reduce((sum, t) => {
              if (t.acceptedAt && t.completedAt) {
                return sum + (new Date(t.completedAt).getTime() - new Date(t.acceptedAt).getTime());
              }
              return sum;
            }, 0) / completedTasks.length / (1000 * 60)
          : 0;

        const completionRate = driverTasks.length > 0 
          ? Math.round((completedTasks.length / driverTasks.length) * 100)
          : 0;

        const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "in_progress"];
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          totalAssigned: driverTasks.length,
          totalCompleted: completedTasks.length,
          completedToday: completedToday.length,
          completedThisWeek: completedThisWeek.length,
          inProgress: driverTasks.filter(t => inProgressStatuses.includes(t.status)).length,
          completionRate,
          avgDeliveryTimeMinutes: Math.round(avgDeliveryTime),
        };
      });

      const overallStats = {
        totalDrivers: drivers.length,
        activeDrivers: driverStats.filter(d => d.inProgress > 0 || d.completedToday > 0).length,
        totalCompletedToday: driverStats.reduce((sum, d) => sum + d.completedToday, 0),
        totalCompletedThisWeek: driverStats.reduce((sum, d) => sum + d.completedThisWeek, 0),
        avgCompletionRate: driverStats.length > 0
          ? Math.round(driverStats.reduce((sum, d) => sum + d.completionRate, 0) / driverStats.length)
          : 0,
      };

      res.json({
        drivers: driverStats,
        overall: overallStats,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver performance" });
    }
  });

  app.get("/api/analytics/fill-trends", async (req, res) => {
    try {
      const warehouseContainers = await storage.getWarehouseContainers();
      const allTasks = await storage.getTasks();
      
      const now = new Date();
      const daysAgo = (days: number) => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date;
      };

      const dailyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = daysAgo(i);
        const dateStr = date.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
        
        const dayTasks = allTasks.filter(t => {
          if (!t.completedAt) return false;
          const taskDate = new Date(t.completedAt);
          return taskDate.toDateString() === date.toDateString();
        });

        const totalDelivered = dayTasks.reduce((sum, t) => {
          const container = warehouseContainers.find(c => c.id === t.deliveryContainerID);
          return sum + (container ? 50 : 0);
        }, 0);

        dailyData.push({
          date: dateStr,
          deliveries: dayTasks.length,
          volumeKg: totalDelivered,
        });
      }

      const currentFillLevels = warehouseContainers.map(c => ({
        id: c.id,
        location: c.location,
        materialType: c.materialType,
        currentAmount: c.currentAmount,
        maxCapacity: c.maxCapacity,
        fillPercentage: Math.round((c.currentAmount / c.maxCapacity) * 100),
      }));

      const materialBreakdown = warehouseContainers.reduce((acc, c) => {
        const existing = acc.find(m => m.material === c.materialType);
        if (existing) {
          existing.currentAmount += c.currentAmount;
          existing.maxCapacity += c.maxCapacity;
        } else {
          acc.push({
            material: c.materialType,
            currentAmount: c.currentAmount,
            maxCapacity: c.maxCapacity,
          });
        }
        return acc;
      }, [] as { material: string; currentAmount: number; maxCapacity: number }[]);

      res.json({
        dailyTrends: dailyData,
        containerLevels: currentFillLevels,
        materialBreakdown,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Dashboard stats with optional driverId filter
  // GET /api/dashboard/stats?driverId=driver-001
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const { driverId } = req.query;
      const allTasks = await storage.getTasks();
      const warehouseContainers = await storage.getWarehouseContainers();
      const users = await storage.getUsers();

      // Filter tasks by driver if driverId provided
      const tasksToCount = driverId 
        ? allTasks.filter(t => t.assignedTo === driverId)
        : allTasks;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayTasks = tasksToCount.filter(t => {
        const created = new Date(t.createdAt);
        return created >= today && created <= todayEnd;
      });

      // Updated status categories to include OFFEN
      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];

      const openTasks = tasksToCount.filter(t => openStatuses.includes(t.status)).length;
      const inProgressTasks = tasksToCount.filter(t => inProgressStatuses.includes(t.status)).length;
      const completedTasks = tasksToCount.filter(t => completedStatuses.includes(t.status)).length;
      const completedToday = todayTasks.filter(t => completedStatuses.includes(t.status)).length;
      const cancelledTasks = tasksToCount.filter(t => cancelledStatuses.includes(t.status)).length;
      const activeDrivers = users.filter(u => (u.role === "driver" || u.role === "DRIVER") && u.isActive).length;

      const criticalContainers = warehouseContainers.filter(c => {
        const fillPercentage = (c.currentAmount / c.maxCapacity) * 100;
        return fillPercentage >= 80;
      }).length;

      const totalCapacity = warehouseContainers.reduce((acc, c) => acc + c.maxCapacity, 0);
      const usedCapacity = warehouseContainers.reduce((acc, c) => acc + c.currentAmount, 0);
      const availableCapacity = totalCapacity - usedCapacity;

      res.json({
        openTasks,
        inProgressTasks,
        completedTasks,
        completedToday,
        cancelledTasks,
        activeDrivers,
        criticalContainers,
        totalCapacity,
        availableCapacity,
        totalTasks: tasksToCount.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Driver-specific stats endpoint
  // GET /api/drivers/:id/stats
  app.get("/api/drivers/:id/stats", async (req, res) => {
    try {
      const driverId = req.params.id;
      const driver = await storage.getUser(driverId);
      
      if (!driver) {
        return res.status(404).json({ error: "Fahrer nicht gefunden" });
      }

      const allTasks = await storage.getTasks({ assignedTo: driverId });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayTasks = allTasks.filter(t => {
        const created = new Date(t.createdAt);
        return created >= today && created <= todayEnd;
      });

      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];

      const openTasks = allTasks.filter(t => openStatuses.includes(t.status)).length;
      const inProgressTasks = allTasks.filter(t => inProgressStatuses.includes(t.status)).length;
      const completedTasks = allTasks.filter(t => completedStatuses.includes(t.status)).length;
      const completedToday = todayTasks.filter(t => completedStatuses.includes(t.status)).length;
      const cancelledTasks = allTasks.filter(t => cancelledStatuses.includes(t.status)).length;

      // Find last activity
      const activityLogs = await storage.getActivityLogs({ userId: driverId });
      const lastActivity = activityLogs.length > 0 ? activityLogs[0].timestamp : null;

      res.json({
        driverId,
        driverName: driver.name,
        driverEmail: driver.email,
        openTasks,
        inProgressTasks,
        completedTasks,
        completedToday,
        cancelledTasks,
        totalTasks: allTasks.length,
        lastActivity,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver stats" });
    }
  });

  // Driver overview with task counts per driver
  // GET /api/drivers/overview
  app.get("/api/drivers/overview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const allTasks = await storage.getTasks();
      
      const drivers = users.filter(u => u.role === "DRIVER" || u.role === "driver");
      
      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];
      
      const driverOverview = await Promise.all(drivers.map(async (driver) => {
        const driverTasks = allTasks.filter(t => t.assignedTo === driver.id);
        
        // Get last activity
        const activityLogs = await storage.getActivityLogs({ userId: driver.id });
        const lastActivity = activityLogs.length > 0 ? activityLogs[0].timestamp : null;
        
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          isActive: driver.isActive,
          openTasks: driverTasks.filter(t => openStatuses.includes(t.status)).length,
          inProgressTasks: driverTasks.filter(t => inProgressStatuses.includes(t.status)).length,
          completedTasks: driverTasks.filter(t => completedStatuses.includes(t.status)).length,
          cancelledTasks: driverTasks.filter(t => cancelledStatuses.includes(t.status)).length,
          totalTasks: driverTasks.length,
          lastActivity,
        };
      }));

      res.json(driverOverview);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver overview" });
    }
  });

  // ============================================================================
  // AUTOMOTIVE FACTORY API ENDPOINTS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // MATERIALS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/materials - List all materials
  app.get("/api/materials", async (req, res) => {
    try {
      const result = await db.select().from(materials).where(eq(materials.isActive, true));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch materials:", error);
      res.status(500).json({ error: "Failed to fetch materials" });
    }
  });

  // GET /api/materials/:id - Get material by ID
  app.get("/api/materials/:id", async (req, res) => {
    try {
      const [material] = await db.select().from(materials).where(eq(materials.id, req.params.id));
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      res.json(material);
    } catch (error) {
      console.error("Failed to fetch material:", error);
      res.status(500).json({ error: "Failed to fetch material" });
    }
  });

  // POST /api/materials - Create material (admin only)
  app.post("/api/materials", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description, hazardClass, disposalStream, densityHint, defaultUnit, qrCode } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }

      const [material] = await db.insert(materials).values({
        name,
        code,
        description: description || null,
        hazardClass: hazardClass || null,
        disposalStream: disposalStream || null,
        densityHint: densityHint || null,
        defaultUnit: defaultUnit || "kg",
        qrCode: qrCode || null,
      }).returning();

      res.status(201).json(material);
    } catch (error) {
      console.error("Failed to create material:", error);
      res.status(500).json({ error: "Failed to create material" });
    }
  });

  // PUT /api/materials/:id - Update material (admin only)
  app.put("/api/materials/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(materials).where(eq(materials.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Material not found" });
      }

      const { name, code, description, hazardClass, disposalStream, densityHint, defaultUnit, qrCode, isActive } = req.body;
      
      const [material] = await db.update(materials)
        .set({
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code }),
          ...(description !== undefined && { description }),
          ...(hazardClass !== undefined && { hazardClass }),
          ...(disposalStream !== undefined && { disposalStream }),
          ...(densityHint !== undefined && { densityHint }),
          ...(defaultUnit !== undefined && { defaultUnit }),
          ...(qrCode !== undefined && { qrCode }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(materials.id, req.params.id))
        .returning();

      res.json(material);
    } catch (error) {
      console.error("Failed to update material:", error);
      res.status(500).json({ error: "Failed to update material" });
    }
  });

  // ----------------------------------------------------------------------------
  // HALLS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/halls - List all halls
  app.get("/api/halls", async (req, res) => {
    try {
      const result = await db.select().from(halls).where(eq(halls.isActive, true));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch halls:", error);
      res.status(500).json({ error: "Failed to fetch halls" });
    }
  });

  // GET /api/halls/:id - Get hall by ID with stations
  app.get("/api/halls/:id", async (req, res) => {
    try {
      const [hall] = await db.select().from(halls).where(eq(halls.id, req.params.id));
      if (!hall) {
        return res.status(404).json({ error: "Hall not found" });
      }

      const hallStations = await db.select().from(stations).where(
        and(eq(stations.hallId, req.params.id), eq(stations.isActive, true))
      );

      res.json({ ...hall, stations: hallStations });
    } catch (error) {
      console.error("Failed to fetch hall:", error);
      res.status(500).json({ error: "Failed to fetch hall" });
    }
  });

  // POST /api/halls - Create hall (admin only)
  app.post("/api/halls", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description, locationMeta } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }

      const [hall] = await db.insert(halls).values({
        name,
        code,
        description: description || null,
        locationMeta: locationMeta || null,
      }).returning();

      res.status(201).json(hall);
    } catch (error) {
      console.error("Failed to create hall:", error);
      res.status(500).json({ error: "Failed to create hall" });
    }
  });

  // ----------------------------------------------------------------------------
  // STATIONS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/stations - List all stations (optionally filter by hallId)
  app.get("/api/stations", async (req, res) => {
    try {
      const { hallId } = req.query;
      
      let conditions = [eq(stations.isActive, true)];
      if (hallId && typeof hallId === 'string') {
        conditions.push(eq(stations.hallId, hallId));
      }

      const result = await db.select().from(stations).where(and(...conditions));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch stations:", error);
      res.status(500).json({ error: "Failed to fetch stations" });
    }
  });

  // GET /api/stations/:id - Get station by ID with stands
  app.get("/api/stations/:id", async (req, res) => {
    try {
      const [station] = await db.select().from(stations).where(eq(stations.id, req.params.id));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      const stationStands = await db.select().from(stands).where(
        and(eq(stands.stationId, req.params.id), eq(stands.isActive, true))
      );

      res.json({ ...station, stands: stationStands });
    } catch (error) {
      console.error("Failed to fetch station:", error);
      res.status(500).json({ error: "Failed to fetch station" });
    }
  });

  // GET /api/stations/:id/details - Get station with stands, boxes, and open tasks
  app.get("/api/stations/:id/details", requireAuth, async (req, res) => {
    try {
      const [station] = await db.select().from(stations).where(eq(stations.id, req.params.id));
      if (!station) {
        return res.status(404).json({ error: "Station nicht gefunden" });
      }

      // Get hall info
      const [hall] = await db.select().from(halls).where(eq(halls.id, station.hallId));

      // Get stands for this station
      const stationStands = await db.select().from(stands).where(
        and(eq(stands.stationId, req.params.id), eq(stands.isActive, true))
      );

      // Get materials for the stands
      const materialIds = stationStands.map(s => s.materialId).filter(Boolean) as string[];
      const standMaterials = materialIds.length > 0 
        ? await db.select().from(materials).where(inArray(materials.id, materialIds))
        : [];
      const materialMap = new Map(standMaterials.map(m => [m.id, m]));

      // Get boxes at these stands
      const standIds = stationStands.map(s => s.id);
      const standBoxes = standIds.length > 0 
        ? await db.select().from(boxes).where(
            and(inArray(boxes.standId, standIds), eq(boxes.isActive, true))
          )
        : [];

      // Get open automotive tasks for this station's stands (status not DISPOSED or CANCELLED)
      const openTasks = standIds.length > 0 
        ? await db.select().from(tasks).where(
            and(
              inArray(tasks.standId, standIds),
              notInArray(tasks.status, ['DISPOSED', 'CANCELLED', 'COMPLETED', 'completed'])
            )
          )
        : [];

      // Build response with nested data
      const standsWithDetails = stationStands.map(stand => ({
        ...stand,
        material: stand.materialId ? materialMap.get(stand.materialId) || null : null,
        boxes: standBoxes.filter(b => b.standId === stand.id),
        openTasks: openTasks.filter(t => t.standId === stand.id),
      }));

      res.json({
        ...station,
        hall: hall || null,
        stands: standsWithDetails,
        totalBoxes: standBoxes.length,
        totalOpenTasks: openTasks.length,
      });
    } catch (error) {
      console.error("Failed to fetch station details:", error);
      res.status(500).json({ error: "Fehler beim Laden der Stationsdetails" });
    }
  });

  // POST /api/stations - Create station (admin only)
  app.post("/api/stations", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { hallId, name, code, sequence, locationMeta } = req.body;
      
      if (!hallId || !name || !code) {
        return res.status(400).json({ error: "hallId, name, and code are required" });
      }

      const [hall] = await db.select().from(halls).where(eq(halls.id, hallId));
      if (!hall) {
        return res.status(404).json({ error: "Hall not found" });
      }

      // Check for duplicate code within the same hall
      const [existingStation] = await db.select().from(stations).where(
        and(eq(stations.hallId, hallId), eq(stations.code, code))
      );
      if (existingStation) {
        return res.status(400).json({ error: `Stationscode '${code}' existiert bereits in dieser Halle` });
      }

      const [station] = await db.insert(stations).values({
        hallId,
        name,
        code,
        sequence: sequence || null,
        locationMeta: locationMeta || null,
      }).returning();

      res.status(201).json(station);
    } catch (error) {
      console.error("Failed to create station:", error);
      res.status(500).json({ error: "Failed to create station" });
    }
  });

  // PUT /api/stations/:id - Update station (admin only)
  app.put("/api/stations/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, sequence, locationMeta, positionMeta, isActive } = req.body;
      
      const [existingStation] = await db.select().from(stations).where(eq(stations.id, req.params.id));
      if (!existingStation) {
        return res.status(404).json({ error: "Station not found" });
      }

      // If code is being changed, check for duplicate within the same hall
      if (code && code !== existingStation.code) {
        const [duplicateStation] = await db.select().from(stations).where(
          and(
            eq(stations.hallId, existingStation.hallId), 
            eq(stations.code, code),
            sql`${stations.id} != ${req.params.id}`
          )
        );
        if (duplicateStation) {
          return res.status(400).json({ error: `Stationscode '${code}' existiert bereits in dieser Halle` });
        }
      }

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (sequence !== undefined) updateData.sequence = sequence;
      if (locationMeta !== undefined) updateData.locationMeta = locationMeta;
      if (positionMeta !== undefined) updateData.positionMeta = positionMeta;
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updatedStation] = await db.update(stations)
        .set(updateData)
        .where(eq(stations.id, req.params.id))
        .returning();

      res.json(updatedStation);
    } catch (error) {
      console.error("Failed to update station:", error);
      res.status(500).json({ error: "Failed to update station" });
    }
  });

  // PATCH /api/stations/:id - Move station to different hall (admin only)
  app.patch("/api/stations/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { hallId } = req.body;
      const authUser = (req as any).authUser;

      if (!hallId) {
        return res.status(400).json({ error: "hallId ist erforderlich" });
      }

      const [existingStation] = await db.select().from(stations).where(eq(stations.id, req.params.id));
      if (!existingStation) {
        return res.status(404).json({ error: "Station nicht gefunden" });
      }

      if (hallId === existingStation.hallId) {
        return res.status(400).json({ error: "Station ist bereits in dieser Halle" });
      }

      const [targetHall] = await db.select().from(halls).where(eq(halls.id, hallId));
      if (!targetHall) {
        return res.status(404).json({ error: "Ziel-Halle nicht gefunden" });
      }

      if (!targetHall.isActive) {
        return res.status(400).json({ error: "Ziel-Halle ist nicht aktiv" });
      }

      const [duplicateStation] = await db.select().from(stations).where(
        and(eq(stations.hallId, hallId), eq(stations.code, existingStation.code))
      );
      if (duplicateStation) {
        return res.status(400).json({ error: `Stationscode '${existingStation.code}' existiert bereits in der Ziel-Halle` });
      }

      const [sourceHall] = await db.select().from(halls).where(eq(halls.id, existingStation.hallId));

      const [updatedStation] = await db.update(stations)
        .set({ hallId, updatedAt: new Date() })
        .where(eq(stations.id, req.params.id))
        .returning();

      await db.insert(activityLogs).values({
        userId: authUser.id,
        action: "STATION_MOVED",
        entityType: "station",
        entityId: req.params.id,
        details: {
          stationName: existingStation.name,
          stationCode: existingStation.code,
          fromHallId: existingStation.hallId,
          fromHallName: sourceHall?.name || "Unbekannt",
          toHallId: hallId,
          toHallName: targetHall.name,
        },
      });

      res.json(updatedStation);
    } catch (error) {
      console.error("Failed to move station:", error);
      res.status(500).json({ error: "Fehler beim Verschieben der Station" });
    }
  });

  // PATCH /api/stands/:id - Edit stand (material, active, station) with validation (admin only)
  app.patch("/api/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { materialId, isActive, stationId } = req.body;
      const authUser = (req as any).authUser;

      if (materialId === undefined && isActive === undefined && stationId === undefined) {
        return res.status(400).json({ error: "Keine Änderungen angegeben" });
      }

      const [existingStand] = await db.select().from(stands).where(eq(stands.id, req.params.id));
      if (!existingStand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }

      const changes: string[] = [];
      const updateData: any = { updatedAt: new Date() };

      if (materialId !== undefined && materialId !== existingStand.materialId) {
        if (materialId !== null) {
          const [targetMaterial] = await db.select().from(materials).where(eq(materials.id, materialId));
          if (!targetMaterial) {
            return res.status(404).json({ error: "Material nicht gefunden" });
          }
          if (!targetMaterial.isActive) {
            return res.status(400).json({ error: "Material ist nicht aktiv" });
          }
          changes.push(`Material: ${existingStand.materialId || 'keins'} → ${materialId}`);
        } else {
          changes.push(`Material entfernt`);
        }
        updateData.materialId = materialId;
      }

      if (stationId !== undefined && stationId !== existingStand.stationId) {
        const [targetStation] = await db.select().from(stations).where(eq(stations.id, stationId));
        if (!targetStation) {
          return res.status(404).json({ error: "Ziel-Station nicht gefunden" });
        }
        if (!targetStation.isActive) {
          return res.status(400).json({ error: "Ziel-Station ist nicht aktiv" });
        }
        const [targetHall] = await db.select().from(halls).where(eq(halls.id, targetStation.hallId));
        if (!targetHall?.isActive) {
          return res.status(400).json({ error: "Halle der Ziel-Station ist nicht aktiv" });
        }
        changes.push(`Station: ${existingStand.stationId} → ${stationId}`);
        updateData.stationId = stationId;
      }

      if (isActive !== undefined && isActive !== existingStand.isActive) {
        updateData.isActive = isActive;
        changes.push(`Aktiv: ${existingStand.isActive} → ${isActive}`);

        if (!isActive && existingStand.isActive) {
          const standBoxes = await db.select().from(boxes).where(
            and(eq(boxes.standId, req.params.id), eq(boxes.isActive, true))
          );
          if (standBoxes.length > 0) {
            await db.update(boxes)
              .set({ standId: null, updatedAt: new Date() })
              .where(eq(boxes.standId, req.params.id));
            changes.push(`${standBoxes.length} Box(en) vom Stellplatz abgemeldet`);
          }
        }
      }

      if (Object.keys(updateData).length === 1) {
        return res.status(400).json({ error: "Keine Änderungen vorgenommen" });
      }

      const [updatedStand] = await db.update(stands)
        .set(updateData)
        .where(eq(stands.id, req.params.id))
        .returning();

      await db.insert(activityLogs).values({
        userId: authUser.id,
        action: "STAND_EDITED",
        entityType: "stand",
        entityId: req.params.id,
        details: {
          standIdentifier: existingStand.identifier,
          changes,
          before: {
            materialId: existingStand.materialId,
            stationId: existingStand.stationId,
            isActive: existingStand.isActive,
          },
          after: {
            materialId: updatedStand.materialId,
            stationId: updatedStand.stationId,
            isActive: updatedStand.isActive,
          },
        },
      });

      res.json(updatedStand);
    } catch (error) {
      console.error("Failed to edit stand:", error);
      res.status(500).json({ error: "Fehler beim Bearbeiten des Stellplatzes" });
    }
  });

  // ----------------------------------------------------------------------------
  // STANDS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/stands - List all stands (optionally filter by stationId, materialId, includeInactive)
  app.get("/api/stands", async (req, res) => {
    try {
      const { stationId, materialId, includeInactive } = req.query;
      
      let conditions: any[] = [];
      if (includeInactive !== 'true') {
        conditions.push(eq(stands.isActive, true));
      }
      if (stationId && typeof stationId === 'string') {
        conditions.push(eq(stands.stationId, stationId));
      }
      if (materialId && typeof materialId === 'string') {
        conditions.push(eq(stands.materialId, materialId));
      }

      const result = conditions.length > 0 
        ? await db.select().from(stands).where(and(...conditions))
        : await db.select().from(stands);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch stands:", error);
      res.status(500).json({ error: "Failed to fetch stands" });
    }
  });

  // GET /api/stands/qr/:qrCode - Look up stand by QR code (must be before :id route)
  app.get("/api/stands/qr/:qrCode", async (req, res) => {
    try {
      const [stand] = await db.select().from(stands).where(eq(stands.qrCode, req.params.qrCode));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      // Get station and hall info
      const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
      const [hall] = station ? await db.select().from(halls).where(eq(halls.id, station.hallId)) : [null];
      // Get material info
      const [material] = stand.materialId ? await db.select().from(materials).where(eq(materials.id, stand.materialId)) : [null];
      // Get boxes at this stand
      const standBoxes = await db.select().from(boxes).where(eq(boxes.standId, stand.id));
      res.json({ stand, station, hall, material, boxes: standBoxes });
    } catch (error) {
      console.error("Failed to fetch stand by QR:", error);
      res.status(500).json({ error: "Failed to fetch stand" });
    }
  });

  // GET /api/stands/:id - Get stand by ID
  app.get("/api/stands/:id", async (req, res) => {
    try {
      const [stand] = await db.select().from(stands).where(eq(stands.id, req.params.id));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      res.json(stand);
    } catch (error) {
      console.error("Failed to fetch stand:", error);
      res.status(500).json({ error: "Failed to fetch stand" });
    }
  });

  // POST /api/stands - Create stand (admin only)
  app.post("/api/stands", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { stationId, identifier, materialId, qrCode, sequence, positionMeta, dailyFull } = req.body;
      
      if (!stationId || !identifier || !qrCode) {
        return res.status(400).json({ error: "stationId, identifier, and qrCode are required" });
      }

      const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      const [stand] = await db.insert(stands).values({
        stationId,
        identifier,
        materialId: materialId || null,
        qrCode,
        sequence: sequence || null,
        positionMeta: positionMeta || null,
        dailyFull: dailyFull || false,
      }).returning();

      res.status(201).json(stand);
    } catch (error) {
      console.error("Failed to create stand:", error);
      res.status(500).json({ error: "Failed to create stand" });
    }
  });

  // PUT /api/stands/:id - Update stand (admin only, including dailyFull flag)
  app.put("/api/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(stands).where(eq(stands.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const { identifier, materialId, qrCode, sequence, positionMeta, dailyFull, isActive } = req.body;
      
      const [stand] = await db.update(stands)
        .set({
          ...(identifier !== undefined && { identifier }),
          ...(materialId !== undefined && { materialId }),
          ...(qrCode !== undefined && { qrCode }),
          ...(sequence !== undefined && { sequence }),
          ...(positionMeta !== undefined && { positionMeta }),
          ...(dailyFull !== undefined && { dailyFull }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(stands.id, req.params.id))
        .returning();

      res.json(stand);
    } catch (error) {
      console.error("Failed to update stand:", error);
      res.status(500).json({ error: "Failed to update stand" });
    }
  });

  // PATCH /api/automotive/stands/:id - Update stand (supports dailyFull and dailyTaskTimeLocal)
  app.patch("/api/automotive/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(stands).where(eq(stands.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const { dailyFull, dailyTaskTimeLocal, identifier, materialId, qrCode, sequence, positionMeta, isActive } = req.body;
      
      const [stand] = await db.update(stands)
        .set({
          ...(dailyFull !== undefined && { dailyFull }),
          ...(dailyTaskTimeLocal !== undefined && { dailyTaskTimeLocal }),
          ...(identifier !== undefined && { identifier }),
          ...(materialId !== undefined && { materialId }),
          ...(qrCode !== undefined && { qrCode }),
          ...(sequence !== undefined && { sequence }),
          ...(positionMeta !== undefined && { positionMeta }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(stands.id, req.params.id))
        .returning();

      res.json(stand);
    } catch (error) {
      console.error("Failed to patch stand:", error);
      res.status(500).json({ error: "Failed to update stand" });
    }
  });

  // ----------------------------------------------------------------------------
  // BOXES CRUD
  // ----------------------------------------------------------------------------

  // GET /api/boxes - List boxes with optional filters (standId, includeInactive)
  app.get("/api/boxes", async (req, res) => {
    try {
      const { includeInactive, standId } = req.query;
      
      const conditions = [];
      
      if (includeInactive !== 'true') {
        conditions.push(eq(boxes.isActive, true));
      }
      
      if (standId) {
        conditions.push(eq(boxes.standId, standId as string));
      }
      
      const result = conditions.length > 0
        ? await db.select().from(boxes).where(and(...conditions))
        : await db.select().from(boxes);
      
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch boxes:", error);
      res.status(500).json({ error: "Failed to fetch boxes" });
    }
  });

  // GET /api/admin/stands/:standId/boxes - Get boxes at a specific stand (admin only)
  app.get("/api/admin/stands/:standId/boxes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { standId } = req.params;
      
      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }
      
      const result = await db.select().from(boxes).where(
        and(eq(boxes.standId, standId), eq(boxes.isActive, true))
      );
      
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch boxes for stand:", error);
      res.status(500).json({ error: "Failed to fetch boxes" });
    }
  });

  // POST /api/admin/stands/:standId/assign-box - Assign box to stand with conflict detection
  app.post("/api/admin/stands/:standId/assign-box", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { standId } = req.params;
      const { boxId, boxSerial, boxQr } = req.body;
      const authUser = (req as any).authUser;
      
      if (!boxId && !boxSerial && !boxQr) {
        return res.status(400).json({ error: "boxId, boxSerial oder boxQr erforderlich" });
      }
      
      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }
      
      let box;
      if (boxId) {
        [box] = await db.select().from(boxes).where(eq(boxes.id, boxId));
      } else if (boxSerial) {
        [box] = await db.select().from(boxes).where(eq(boxes.serial, boxSerial));
      } else if (boxQr) {
        [box] = await db.select().from(boxes).where(eq(boxes.qrCode, boxQr));
      }
      
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }
      
      if (!box.isActive) {
        return res.status(400).json({ error: "Box ist deaktiviert" });
      }
      
      if (box.standId !== null && box.standId !== standId) {
        const [currentStand] = await db.select().from(stands).where(eq(stands.id, box.standId));
        return res.status(409).json({ 
          error: "Box ist bereits an einem anderen Stellplatz platziert",
          currentStandId: box.standId,
          currentStandIdentifier: currentStand?.identifier || "Unbekannt"
        });
      }
      
      if (box.standId === standId) {
        return res.json({ 
          message: "Box ist bereits an diesem Stellplatz", 
          box,
          alreadyAssigned: true 
        });
      }
      
      const beforeData = { standId: box.standId, status: box.status };
      
      const [updatedBox] = await db.update(boxes)
        .set({
          standId,
          status: "AT_STAND",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, box.id))
        .returning();
      
      await db.insert(activityLogs).values({
        userId: authUser.id,
        action: "BOX_PLACED",
        entityType: "box",
        entityId: box.id,
        details: {
          boxSerial: box.serial,
          fromStandId: box.standId,
          toStandId: standId,
          standIdentifier: stand.identifier,
          before: beforeData,
          after: { standId, status: "AT_STAND" },
        },
      });
      
      const standMeta = await buildStandContextMeta(standId);
      await createAuditEvent({
        taskId: box.currentTaskId || box.id,
        actorUserId: authUser.id,
        action: "BOX_PLACED",
        entityType: "box",
        entityId: box.id,
        beforeData,
        afterData: { standId, status: "AT_STAND" },
        metaJson: { ...standMeta, boxId: box.id, source: "ADMIN_UI" },
      });
      
      res.json({ 
        message: "Box erfolgreich zugewiesen", 
        box: updatedBox 
      });
    } catch (error) {
      console.error("Failed to assign box to stand:", error);
      res.status(500).json({ error: "Zuweisung fehlgeschlagen" });
    }
  });

  // POST /api/admin/stands/:standId/unassign-box - Remove box from stand
  app.post("/api/admin/stands/:standId/unassign-box", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { standId } = req.params;
      const { boxId } = req.body;
      const authUser = (req as any).authUser;
      
      if (!boxId) {
        return res.status(400).json({ error: "boxId erforderlich" });
      }
      
      const [box] = await db.select().from(boxes).where(eq(boxes.id, boxId));
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }
      
      if (box.standId !== standId) {
        return res.status(400).json({ error: "Box ist nicht an diesem Stellplatz" });
      }
      
      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      const beforeData = { standId: box.standId, status: box.status };
      
      const [updatedBox] = await db.update(boxes)
        .set({
          standId: null,
          status: "IN_TRANSIT",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, boxId))
        .returning();
      
      await db.insert(activityLogs).values({
        userId: authUser.id,
        action: "BOX_UNPLACED",
        entityType: "box",
        entityId: boxId,
        details: {
          boxSerial: box.serial,
          fromStandId: standId,
          standIdentifier: stand?.identifier,
          before: beforeData,
          after: { standId: null, status: "IN_TRANSIT" },
        },
      });
      
      const standMeta = await buildStandContextMeta(standId);
      await createAuditEvent({
        taskId: box.currentTaskId || boxId,
        actorUserId: authUser.id,
        action: "BOX_UNPLACED",
        entityType: "box",
        entityId: boxId,
        beforeData,
        afterData: { standId: null, status: "IN_TRANSIT" },
        metaJson: { ...standMeta, boxId, source: "ADMIN_UI" },
      });
      
      res.json({ 
        message: "Box erfolgreich vom Stellplatz entfernt", 
        box: updatedBox 
      });
    } catch (error) {
      console.error("Failed to unassign box from stand:", error);
      res.status(500).json({ error: "Entfernung fehlgeschlagen" });
    }
  });

  // GET /api/boxes/qr/:qrCode - Look up box by QR code (must be before :id route)
  app.get("/api/boxes/qr/:qrCode", async (req, res) => {
    try {
      const [box] = await db.select().from(boxes).where(eq(boxes.qrCode, req.params.qrCode));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      res.json(box);
    } catch (error) {
      console.error("Failed to fetch box by QR:", error);
      res.status(500).json({ error: "Failed to fetch box" });
    }
  });

  // GET /api/boxes/:id - Get box by ID
  app.get("/api/boxes/:id", async (req, res) => {
    try {
      const [box] = await db.select().from(boxes).where(eq(boxes.id, req.params.id));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      res.json(box);
    } catch (error) {
      console.error("Failed to fetch box:", error);
      res.status(500).json({ error: "Failed to fetch box" });
    }
  });

  // POST /api/boxes - Create box (admin only)
  app.post("/api/boxes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { qrCode, serial, standId, status, notes } = req.body;
      
      if (!qrCode || !serial) {
        return res.status(400).json({ error: "qrCode and serial are required" });
      }

      const [box] = await db.insert(boxes).values({
        qrCode,
        serial,
        standId: standId || null,
        status: status || "AT_STAND",
        notes: notes || null,
      }).returning();

      res.status(201).json(box);
    } catch (error) {
      console.error("Failed to create box:", error);
      res.status(500).json({ error: "Failed to create box" });
    }
  });

  // PUT /api/boxes/:id - Update box (admin only)
  app.put("/api/boxes/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const [existing] = await db.select().from(boxes).where(eq(boxes.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Box not found" });
      }

      const { qrCode, serial, standId, status, notes, isActive } = req.body;
      const wasAtStand = existing.standId !== null;
      const beingRemovedFromStand = standId === null && wasAtStand;
      
      const [box] = await db.update(boxes)
        .set({
          ...(qrCode !== undefined && { qrCode }),
          ...(serial !== undefined && { serial }),
          ...(standId !== undefined && { standId }),
          ...(status !== undefined && { status }),
          ...(notes !== undefined && { notes }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, req.params.id))
        .returning();

      if (beingRemovedFromStand) {
        const standMeta = await buildStandContextMeta(existing.standId!);
        await createAuditEvent({
          taskId: existing.currentTaskId || req.params.id,
          actorUserId: authUser.id,
          action: "BOX_REMOVED",
          entityType: "box",
          entityId: existing.id,
          beforeData: { standId: existing.standId, status: existing.status },
          afterData: { standId: null, status: status || existing.status },
          metaJson: { ...standMeta, boxId: existing.id, source: "ADMIN_UI" },
        });
      }

      res.json(box);
    } catch (error) {
      console.error("Failed to update box:", error);
      res.status(500).json({ error: "Failed to update box" });
    }
  });

  // POST /api/boxes/:id/position - Position box at a stand
  app.post("/api/boxes/:id/position", requireAuth, async (req, res) => {
    try {
      const { stationId, standId } = req.body;
      const authUser = (req as any).authUser;
      
      if (!standId) {
        return res.status(400).json({ error: "standId is required" });
      }

      const [box] = await db.select().from(boxes).where(eq(boxes.id, req.params.id));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }

      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      const [hall] = await db.select().from(halls).where(eq(halls.id, station.hallId));
      
      let material = null;
      if (stand.materialId) {
        const [mat] = await db.select().from(materials).where(eq(materials.id, stand.materialId));
        material = mat;
      }

      const beforeData = { standId: box.standId, status: box.status };
      const placementChanged = box.standId !== standId;
      
      const [updatedBox] = await db.update(boxes)
        .set({
          standId,
          status: "AT_STAND",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, req.params.id))
        .returning();

      // Build metaJson context for the new stand
      const standMeta = await buildStandContextMeta(standId);
      const eventMetaJson = {
        ...standMeta,
        boxId: box.id,
        containerId: box.id,
        previousStandId: box.standId || undefined,
      };

      // Log PLACEMENT_CHANGED if stand actually changed, otherwise BOX_POSITIONED
      await createAuditEvent({
        taskId: box.currentTaskId || req.params.id,
        actorUserId: authUser.id,
        action: placementChanged ? "PLACEMENT_CHANGED" : "BOX_POSITIONED",
        entityType: "box",
        entityId: box.id,
        beforeData,
        afterData: { standId, status: "AT_STAND" },
        metaJson: eventMetaJson,
      });

      res.json({
        box: updatedBox,
        stand,
        material,
        station,
        hall,
      });
    } catch (error) {
      console.error("Failed to position box:", error);
      res.status(500).json({ error: "Failed to position box" });
    }
  });

  // ----------------------------------------------------------------------------
  // AUTOMOTIVE TASK ENDPOINTS
  // ----------------------------------------------------------------------------

  // GET /api/automotive/tasks - List all tasks with global visibility (no user filtering)
  // Query params: status, materialId, stationId, hallId, from, to, scheduledFor
  app.get("/api/automotive/tasks", requireAuth, async (req, res) => {
    try {
      const { status, materialId, stationId, hallId, from, to, scheduledFor } = req.query;
      
      const conditions: any[] = [];
      
      // Status filter
      if (status) {
        conditions.push(eq(tasks.status, status as string));
      }
      
      // Material filter
      if (materialId) {
        conditions.push(eq(tasks.materialType, materialId as string));
      }
      
      // Exact scheduledFor filter (for specific date match)
      if (scheduledFor) {
        const scheduledDate = new Date(scheduledFor as string);
        scheduledDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(scheduledDate);
        nextDay.setDate(nextDay.getDate() + 1);
        conditions.push(gte(tasks.scheduledFor, scheduledDate));
        conditions.push(lte(tasks.scheduledFor, nextDay));
      }
      
      // Date range filter (using scheduledFor)
      if (from) {
        conditions.push(gte(tasks.scheduledFor, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(tasks.scheduledFor, new Date(to as string)));
      }
      
      // Build query with joins for stationId and hallId filtering
      let query = db
        .select({
          task: tasks,
          stand: stands,
          station: stations,
          hall: halls,
          material: materials,
          claimedByUser: users,
        })
        .from(tasks)
        .leftJoin(stands, eq(tasks.standId, stands.id))
        .leftJoin(stations, eq(stands.stationId, stations.id))
        .leftJoin(halls, eq(stations.hallId, halls.id))
        .leftJoin(materials, eq(tasks.materialType, materials.id))
        .leftJoin(users, eq(tasks.claimedByUserId, users.id));
      
      // Station filter (needs join)
      if (stationId) {
        conditions.push(eq(stands.stationId, stationId as string));
      }
      
      // Hall filter (needs join)
      if (hallId) {
        conditions.push(eq(stations.hallId, hallId as string));
      }
      
      const result = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(tasks.createdAt))
        : await query.orderBy(desc(tasks.createdAt));
      
      // Flatten the result for easier consumption
      const tasksWithDetails = result.map(row => ({
        ...row.task,
        stand: row.stand,
        station: row.station,
        hall: row.hall,
        material: row.material,
        claimedByUser: row.claimedByUser ? {
          id: row.claimedByUser.id,
          name: row.claimedByUser.name,
          email: row.claimedByUser.email,
        } : null,
      }));
      
      res.json(tasksWithDetails);
    } catch (error) {
      console.error("Failed to fetch automotive tasks:", error);
      res.status(500).json({ error: "Failed to fetch automotive tasks" });
    }
  });

  // POST /api/automotive/tasks - Create automotive task
  app.post("/api/automotive/tasks", requireAuth, async (req, res) => {
    try {
      const { boxId, standId, taskType } = req.body;
      const authUser = (req as any).authUser;
      
      if (!boxId || !standId) {
        return res.status(400).json({ error: "boxId and standId are required" });
      }

      const validTaskTypes = ["MANUAL", "DAILY_FULL"];
      if (taskType && !validTaskTypes.includes(taskType)) {
        return res.status(400).json({ error: "taskType must be MANUAL or DAILY_FULL" });
      }

      const [box] = await db.select().from(boxes).where(eq(boxes.id, boxId));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }

      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const activeTaskStatuses = ["OPEN", "PICKED_UP", "IN_TRANSIT", "DROPPED_OFF", "TAKEN_OVER", "WEIGHED"];
      const existingActiveTasks = await db.select().from(tasks).where(
        and(
          eq(tasks.boxId, boxId),
          notInArray(tasks.status, ["DISPOSED", "CANCELLED"])
        )
      );

      if (existingActiveTasks.length > 0) {
        return res.status(409).json({ 
          error: "Box already has an active task",
          activeTask: existingActiveTasks[0]
        });
      }

      const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
      
      const [task] = await db.insert(tasks).values({
        title: `Automotive Task - Box ${box.serial}`,
        description: `Pick up box from stand ${stand.identifier}`,
        containerID: boxId,
        boxId,
        standId,
        materialType: stand.materialId ? stand.materialId : null,
        taskType: taskType || "MANUAL",
        status: "OPEN",
        createdBy: authUser.id,
        priority: "normal",
      }).returning();

      await db.update(boxes)
        .set({ currentTaskId: task.id, updatedAt: new Date() })
        .where(eq(boxes.id, boxId));

      // Comprehensive audit logging with metaJson context
      const standMeta = await buildStandContextMeta(standId);
      await createAuditEvent({
        taskId: task.id,
        actorUserId: authUser.id,
        action: "TASK_CREATED",
        entityType: "task",
        entityId: task.id,
        beforeData: null,
        afterData: { status: "OPEN", boxId, standId, taskType: taskType || "MANUAL" },
        metaJson: {
          ...standMeta,
          boxId,
          containerId: boxId,
          source: "MANUAL",
        },
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create automotive task:", error);
      res.status(500).json({ error: "Failed to create automotive task" });
    }
  });

  // PUT /api/automotive/tasks/:id/status - Update task status with transition guard
  // Auto-claims if not claimed, auto-releases on DROPPED_OFF
  // Requires mandatory box scans for status transitions
  app.put("/api/automotive/tasks/:id/status", requireAuth, async (req, res) => {
    try {
      const { status, weightKg, targetWarehouseContainerId, reason, scannedBoxId, scannedStandId } = req.body;
      const authUser = (req as any).authUser;
      
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }

      const [task] = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      try {
        assertAutomotiveTransition(task.status, status);
      } catch (error: any) {
        return res.status(409).json({ 
          error: error.message,
          currentStatus: task.status,
          requestedStatus: status
        });
      }

      // ========================================================================
      // MANDATORY BOX SCAN VALIDATION
      // All task transitions require a box scan to ensure physical verification
      // ========================================================================
      
      // Define which transitions require box scans
      const boxScanRequired = [
        { from: "OPEN", to: "PICKED_UP" },
        { from: "IN_TRANSIT", to: "DROPPED_OFF" },
        { from: "DROPPED_OFF", to: "TAKEN_OVER" },
        { from: "TAKEN_OVER", to: "WEIGHED" },
        { from: "WEIGHED", to: "DISPOSED" },
      ];
      
      const requiresBoxScan = boxScanRequired.some(
        (t) => t.from === task.status && t.to === status
      );
      
      if (requiresBoxScan && !scannedBoxId) {
        return res.status(400).json({ error: "Box-Scan erforderlich" });
      }
      
      // Validate scanned box matches the task's box (if box is already assigned)
      if (scannedBoxId && task.boxId && scannedBoxId !== task.boxId) {
        return res.status(400).json({ error: "Gescannte Box stimmt nicht mit der Aufgabe überein" });
      }
      
      // OPEN -> PICKED_UP: Validate box is at the task's stand
      if (task.status === "OPEN" && status === "PICKED_UP" && scannedBoxId) {
        const [scannedBox] = await db.select().from(boxes).where(eq(boxes.id, scannedBoxId));
        if (!scannedBox) {
          return res.status(404).json({ error: "Gescannte Box nicht gefunden" });
        }
        
        // If task has a standId, verify box is at that stand
        if (task.standId && scannedBox.standId !== task.standId) {
          return res.status(400).json({ error: "Box befindet sich nicht am richtigen Stand" });
        }
      }
      
      // IN_TRANSIT -> DROPPED_OFF: Requires both stand scan and box scan
      if (task.status === "IN_TRANSIT" && status === "DROPPED_OFF") {
        if (!scannedStandId) {
          return res.status(400).json({ error: "Stand-Scan erforderlich für Abgabe" });
        }
        // Verify stand exists
        const [scannedStand] = await db.select().from(stands).where(eq(stands.id, scannedStandId));
        if (!scannedStand) {
          return res.status(404).json({ error: "Gescannter Stand nicht gefunden" });
        }
      }

      if (task.status === "TAKEN_OVER" && status === "WEIGHED") {
        if (weightKg === undefined || weightKg === null) {
          return res.status(400).json({ error: "weightKg is required for WEIGHED status" });
        }
      }

      const now = new Date();
      let autoClaimed = false;
      let autoReleased = false;

      // Build metaJson context for audit events
      const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};

      // Auto-claim if not claimed or claim is expired
      if (!task.claimedByUserId || isClaimExpired(task.claimedAt)) {
        autoClaimed = true;
        // Log auto-claim event
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "AUTO_CLAIM",
          entityType: "task",
          entityId: task.id,
          beforeData: { claimedByUserId: task.claimedByUserId, claimedAt: task.claimedAt },
          afterData: { claimedByUserId: authUser.id, claimedAt: now },
          metaJson: {
            ...standMeta,
            boxId: task.boxId || undefined,
            reason: "Auto-claimed before status transition",
          },
        });
      }

      const beforeData = { 
        status: task.status, 
        weightKg: task.weightKg,
        targetWarehouseContainerId: task.targetWarehouseContainerId,
        claimedByUserId: task.claimedByUserId,
        claimedAt: task.claimedAt,
      };

      const updateData: any = {
        status,
        updatedAt: now,
      };

      // Assign scanned box to task if not already assigned
      if (scannedBoxId && !task.boxId) {
        updateData.boxId = scannedBoxId;
      }

      // Auto-claim if needed
      if (autoClaimed) {
        updateData.claimedByUserId = authUser.id;
        updateData.claimedAt = now;
      }

      // Auto-release on DROPPED_OFF transition
      if (status === "DROPPED_OFF") {
        updateData.claimedByUserId = null;
        updateData.claimedAt = null;
        autoReleased = true;
      }

      const timestampField = getAutomotiveTimestampFieldForStatus(status);
      if (timestampField) {
        updateData[timestampField] = now;
      }

      if (weightKg !== undefined) {
        updateData.weightKg = weightKg;
        updateData.weighedByUserId = authUser.id;
      }

      if (targetWarehouseContainerId !== undefined) {
        updateData.targetWarehouseContainerId = targetWarehouseContainerId;
      }

      if (reason !== undefined) {
        updateData.cancellationReason = reason;
      }

      const [updatedTask] = await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, req.params.id))
        .returning();

      // ========================================================================
      // BOX STATUS UPDATES BASED ON TRANSITION
      // ========================================================================
      const effectiveBoxId = scannedBoxId || task.boxId;
      
      // PICKED_UP: Remove box from stand, set status to IN_TRANSIT
      if (status === "PICKED_UP" && effectiveBoxId) {
        await db.update(boxes)
          .set({ 
            standId: null, 
            status: "IN_TRANSIT",
            currentTaskId: updatedTask.id,
            lastSeenAt: now,
            updatedAt: now 
          })
          .where(eq(boxes.id, effectiveBoxId));
          
        // Audit log for box removal from stand
        await createAuditEvent({
          taskId: updatedTask.id,
          actorUserId: authUser.id,
          action: "BOX_REMOVED",
          entityType: "box",
          entityId: effectiveBoxId,
          beforeData: { standId: task.standId, status: "AT_STAND" },
          afterData: { standId: null, status: "IN_TRANSIT" },
          metaJson: {
            ...standMeta,
            boxId: effectiveBoxId,
            source: "PICKUP_SCAN",
          },
        });
      }
      
      // DROPPED_OFF: Place box at scanned stand
      if (status === "DROPPED_OFF" && effectiveBoxId && scannedStandId) {
        await db.update(boxes)
          .set({ 
            standId: scannedStandId, 
            status: "AT_STAND",
            lastSeenAt: now,
            updatedAt: now 
          })
          .where(eq(boxes.id, effectiveBoxId));
          
        // Audit log for box placement at stand
        const dropStandMeta = await buildStandContextMeta(scannedStandId);
        await createAuditEvent({
          taskId: updatedTask.id,
          actorUserId: authUser.id,
          action: "BOX_PLACED",
          entityType: "box",
          entityId: effectiveBoxId,
          beforeData: { standId: null, status: "IN_TRANSIT" },
          afterData: { standId: scannedStandId, status: "AT_STAND" },
          metaJson: {
            ...dropStandMeta,
            boxId: effectiveBoxId,
            source: "DROPOFF_SCAN",
          },
        });
      }
      
      // DISPOSED or CANCELLED: Release box
      if (status === "DISPOSED" || status === "CANCELLED") {
        if (effectiveBoxId) {
          await db.update(boxes)
            .set({ 
              currentTaskId: null, 
              status: status === "DISPOSED" ? "AT_WAREHOUSE" : "AT_STAND",
              updatedAt: now 
            })
            .where(eq(boxes.id, effectiveBoxId));
        }
      }

      const eventMetaJson = {
        ...standMeta,
        boxId: task.boxId || undefined,
        containerId: task.boxId || undefined,
        targetWarehouseContainerId: updateData.targetWarehouseContainerId || undefined,
        autoClaimed,
        autoReleased,
      };

      // Log STATUS_CHANGED event
      await createAuditEvent({
        taskId: task.id,
        actorUserId: authUser.id,
        action: status === "CANCELLED" ? "STATUS_CHANGED" : `STATUS_${status}`,
        entityType: "task",
        entityId: task.id,
        beforeData,
        afterData: { 
          status, 
          weightKg: updateData.weightKg,
          targetWarehouseContainerId: updateData.targetWarehouseContainerId,
          claimedByUserId: updateData.claimedByUserId,
          reason
        },
        metaJson: eventMetaJson,
      });

      // Log auto-release event separately if it happened
      if (autoReleased) {
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "AUTO_RELEASE",
          entityType: "task",
          entityId: task.id,
          beforeData: { claimedByUserId: autoClaimed ? authUser.id : task.claimedByUserId },
          afterData: { claimedByUserId: null, claimedAt: null },
          metaJson: {
            ...standMeta,
            boxId: task.boxId || undefined,
            reason: "Auto-released on DROPPED_OFF transition",
          },
        });
      }

      // Log WEIGHT_RECORDED when weight is set during WEIGHED transition
      if (status === "WEIGHED" && weightKg !== undefined) {
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "WEIGHT_RECORDED",
          entityType: "task",
          entityId: task.id,
          beforeData: { weightKg: task.weightKg },
          afterData: { weightKg },
          metaJson: eventMetaJson,
        });
      }

      res.json({ ...updatedTask, autoClaimed, autoReleased });
    } catch (error) {
      console.error("Failed to update task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // GET /api/automotive/tasks/:id/suggest-container - Suggest warehouse container
  app.get("/api/automotive/tasks/:id/suggest-container", async (req, res) => {
    try {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      let materialId = task.materialType;
      
      if (task.standId) {
        const [stand] = await db.select().from(stands).where(eq(stands.id, task.standId));
        if (stand && stand.materialId) {
          materialId = stand.materialId;
        }
      }

      const containers = await db.select().from(warehouseContainers).where(
        and(
          eq(warehouseContainers.isActive, true),
          eq(warehouseContainers.isFull, false),
          eq(warehouseContainers.isBlocked, false),
          materialId ? eq(warehouseContainers.materialId, materialId) : isNull(warehouseContainers.materialId)
        )
      );

      const sortedContainers = containers
        .map(c => ({
          ...c,
          availableCapacity: c.maxCapacity - c.currentAmount
        }))
        .sort((a, b) => b.availableCapacity - a.availableCapacity);

      res.json(sortedContainers);
    } catch (error) {
      console.error("Failed to suggest container:", error);
      res.status(500).json({ error: "Failed to suggest container" });
    }
  });

  // POST /api/automotive/daily-tasks/generate - Generate daily tasks for dailyFull stands
  // Can be called by cron job or manually triggered by admin
  // Uses dedupKey to prevent duplicates and auto-cancels previous OPEN tasks
  app.post("/api/automotive/daily-tasks/generate", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const now = new Date();
      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(new Date());
      
      // AUTO_CANCEL_PREVIOUS: Cancel previous OPEN daily tasks from earlier dates
      const openDailyTasks = await db.select().from(tasks).where(
        and(eq(tasks.taskType, "DAILY_FULL"), eq(tasks.status, "OPEN"))
      );
      let cancelledCount = 0;
      for (const task of openDailyTasks) {
        if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
          await db.update(tasks).set({
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Auto-cancelled: New daily task generated",
            updatedAt: new Date()
          }).where(eq(tasks.id, task.id));
          cancelledCount++;
        }
      }
      
      // Find all stands with dailyFull=true
      const dailyFullStands = await db.select().from(stands).where(
        and(
          eq(stands.dailyFull, true),
          eq(stands.isActive, true)
        )
      );
      
      const createdTasks: any[] = [];
      const skipped: { standId: string; reason: string }[] = [];
      
      for (const stand of dailyFullStands) {
        const dedupKey = `DAILY:${stand.id}:${todayStr}`;
        
        try {
          // Create the daily task with boxId: null (assigned on pickup)
          const [task] = await db.insert(tasks).values({
            title: `Tägliche Abholung - Stand ${stand.identifier}`,
            description: `Automatisch generierte tägliche Abholung für Stand ${stand.identifier}`,
            containerID: null,
            boxId: null,
            standId: stand.id,
            materialType: stand.materialId || null,
            taskType: "DAILY_FULL",
            status: "OPEN",
            createdBy: authUser.id,
            priority: "normal",
            scheduledFor: today,
            dedupKey,
          }).returning();
          
          // Update stand's lastDailyTaskGeneratedAt
          await db.update(stands)
            .set({ lastDailyTaskGeneratedAt: now, updatedAt: new Date() })
            .where(eq(stands.id, stand.id));
          
          // Create task event
          await db.insert(taskEvents).values({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "TASK_CREATED",
            entityType: "task",
            entityId: task.id,
            beforeData: null,
            afterData: { status: "OPEN", boxId: null, standId: stand.id, taskType: "DAILY_FULL", dedupKey },
          });
          
          createdTasks.push({
            task,
            stand: { id: stand.id, identifier: stand.identifier },
          });
        } catch (e: any) {
          if (e?.code === '23505') {
            skipped.push({ standId: stand.id, reason: "Task already exists for today (dedupKey)" });
            continue;
          }
          throw e;
        }
      }
      
      res.json({
        success: true,
        createdCount: createdTasks.length,
        skippedCount: skipped.length,
        cancelledPreviousCount: cancelledCount,
        created: createdTasks,
        skipped: skipped,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Failed to generate daily tasks:", error);
      res.status(500).json({ error: "Failed to generate daily tasks" });
    }
  });

  // GET /api/automotive/daily-tasks/status - Check status of daily task generation
  app.get("/api/automotive/daily-tasks/status", async (req, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get all dailyFull stands
      const dailyFullStands = await db.select().from(stands).where(
        and(
          eq(stands.dailyFull, true),
          eq(stands.isActive, true)
        )
      );
      
      const status = dailyFullStands.map(stand => ({
        standId: stand.id,
        identifier: stand.identifier,
        lastGeneratedAt: stand.lastDailyTaskGeneratedAt?.toISOString() || null,
        generatedToday: stand.lastDailyTaskGeneratedAt ? stand.lastDailyTaskGeneratedAt >= todayStart : false,
      }));
      
      const totalStands = status.length;
      const generatedToday = status.filter(s => s.generatedToday).length;
      const pendingToday = totalStands - generatedToday;
      
      res.json({
        totalDailyFullStands: totalStands,
        generatedToday,
        pendingToday,
        stands: status,
        checkedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Failed to get daily tasks status:", error);
      res.status(500).json({ error: "Failed to get daily tasks status" });
    }
  });

  // GET /api/daily-tasks/today - Returns today's OPEN daily tasks (Europe/Berlin timezone)
  app.get("/api/daily-tasks/today", async (req, res) => {
    try {
      const todayStr = formatDateBerlin(new Date());
      const todayTasks = await db.select().from(tasks).where(
        and(
          eq(tasks.taskType, "DAILY_FULL"),
          eq(tasks.status, "OPEN")
        )
      );
      const filteredTasks = todayTasks.filter(t => 
        t.dedupKey?.startsWith(`DAILY:`) && t.dedupKey?.endsWith(`:${todayStr}`)
      );
      res.json(filteredTasks);
    } catch (error) {
      console.error("Failed to fetch today's daily tasks:", error);
      res.status(500).json({ error: "Failed to fetch today's daily tasks" });
    }
  });

  // POST /api/admin/daily-tasks/run - Admin-only, manually triggers daily task generation
  app.post("/api/admin/daily-tasks/run", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const now = new Date();
      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(new Date());
      
      // AUTO_CANCEL_PREVIOUS: Cancel previous OPEN daily tasks from earlier dates
      const openDailyTasks = await db.select().from(tasks).where(
        and(eq(tasks.taskType, "DAILY_FULL"), eq(tasks.status, "OPEN"))
      );
      let cancelledCount = 0;
      for (const task of openDailyTasks) {
        if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
          await db.update(tasks).set({
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Auto-cancelled: New daily task generated",
            updatedAt: new Date()
          }).where(eq(tasks.id, task.id));
          cancelledCount++;
        }
      }
      
      // Find all stands with dailyFull=true
      const dailyFullStands = await db.select().from(stands).where(
        and(
          eq(stands.dailyFull, true),
          eq(stands.isActive, true)
        )
      );
      
      const createdTasks: any[] = [];
      const skipped: { standId: string; reason: string }[] = [];
      
      for (const stand of dailyFullStands) {
        const dedupKey = `DAILY:${stand.id}:${todayStr}`;
        
        try {
          const [task] = await db.insert(tasks).values({
            title: `Tägliche Abholung - Stand ${stand.identifier}`,
            description: `Automatisch generierte tägliche Abholung für Stand ${stand.identifier}`,
            containerID: null,
            boxId: null,
            standId: stand.id,
            materialType: stand.materialId || null,
            taskType: "DAILY_FULL",
            status: "OPEN",
            createdBy: authUser.id,
            priority: "normal",
            scheduledFor: today,
            dedupKey,
          }).returning();
          
          await db.update(stands)
            .set({ lastDailyTaskGeneratedAt: now, updatedAt: new Date() })
            .where(eq(stands.id, stand.id));
          
          await db.insert(taskEvents).values({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "TASK_CREATED",
            entityType: "task",
            entityId: task.id,
            beforeData: null,
            afterData: { status: "OPEN", boxId: null, standId: stand.id, taskType: "DAILY_FULL", dedupKey },
          });
          
          createdTasks.push({
            task,
            stand: { id: stand.id, identifier: stand.identifier },
          });
        } catch (e: any) {
          if (e?.code === '23505') {
            skipped.push({ standId: stand.id, reason: "Task already exists for today (dedupKey)" });
            continue;
          }
          throw e;
        }
      }
      
      res.json({
        success: true,
        createdCount: createdTasks.length,
        skippedCount: skipped.length,
        cancelledPreviousCount: cancelledCount,
        created: createdTasks,
        skipped: skipped,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Failed to run daily tasks:", error);
      res.status(500).json({ error: "Failed to run daily tasks" });
    }
  });

  // ----------------------------------------------------------------------------
  // SCAN WORKFLOW ENDPOINTS
  // Place and pickup boxes via QR code scanning
  // ----------------------------------------------------------------------------

  // POST /api/scan/place-box - Place a box at a stand using QR codes
  // Auto-replaces any existing box on the stand
  app.post("/api/scan/place-box", requireAuth, async (req, res) => {
    try {
      const { standQr, boxQr, geo, locationDetails } = req.body;
      const authUser = (req as any).authUser;

      if (!standQr || !boxQr) {
        return res.status(400).json({ error: "standQr and boxQr are required" });
      }

      // Resolve stand by QR code
      const [stand] = await db.select().from(stands).where(eq(stands.qrCode, standQr));
      if (!stand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }

      // Resolve box by QR code
      const [box] = await db.select().from(boxes).where(eq(boxes.qrCode, boxQr));
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }

      // Get station and hall for context
      const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
      const [hall] = station ? await db.select().from(halls).where(eq(halls.id, station.hallId)) : [null];
      let material = null;
      if (stand.materialId) {
        const [mat] = await db.select().from(materials).where(eq(materials.id, stand.materialId));
        material = mat;
      }

      // Build context meta for audit events
      const standMeta = await buildStandContextMeta(stand.id);

      // AUTO-REPLACE: If another box is at this stand, remove it
      const existingBoxes = await db.select().from(boxes).where(
        and(eq(boxes.standId, stand.id), eq(boxes.status, "AT_STAND"))
      );
      
      for (const existingBox of existingBoxes) {
        if (existingBox.id !== box.id) {
          // Set existing box to IN_TRANSIT (removed from stand)
          await db.update(boxes)
            .set({
              standId: null,
              status: "IN_TRANSIT",
              updatedAt: new Date(),
            })
            .where(eq(boxes.id, existingBox.id));

          // Audit event for auto-replace
          await createAuditEvent({
            taskId: existingBox.currentTaskId || existingBox.id,
            actorUserId: authUser.id,
            action: "BOX_AUTO_REPLACED",
            entityType: "box",
            entityId: existingBox.id,
            beforeData: { standId: stand.id, status: "AT_STAND" },
            afterData: { standId: null, status: "IN_TRANSIT" },
            metaJson: {
              ...standMeta,
              boxId: existingBox.id,
              replacedByBoxId: box.id,
              source: "SCAN_PLACE_BOX",
            },
          });

          // Activity log for auto-replace
          await db.insert(activityLogs).values({
            type: "BOX_AUTO_REPLACED",
            action: "BOX_AUTO_REPLACED",
            message: `Box ${existingBox.serial} wurde automatisch vom Stellplatz ${stand.identifier} entfernt (ersetzt durch ${box.serial})`,
            userId: authUser.id,
            containerId: existingBox.id,
          });
        }
      }

      // Store previous state for audit
      const beforeData = { standId: box.standId, status: box.status };

      // Place the new box at the stand
      const [updatedBox] = await db.update(boxes)
        .set({
          standId: stand.id,
          status: "AT_STAND",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, box.id))
        .returning();

      // Create scan event
      const [scanEvent] = await db.insert(scanEvents).values({
        containerId: box.id,
        containerType: "box",
        taskId: box.currentTaskId || null,
        scannedByUserId: authUser.id,
        scanContext: "TASK_PICKUP",
        locationType: "OTHER",
        locationDetails: locationDetails || `Stellplatz ${stand.identifier}`,
        geoLocation: geo || null,
        scanResult: "SUCCESS",
        resultMessage: `Box ${box.serial} am Stellplatz ${stand.identifier} abgestellt`,
        extraData: { standId: stand.id, standQr, boxQr },
      }).returning();

      // Audit event for placement
      await createAuditEvent({
        taskId: box.currentTaskId || box.id,
        actorUserId: authUser.id,
        action: "BOX_PLACED",
        entityType: "box",
        entityId: box.id,
        beforeData,
        afterData: { standId: stand.id, status: "AT_STAND" },
        metaJson: {
          ...standMeta,
          boxId: box.id,
          previousStandId: beforeData.standId || undefined,
          source: "SCAN_PLACE_BOX",
        },
      });

      // Activity log for placement
      await db.insert(activityLogs).values({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_STATUS_CHANGED",
        message: `Box ${box.serial} wurde am Stellplatz ${stand.identifier} abgestellt`,
        userId: authUser.id,
        containerId: box.id,
        taskId: box.currentTaskId || null,
        scanEventId: scanEvent.id,
        location: geo || null,
      });

      // If task exists for this box, update to DROPPED_OFF
      if (box.currentTaskId) {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, box.currentTaskId));
        if (task && (task.status === "PICKED_UP" || task.status === "IN_TRANSIT")) {
          try {
            assertAutomotiveTransition(task.status, "DROPPED_OFF");
            const timestampField = getAutomotiveTimestampFieldForStatus("DROPPED_OFF");
            
            await db.update(tasks)
              .set({
                status: "DROPPED_OFF",
                [timestampField]: new Date(),
                updatedAt: new Date(),
                // Release claim when dropped off
                claimedByUserId: null,
                claimedAt: null,
              })
              .where(eq(tasks.id, task.id));

            await createAuditEvent({
              taskId: task.id,
              actorUserId: authUser.id,
              action: "STATUS_CHANGED",
              entityType: "task",
              entityId: task.id,
              beforeData: { status: task.status },
              afterData: { status: "DROPPED_OFF" },
              metaJson: {
                ...standMeta,
                boxId: box.id,
                source: "SCAN_PLACE_BOX",
              },
            });
          } catch (e) {
            console.log(`[PlaceBox] Task ${task.id} transition to DROPPED_OFF not allowed from ${task.status}`);
          }
        }
      }

      res.json({
        success: true,
        box: updatedBox,
        stand,
        station,
        hall,
        material,
        scanEvent,
        message: `Box ${box.serial} erfolgreich am Stellplatz ${stand.identifier} abgestellt`,
      });
    } catch (error) {
      console.error("Failed to place box:", error);
      res.status(500).json({ error: "Platzierung fehlgeschlagen" });
    }
  });

  // POST /api/scan/pickup-box - Pick up a box from its current stand
  app.post("/api/scan/pickup-box", requireAuth, async (req, res) => {
    try {
      const { boxQr, geo, locationDetails } = req.body;
      const authUser = (req as any).authUser;

      if (!boxQr) {
        return res.status(400).json({ error: "boxQr is required" });
      }

      // Resolve box by QR code
      const [box] = await db.select().from(boxes).where(eq(boxes.qrCode, boxQr));
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }

      // Store previous stand info for audit
      const previousStandId = box.standId;
      let previousStand = null;
      let previousStation = null;
      let previousHall = null;
      let previousMaterial = null;

      if (previousStandId) {
        const [stand] = await db.select().from(stands).where(eq(stands.id, previousStandId));
        previousStand = stand;
        if (stand) {
          const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
          previousStation = station;
          if (station) {
            const [hall] = await db.select().from(halls).where(eq(halls.id, station.hallId));
            previousHall = hall;
          }
          if (stand.materialId) {
            const [mat] = await db.select().from(materials).where(eq(materials.id, stand.materialId));
            previousMaterial = mat;
          }
        }
      }

      const beforeData = { standId: box.standId, status: box.status };

      // Update box: remove from stand, set to IN_TRANSIT
      const [updatedBox] = await db.update(boxes)
        .set({
          standId: null,
          status: "IN_TRANSIT",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, box.id))
        .returning();

      // Create scan event
      const [scanEvent] = await db.insert(scanEvents).values({
        containerId: box.id,
        containerType: "box",
        taskId: box.currentTaskId || null,
        scannedByUserId: authUser.id,
        scanContext: "TASK_PICKUP",
        locationType: previousStand ? "OTHER" : "WAREHOUSE",
        locationDetails: locationDetails || (previousStand ? `Abgeholt von ${previousStand.identifier}` : "Abgeholt"),
        geoLocation: geo || null,
        scanResult: "SUCCESS",
        resultMessage: `Box ${box.serial} abgeholt${previousStand ? ` von Stellplatz ${previousStand.identifier}` : ""}`,
        extraData: { previousStandId, boxQr },
      }).returning();

      // Build context meta
      const contextMeta = previousStandId ? await buildStandContextMeta(previousStandId) : { boxId: box.id };

      // Audit event for pickup
      await createAuditEvent({
        taskId: box.currentTaskId || box.id,
        actorUserId: authUser.id,
        action: "BOX_PICKED_UP",
        entityType: "box",
        entityId: box.id,
        beforeData,
        afterData: { standId: null, status: "IN_TRANSIT" },
        metaJson: {
          ...contextMeta,
          boxId: box.id,
          previousStandId: previousStandId || undefined,
          source: "SCAN_PICKUP_BOX",
        },
      });

      // Activity log for pickup
      await db.insert(activityLogs).values({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_STATUS_CHANGED",
        message: `Box ${box.serial} wurde abgeholt${previousStand ? ` vom Stellplatz ${previousStand.identifier}` : ""}`,
        userId: authUser.id,
        containerId: box.id,
        taskId: box.currentTaskId || null,
        scanEventId: scanEvent.id,
        location: geo || null,
        metadata: { previousStandId },
      });

      // If task exists for this box, update to PICKED_UP or IN_TRANSIT
      if (box.currentTaskId) {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, box.currentTaskId));
        if (task) {
          let newStatus = null;
          
          if (task.status === "OPEN") {
            newStatus = "PICKED_UP";
          } else if (task.status === "PICKED_UP") {
            newStatus = "IN_TRANSIT";
          }
          
          if (newStatus) {
            try {
              assertAutomotiveTransition(task.status, newStatus);
              const timestampField = getAutomotiveTimestampFieldForStatus(newStatus);
              
              await db.update(tasks)
                .set({
                  status: newStatus,
                  [timestampField]: new Date(),
                  claimedByUserId: authUser.id,
                  claimedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(tasks.id, task.id));

              await createAuditEvent({
                taskId: task.id,
                actorUserId: authUser.id,
                action: "STATUS_CHANGED",
                entityType: "task",
                entityId: task.id,
                beforeData: { status: task.status },
                afterData: { status: newStatus },
                metaJson: {
                  ...contextMeta,
                  boxId: box.id,
                  source: "SCAN_PICKUP_BOX",
                },
              });
            } catch (e) {
              console.log(`[PickupBox] Task ${task.id} transition to ${newStatus} not allowed from ${task.status}`);
            }
          }
        }
      }

      res.json({
        success: true,
        box: updatedBox,
        previousStand,
        previousStation,
        previousHall,
        previousMaterial,
        scanEvent,
        message: `Box ${box.serial} erfolgreich abgeholt${previousStand ? ` von Stellplatz ${previousStand.identifier}` : ""}`,
      });
    } catch (error) {
      console.error("Failed to pickup box:", error);
      res.status(500).json({ error: "Abholung fehlgeschlagen" });
    }
  });

  // ----------------------------------------------------------------------------
  // TASK EVENTS ENDPOINTS
  // ----------------------------------------------------------------------------

  // GET /api/task-events - Get all events for a task
  app.get("/api/task-events", async (req, res) => {
    try {
      const { taskId } = req.query;
      
      if (!taskId || typeof taskId !== 'string') {
        return res.status(400).json({ error: "taskId query parameter is required" });
      }

      const events = await db.select().from(taskEvents)
        .where(eq(taskEvents.taskId, taskId))
        .orderBy(desc(taskEvents.timestamp));

      res.json(events);
    } catch (error) {
      console.error("Failed to fetch task events:", error);
      res.status(500).json({ error: "Failed to fetch task events" });
    }
  });

  // GET /api/activity - Activity feed with filters and pagination
  app.get("/api/activity", async (req, res) => {
    try {
      const {
        from,
        to,
        materialId,
        stationId,
        hallId,
        userId,
        departmentId,
        action,
        page: pageParam,
        limit: limitParam,
      } = req.query;

      // Parse pagination params
      const page = Math.max(1, parseInt(pageParam as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(limitParam as string) || 50));
      const offset = (page - 1) * limit;

      // Build filter conditions
      const conditions: any[] = [];

      // Date range filters
      if (from && typeof from === 'string') {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          conditions.push(gte(taskEvents.timestamp, fromDate));
        }
      }
      if (to && typeof to === 'string') {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          conditions.push(lte(taskEvents.timestamp, toDate));
        }
      }

      // Actor filters
      if (userId && typeof userId === 'string') {
        conditions.push(eq(taskEvents.actorUserId, userId));
      }
      if (departmentId && typeof departmentId === 'string') {
        conditions.push(eq(taskEvents.actorDepartmentId, departmentId));
      }

      // Action filter (comma-separated for multiple)
      if (action && typeof action === 'string') {
        const actions = action.split(',').map(a => a.trim()).filter(a => a);
        if (actions.length === 1) {
          conditions.push(eq(taskEvents.action, actions[0]));
        } else if (actions.length > 1) {
          conditions.push(inArray(taskEvents.action, actions));
        }
      }

      // metaJson field filters using JSONB operators
      if (materialId && typeof materialId === 'string') {
        conditions.push(sql`${taskEvents.metaJson}->>'materialId' = ${materialId}`);
      }
      if (stationId && typeof stationId === 'string') {
        conditions.push(sql`${taskEvents.metaJson}->>'stationId' = ${stationId}`);
      }
      if (hallId && typeof hallId === 'string') {
        conditions.push(sql`${taskEvents.metaJson}->>'hallId' = ${hallId}`);
      }

      // Build where clause
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count for pagination
      const [countResult] = await db
        .select({ total: count() })
        .from(taskEvents)
        .where(whereClause);
      const total = Number(countResult?.total || 0);

      // Get events with actor name from users table
      const events = await db
        .select({
          id: taskEvents.id,
          timestamp: taskEvents.timestamp,
          action: taskEvents.action,
          actorUserId: taskEvents.actorUserId,
          actorName: users.name,
          actorRole: taskEvents.actorRole,
          actorDepartmentId: taskEvents.actorDepartmentId,
          entityType: taskEvents.entityType,
          entityId: taskEvents.entityId,
          beforeData: taskEvents.beforeData,
          afterData: taskEvents.afterData,
          metaJson: taskEvents.metaJson,
          taskId: taskEvents.taskId,
        })
        .from(taskEvents)
        .leftJoin(users, eq(taskEvents.actorUserId, users.id))
        .where(whereClause)
        .orderBy(desc(taskEvents.timestamp))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(total / limit);

      res.json({
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      console.error("Failed to fetch activity feed:", error);
      res.status(500).json({ error: "Failed to fetch activity feed" });
    }
  });

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  /**
   * GET /api/analytics/materials
   * Material amounts by period
   * Query params: from, to, groupBy (material|day|week|month)
   */
  app.get("/api/analytics/materials", requireAuth, async (req, res) => {
    try {
      const { from, to, groupBy = "material" } = req.query;
      
      const conditions: any[] = [eq(tasks.status, "DISPOSED")];
      
      if (from) {
        conditions.push(gte(tasks.disposedAt, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(tasks.disposedAt, new Date(to as string)));
      }

      if (groupBy === "material") {
        const result = await db
          .select({
            materialId: tasks.materialType,
            materialName: materials.name,
            totalWeightKg: sum(tasks.weightKg),
            taskCount: count(),
            avgLeadTimeMinutes: avg(sql`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
          })
          .from(tasks)
          .leftJoin(materials, eq(tasks.materialType, materials.id))
          .where(and(...conditions))
          .groupBy(tasks.materialType, materials.name);

        res.json(result);
      } else {
        let dateExpr: any;
        if (groupBy === "day") {
          dateExpr = sql`DATE(${tasks.disposedAt})`;
        } else if (groupBy === "week") {
          dateExpr = sql`DATE_TRUNC('week', ${tasks.disposedAt})`;
        } else if (groupBy === "month") {
          dateExpr = sql`DATE_TRUNC('month', ${tasks.disposedAt})`;
        } else {
          return res.status(400).json({ error: "Invalid groupBy parameter. Use: material, day, week, or month" });
        }

        const result = await db
          .select({
            period: dateExpr,
            totalWeightKg: sum(tasks.weightKg),
            taskCount: count(),
          })
          .from(tasks)
          .where(and(...conditions))
          .groupBy(dateExpr)
          .orderBy(dateExpr);

        res.json({ data: result, groupBy });
      }
    } catch (error) {
      console.error("[Analytics] Materials error:", error);
      res.status(500).json({ error: "Failed to fetch materials analytics" });
    }
  });

  /**
   * GET /api/analytics/stations
   * Material amounts per station
   * Query params: from, to
   */
  app.get("/api/analytics/stations", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      
      const conditions: any[] = [eq(tasks.status, "DISPOSED")];
      
      if (from) {
        conditions.push(gte(tasks.disposedAt, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(tasks.disposedAt, new Date(to as string)));
      }

      const result = await db
        .select({
          stationId: stands.stationId,
          stationName: stations.name,
          taskCount: count(),
          totalWeightKg: sum(tasks.weightKg),
          avgLeadTimeMinutes: avg(sql`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
        })
        .from(tasks)
        .innerJoin(stands, eq(tasks.standId, stands.id))
        .innerJoin(stations, eq(stands.stationId, stations.id))
        .where(and(...conditions))
        .groupBy(stands.stationId, stations.name);

      res.json(result);
    } catch (error) {
      console.error("[Analytics] Stations error:", error);
      res.status(500).json({ error: "Failed to fetch stations analytics" });
    }
  });

  /**
   * GET /api/analytics/halls
   * Material amounts per hall
   * Query params: from, to
   */
  app.get("/api/analytics/halls", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      
      const conditions: any[] = [eq(tasks.status, "DISPOSED")];
      
      if (from) {
        conditions.push(gte(tasks.disposedAt, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(tasks.disposedAt, new Date(to as string)));
      }

      const result = await db
        .select({
          hallId: stations.hallId,
          hallName: halls.name,
          taskCount: count(),
          totalWeightKg: sum(tasks.weightKg),
          avgLeadTimeMinutes: avg(sql`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
        })
        .from(tasks)
        .innerJoin(stands, eq(tasks.standId, stands.id))
        .innerJoin(stations, eq(stands.stationId, stations.id))
        .innerJoin(halls, eq(stations.hallId, halls.id))
        .where(and(...conditions))
        .groupBy(stations.hallId, halls.name);

      res.json(result);
    } catch (error) {
      console.error("[Analytics] Halls error:", error);
      res.status(500).json({ error: "Failed to fetch halls analytics" });
    }
  });

  /**
   * GET /api/analytics/users
   * User/driver performance
   * Query params: from, to
   */
  app.get("/api/analytics/users", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      
      const conditions: any[] = [eq(tasks.status, "DISPOSED")];
      
      if (from) {
        conditions.push(gte(tasks.disposedAt, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(tasks.disposedAt, new Date(to as string)));
      }

      const weighedByResult = await db
        .select({
          userId: tasks.weighedByUserId,
          userName: users.name,
          userEmail: users.email,
          role: sql`'weigher'`.as("role"),
          totalWeightKg: sum(tasks.weightKg),
          taskCount: count(),
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.weighedByUserId, users.id))
        .where(and(...conditions))
        .groupBy(tasks.weighedByUserId, users.name, users.email);

      const claimedByResult = await db
        .select({
          userId: tasks.claimedByUserId,
          userName: users.name,
          userEmail: users.email,
          role: sql`'driver'`.as("role"),
          totalWeightKg: sum(tasks.weightKg),
          taskCount: count(),
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.claimedByUserId, users.id))
        .where(and(...conditions))
        .groupBy(tasks.claimedByUserId, users.name, users.email);

      res.json({
        data: {
          byWeigher: weighedByResult,
          byDriver: claimedByResult,
        },
      });
    } catch (error) {
      console.error("[Analytics] Users error:", error);
      res.status(500).json({ error: "Failed to fetch users analytics" });
    }
  });

  /**
   * GET /api/analytics/departments
   * Department performance
   * Query params: from, to
   */
  app.get("/api/analytics/departments", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      
      const conditions: any[] = [eq(tasks.status, "DISPOSED")];
      
      if (from) {
        conditions.push(gte(tasks.disposedAt, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(tasks.disposedAt, new Date(to as string)));
      }

      const result = await db
        .select({
          departmentId: users.departmentId,
          departmentName: departments.name,
          departmentCode: departments.code,
          totalWeightKg: sum(tasks.weightKg),
          taskCount: count(),
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.claimedByUserId, users.id))
        .innerJoin(departments, eq(users.departmentId, departments.id))
        .where(and(...conditions))
        .groupBy(users.departmentId, departments.name, departments.code);

      res.json({ data: result });
    } catch (error) {
      console.error("[Analytics] Departments error:", error);
      res.status(500).json({ error: "Failed to fetch departments analytics" });
    }
  });

  /**
   * GET /api/analytics/lead-times
   * Average duration between statuses
   * Query params: from, to, by (material|station)
   */
  app.get("/api/analytics/lead-times", requireAuth, async (req, res) => {
    try {
      const { from, to, by } = req.query;
      
      const conditions: any[] = [eq(tasks.status, "DISPOSED")];
      
      if (from) {
        conditions.push(gte(tasks.disposedAt, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(tasks.disposedAt, new Date(to as string)));
      }

      if (by === "material") {
        const result = await db
          .select({
            groupId: tasks.materialType,
            groupName: materials.name,
            avgLeadTimeMinutes: avg(sql`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
            minLeadTimeMinutes: sql`MIN(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
            maxLeadTimeMinutes: sql`MAX(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
            taskCount: count(),
          })
          .from(tasks)
          .leftJoin(materials, eq(tasks.materialType, materials.id))
          .where(and(...conditions))
          .groupBy(tasks.materialType, materials.name);

        res.json(result);
      } else if (by === "station") {
        const result = await db
          .select({
            groupId: stands.stationId,
            groupName: stations.name,
            avgLeadTimeMinutes: avg(sql`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
            minLeadTimeMinutes: sql`MIN(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
            maxLeadTimeMinutes: sql`MAX(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
            taskCount: count(),
          })
          .from(tasks)
          .innerJoin(stands, eq(tasks.standId, stands.id))
          .innerJoin(stations, eq(stands.stationId, stations.id))
          .where(and(...conditions))
          .groupBy(stands.stationId, stations.name);

        res.json(result);
      } else {
        const result = await db
          .select({
            groupId: sql`'overall'`.as("groupId"),
            groupName: sql`'All Tasks'`.as("groupName"),
            avgLeadTimeMinutes: avg(sql`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
            minLeadTimeMinutes: sql`MIN(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
            maxLeadTimeMinutes: sql`MAX(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
            taskCount: count(),
          })
          .from(tasks)
          .where(and(...conditions));

        res.json(result);
      }
    } catch (error) {
      console.error("[Analytics] Lead times error:", error);
      res.status(500).json({ error: "Failed to fetch lead times analytics" });
    }
  });

  /**
   * GET /api/analytics/backlog
   * Overdue/stuck tasks
   * Query params: olderThanHours (default: 24)
   */
  app.get("/api/analytics/backlog", requireAuth, async (req, res) => {
    try {
      const olderThanHours = parseInt(req.query.olderThanHours as string) || 24;
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

      const activeStatuses = ["OPEN", "PICKED_UP", "IN_TRANSIT", "DROPPED_OFF", "TAKEN_OVER", "WEIGHED"];
      
      const result = await db
        .select({
          taskId: tasks.id,
          title: tasks.title,
          status: tasks.status,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          standId: tasks.standId,
          standIdentifier: stands.identifier,
        })
        .from(tasks)
        .leftJoin(stands, eq(tasks.standId, stands.id))
        .where(
          and(
            inArray(tasks.status, activeStatuses),
            lte(tasks.updatedAt, cutoffTime)
          )
        )
        .orderBy(tasks.updatedAt);

      const now = Date.now();
      const tasksWithHours = result.map(task => ({
        ...task,
        hoursInStatus: task.updatedAt ? Math.round((now - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60)) : null,
      }));

      res.json(tasksWithHours);
    } catch (error) {
      console.error("[Analytics] Backlog error:", error);
      res.status(500).json({ error: "Failed to fetch backlog analytics" });
    }
  });

  // ============================================================================
  // ADMIN MANUAL TASK CREATION
  // ============================================================================

  /**
   * GET /api/admin/stands-with-materials
   * Returns stands with their material names joined for a given station
   * Query params: stationId (required)
   */
  app.get("/api/admin/stands-with-materials", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { stationId } = req.query;
      if (!stationId) {
        return res.status(400).json({ error: "stationId required" });
      }

      const result = await db.select({
        id: stands.id,
        identifier: stands.identifier,
        materialId: stands.materialId,
        materialName: materials.name,
        materialCode: materials.code,
      })
      .from(stands)
      .leftJoin(materials, eq(stands.materialId, materials.id))
      .where(and(eq(stands.stationId, stationId as string), eq(stands.isActive, true)));

      res.json(result);
    } catch (error) {
      console.error("[Admin] Failed to fetch stands with materials:", error);
      res.status(500).json({ error: "Failed to fetch stands" });
    }
  });

  // ============================================================================
  // KAISERSLAUTERN FACTORY SEED ENDPOINT
  // ============================================================================

  /**
   * POST /api/seed/kaiserslautern
   * Seeds the Kaiserslautern factory map data (halls, stations, stands)
   * Idempotent: skips records that already exist
   */
  app.post("/api/seed/kaiserslautern", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log("[Seed] Starting Kaiserslautern factory seeding...");
      
      const seeded = {
        halls: { created: 0, skipped: 0 },
        stations: { created: 0, skipped: 0 },
        stands: { created: 0, skipped: 0 },
      };

      // Hall data from CSV (on OUT map)
      const hallsData = [
        { code: "K70", name: "Bau K70", x: 0.25, y: 0.37 },
        { code: "K25", name: "Bau K25", x: 0.44, y: 0.23 },
        { code: "K19", name: "Bau K19", x: 0.45, y: 0.34 },
        { code: "K18", name: "Bau K18", x: 0.56, y: 0.28 },
        { code: "K30", name: "Bau K30", x: 0.34, y: 0.60 },
        { code: "K16", name: "Bau K16", x: 0.73, y: 0.33 },
        { code: "K13", name: "Bau K13", x: 0.81, y: 0.76 },
      ];

      // Station data from CSV (each station belongs to a hall)
      const stationsData = [
        { code: "K13-S01", hallCode: "K13", name: "Cluster 338-340", x: 0.11, y: 0.46, label: "Cluster 338-340 (links)" },
        { code: "K18-S01", hallCode: "K18", name: "Cluster 712/623/615", x: 0.54, y: 0.22, label: "Cluster 712/623/615 (oben)" },
        { code: "K18-S02", hallCode: "K18", name: "Cluster 646/647/653", x: 0.76, y: 0.52, label: "Cluster 646/647/653 (rechts)" },
        { code: "K18-S03", hallCode: "K18", name: "Cluster 655/656", x: 0.79, y: 0.86, label: "Cluster 655/656 (unten rechts)" },
        { code: "K18-S04", hallCode: "K18", name: "Cluster 680-683", x: 0.32, y: 0.75, label: "Cluster 680-683 (links unten)" },
        { code: "K19-S01", hallCode: "K19", name: "Cluster 625-627", x: 0.21, y: 0.46, label: "Cluster 625-627 (links)" },
        { code: "K19-S02", hallCode: "K19", name: "Cluster 701/702/710/711", x: 0.36, y: 0.17, label: "Cluster 701/702/710/711 (oben links)" },
        { code: "K19-S03", hallCode: "K19", name: "Cluster 604/605/606/612", x: 0.67, y: 0.14, label: "Cluster 604/605/606/612 (oben rechts)" },
        { code: "K19-S04", hallCode: "K19", name: "Cluster 201/62/616/617", x: 0.49, y: 0.48, label: "Cluster 201/62/616/617 (Mitte)" },
        { code: "K19-S05", hallCode: "K19", name: "Cluster 629-633", x: 0.37, y: 0.86, label: "Cluster 629-633 (unten Mitte)" },
        { code: "K19-S06", hallCode: "K19", name: "Cluster 608-611/602/609/610", x: 0.71, y: 0.80, label: "Cluster 608-611/602/609/610 (unten rechts)" },
        { code: "K25-S01", hallCode: "K25", name: "Cluster 36/37/47", x: 0.10, y: 0.65, label: "Cluster 36/37/47 (links unten)" },
        { code: "K25-S02", hallCode: "K25", name: "Cluster 706", x: 0.19, y: 0.52, label: "Cluster 706 (links Mitte)" },
        { code: "K25-S03", hallCode: "K25", name: "Cluster 67/68/69/660", x: 0.53, y: 0.66, label: "Cluster 67/68/69/660 (unten Mitte)" },
        { code: "K25-S04", hallCode: "K25", name: "Cluster 225-228/224", x: 0.71, y: 0.62, label: "Cluster 225-228/224 (rechts)" },
        { code: "K25-S05", hallCode: "K25", name: "Cluster 41/663", x: 0.81, y: 0.17, label: "Cluster 41/663 (oben rechts)" },
        { code: "K25-S06", hallCode: "K25", name: "Cluster 672/714", x: 0.07, y: 0.35, label: "Cluster 672/714 (oben links)" },
      ];

      // Helper: Parse stand identifiers from cluster label
      function parseStandIdentifiers(label: string): string[] {
        const identifiers: string[] = [];
        const match = label.match(/Cluster\s+([\d\/\-,\s]+)/);
        if (!match) return identifiers;
        
        const parts = match[1].split(/[\/,]/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes("-")) {
            const [start, end] = trimmed.split("-").map(s => parseInt(s.trim(), 10));
            if (!isNaN(start) && !isNaN(end) && end > start && (end - start) < 20) {
              for (let i = start; i <= end; i++) {
                identifiers.push(String(i));
              }
            }
          } else {
            const num = parseInt(trimmed, 10);
            if (!isNaN(num)) {
              identifiers.push(String(num));
            }
          }
        }
        return identifiers;
      }

      // Step 1: Create halls
      const hallIdMap: Record<string, string> = {};
      for (const h of hallsData) {
        const [existing] = await db.select().from(halls).where(eq(halls.code, h.code));
        if (existing) {
          hallIdMap[h.code] = existing.id;
          seeded.halls.skipped++;
        } else {
          const [created] = await db.insert(halls).values({
            name: h.name,
            code: h.code,
            positionMeta: { x: h.x, y: h.y, mapCode: "OUT" },
          }).returning();
          hallIdMap[h.code] = created.id;
          seeded.halls.created++;
        }
      }

      // Step 2: Create stations
      const stationIdMap: Record<string, string> = {};
      for (const s of stationsData) {
        const hallId = hallIdMap[s.hallCode];
        if (!hallId) {
          console.warn(`[Seed] Hall ${s.hallCode} not found for station ${s.code}`);
          continue;
        }

        const [existing] = await db.select().from(stations).where(eq(stations.code, s.code));
        if (existing) {
          stationIdMap[s.code] = existing.id;
          seeded.stations.skipped++;
        } else {
          const [created] = await db.insert(stations).values({
            hallId,
            name: s.name,
            code: s.code,
            positionMeta: { x: s.x, y: s.y, mapCode: s.hallCode, label: s.label },
          }).returning();
          stationIdMap[s.code] = created.id;
          seeded.stations.created++;
        }
      }

      // Step 3: Create stands from labels
      for (const s of stationsData) {
        const stationId = stationIdMap[s.code];
        if (!stationId) continue;

        const standIdentifiers = parseStandIdentifiers(s.label);
        for (const identifier of standIdentifiers) {
          const fullId = `${s.hallCode}-${identifier}`;
          const qrCode = JSON.stringify({ t: "STAND", id: fullId });

          const [existing] = await db.select().from(stands).where(eq(stands.qrCode, qrCode));
          if (existing) {
            seeded.stands.skipped++;
          } else {
            try {
              await db.insert(stands).values({
                stationId,
                identifier,
                qrCode,
              });
              seeded.stands.created++;
            } catch (err: any) {
              if (err?.code === '23505') {
                seeded.stands.skipped++;
              } else {
                console.error(`[Seed] Failed to create stand ${fullId}:`, err);
              }
            }
          }
        }
      }

      console.log("[Seed] Kaiserslautern seeding complete:", seeded);
      res.json({
        success: true,
        message: "Kaiserslautern factory data seeded",
        seeded,
      });
    } catch (error) {
      console.error("[Seed] Kaiserslautern seeding failed:", error);
      res.status(500).json({ error: "Failed to seed factory data" });
    }
  });

  // ============================================================================
  // ADMIN MAP EDITOR ENDPOINTS
  // ============================================================================

  /**
   * PATCH /api/admin/halls/:id/map-marker
   * Set hall marker position on OUT map (normalized 0..1)
   */
  app.patch("/api/admin/halls/:id/map-marker", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { x, y } = req.body;
      const authUser = (req as any).authUser;

      if (x === undefined && y === undefined) {
        return res.status(400).json({ error: "x oder y Koordinate erforderlich" });
      }

      if (x !== null && (typeof x !== "number" || x < 0 || x > 1)) {
        return res.status(400).json({ error: "x muss eine Zahl zwischen 0 und 1 sein" });
      }
      if (y !== null && (typeof y !== "number" || y < 0 || y > 1)) {
        return res.status(400).json({ error: "y muss eine Zahl zwischen 0 und 1 sein" });
      }

      const [hall] = await db.select().from(halls).where(eq(halls.id, req.params.id));
      if (!hall) {
        return res.status(404).json({ error: "Halle nicht gefunden" });
      }

      const beforeLocationMeta = hall.locationMeta;
      let newLocationMeta: any;

      if (x === null && y === null) {
        newLocationMeta = { ...(hall.locationMeta as any || {}), mapMarker: null };
      } else {
        newLocationMeta = {
          ...(hall.locationMeta as any || {}),
          mapMarker: { x, y },
        };
      }

      const [updatedHall] = await db.update(halls)
        .set({ locationMeta: newLocationMeta, updatedAt: new Date() })
        .where(eq(halls.id, req.params.id))
        .returning();

      await db.insert(activityLogs).values({
        type: "MANUAL_EDIT",
        action: "MAP_HALL_MARKER_SET",
        message: `Hallenmarker für ${hall.name} (${hall.code}) gesetzt`,
        userId: authUser.id,
        metadata: {
          entityType: "hall",
          entityId: req.params.id,
          hallCode: hall.code,
          hallName: hall.name,
          before: beforeLocationMeta,
          after: newLocationMeta,
          x,
          y,
          mapKey: "OUT.png",
        },
      });

      res.json({
        ...updatedHall,
        mapMarker: newLocationMeta?.mapMarker || null,
      });
    } catch (error) {
      console.error("[MapEditor] Failed to set hall marker:", error);
      res.status(500).json({ error: "Fehler beim Setzen des Hallenmarkers" });
    }
  });

  /**
   * GET /api/admin/halls/:id/map-marker
   * Get hall marker position from locationMeta
   */
  app.get("/api/admin/halls/:id/map-marker", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [hall] = await db.select().from(halls).where(eq(halls.id, req.params.id));
      if (!hall) {
        return res.status(404).json({ error: "Halle nicht gefunden" });
      }

      const locationMeta = hall.locationMeta as any;
      res.json({
        hallId: hall.id,
        hallCode: hall.code,
        hallName: hall.name,
        mapMarker: locationMeta?.mapMarker || null,
      });
    } catch (error) {
      console.error("[MapEditor] Failed to get hall marker:", error);
      res.status(500).json({ error: "Fehler beim Abrufen des Hallenmarkers" });
    }
  });

  /**
   * PATCH /api/admin/stations/:id/position
   * Set station marker position on hall map (normalized 0..1)
   */
  app.patch("/api/admin/stations/:id/position", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { x, y } = req.body;
      const authUser = (req as any).authUser;

      if (x === undefined && y === undefined) {
        return res.status(400).json({ error: "x oder y Koordinate erforderlich" });
      }

      if (x !== null && (typeof x !== "number" || x < 0 || x > 1)) {
        return res.status(400).json({ error: "x muss eine Zahl zwischen 0 und 1 sein" });
      }
      if (y !== null && (typeof y !== "number" || y < 0 || y > 1)) {
        return res.status(400).json({ error: "y muss eine Zahl zwischen 0 und 1 sein" });
      }

      const [station] = await db.select().from(stations).where(eq(stations.id, req.params.id));
      if (!station) {
        return res.status(404).json({ error: "Station nicht gefunden" });
      }

      const [hall] = await db.select().from(halls).where(eq(halls.id, station.hallId));

      const beforeLocationMeta = station.locationMeta;
      let newLocationMeta: any;

      if (x === null && y === null) {
        newLocationMeta = null;
      } else {
        newLocationMeta = { x, y };
      }

      const [updatedStation] = await db.update(stations)
        .set({ locationMeta: newLocationMeta, updatedAt: new Date() })
        .where(eq(stations.id, req.params.id))
        .returning();

      await db.insert(activityLogs).values({
        type: "MANUAL_EDIT",
        action: "MAP_STATION_MARKER_SET",
        message: `Stationsposition für ${station.name} (${station.code}) gesetzt`,
        userId: authUser.id,
        metadata: {
          entityType: "station",
          entityId: req.params.id,
          stationCode: station.code,
          stationName: station.name,
          hallId: station.hallId,
          hallCode: hall?.code,
          before: beforeLocationMeta,
          after: newLocationMeta,
          x,
          y,
          mapKey: hall?.code ? `${hall.code}.png` : null,
        },
      });

      res.json({
        ...updatedStation,
        position: newLocationMeta,
      });
    } catch (error) {
      console.error("[MapEditor] Failed to set station position:", error);
      res.status(500).json({ error: "Fehler beim Setzen der Stationsposition" });
    }
  });

  /**
   * GET /api/admin/map-editor/data
   * Returns all halls and stations with their marker positions for admin editor
   */
  app.get("/api/admin/map-editor/data", requireAuth, requireAdmin, async (req, res) => {
    try {
      const hallsResult = await db.select().from(halls);
      const stationsResult = await db.select().from(stations);

      const hallsWithMarkers = hallsResult.map(h => {
        const locationMeta = h.locationMeta as any;
        return {
          id: h.id,
          code: h.code,
          name: h.name,
          isActive: h.isActive,
          mapMarker: locationMeta?.mapMarker || null,
          mapImageKey: locationMeta?.mapImageKey || (h.code === "OUT" ? "OUT.png" : `${h.code}.png`),
        };
      });

      const stationsWithPositions = stationsResult.map(s => {
        const locationMeta = s.locationMeta as any;
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          hallId: s.hallId,
          isActive: s.isActive,
          position: locationMeta ? { x: locationMeta.x, y: locationMeta.y } : null,
        };
      });

      const hallsWithoutMarkers = hallsWithMarkers.filter(h => !h.mapMarker && h.code !== "OUT");
      const stationsWithoutPosition = stationsWithPositions.filter(s => !s.position);

      res.json({
        halls: hallsWithMarkers,
        stations: stationsWithPositions,
        missing: {
          halls: hallsWithoutMarkers,
          stations: stationsWithoutPosition,
        },
      });
    } catch (error) {
      console.error("[MapEditor] Failed to fetch data:", error);
      res.status(500).json({ error: "Failed to fetch map editor data" });
    }
  });

  /**
   * GET /api/factory/map-data
   * Returns halls, stations and their positions for map rendering (user view)
   * Uses locationMeta for marker positions
   */
  app.get("/api/factory/map-data", async (req, res) => {
    try {
      const hallsResult = await db.select().from(halls).where(eq(halls.isActive, true));
      const stationsResult = await db.select().from(stations).where(eq(stations.isActive, true));
      
      res.json({
        halls: hallsResult.map(h => {
          const locationMeta = h.locationMeta as any;
          return {
            id: h.id,
            code: h.code,
            name: h.name,
            positionMeta: locationMeta?.mapMarker || h.positionMeta,
          };
        }),
        stations: stationsResult.map(s => {
          const locationMeta = s.locationMeta as any;
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            hallId: s.hallId,
            positionMeta: locationMeta ? { x: locationMeta.x, y: locationMeta.y } : s.positionMeta,
          };
        }),
      });
    } catch (error) {
      console.error("[MapData] Failed to fetch:", error);
      res.status(500).json({ error: "Failed to fetch map data" });
    }
  });

  // ============================================================================
  // QR CENTER ENDPOINTS
  // QR-Center only shows: STATION, STAND, BOX (no HALL per requirements)
  // ============================================================================

  const QR_ENTITY_TYPES = ["STATION", "STAND", "BOX"] as const;
  type QREntityType = typeof QR_ENTITY_TYPES[number];

  interface QrEntityRow {
    id: string;
    title: string;
    subtitle: string | null;
    qr_code: string | null;
    has_qr: boolean;
  }

  function generateQrCode(type: QREntityType, id: string, version?: string): string {
    const payload: { t: string; id: string; v?: string } = { t: type, id };
    if (version) {
      payload.v = version;
    }
    return JSON.stringify(payload);
  }

  function generateRandomVersion(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * GET /api/qr/entities
   * List entities with QR codes for QR-Center (Station, Stand, Box only - no Halls)
   * Query params: type (STATION|STAND|BOX), query (search string)
   * Returns unified QrEntityRow[]: { id, title, subtitle, qr_code, has_qr }
   */
  app.get("/api/qr/entities", requireAuth, async (req, res) => {
    try {
      const { type, query } = req.query;
      const entityType = type as QREntityType | undefined;
      const searchQuery = query as string | undefined;

      if (entityType && !QR_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${QR_ENTITY_TYPES.join(", ")}` });
      }

      const results: QrEntityRow[] = [];
      const searchPattern = searchQuery ? `%${searchQuery}%` : null;

      // Stations - search by code/name
      if (!entityType || entityType === "STATION") {
        let stationQuery = db.select().from(stations).where(eq(stations.isActive, true));
        if (searchPattern) {
          stationQuery = db.select().from(stations).where(
            and(
              eq(stations.isActive, true),
              or(ilike(stations.code, searchPattern), ilike(stations.name, searchPattern))
            )
          );
        }
        const stationsResult = await stationQuery;
        const hallsForStations = await db.select().from(halls);
        const hallMap = new Map(hallsForStations.map(h => [h.id, h]));
        
        for (const s of stationsResult) {
          const hall = hallMap.get(s.hallId);
          results.push({
            id: s.id,
            title: `${s.code} - ${s.name}`,
            subtitle: hall ? `Halle: ${hall.name}` : null,
            qr_code: s.qrCode || null,
            has_qr: !!s.qrCode,
          });
        }
      }

      // Stands - search by identifier
      if (!entityType || entityType === "STAND") {
        let standQuery = db.select().from(stands).where(eq(stands.isActive, true));
        if (searchPattern) {
          standQuery = db.select().from(stands).where(
            and(eq(stands.isActive, true), ilike(stands.identifier, searchPattern))
          );
        }
        const standsResult = await standQuery;
        const stationsForStands = await db.select().from(stations);
        const stationMap = new Map(stationsForStands.map(st => [st.id, st]));
        const materialsForStands = await db.select().from(materials);
        const materialMap = new Map(materialsForStands.map(m => [m.id, m]));
        
        for (const st of standsResult) {
          const station = stationMap.get(st.stationId);
          const material = st.materialId ? materialMap.get(st.materialId) : null;
          results.push({
            id: st.id,
            title: `Stellplatz ${st.identifier}`,
            subtitle: station ? `Station: ${station.name}${material ? ` | Material: ${material.name}` : ''}` : null,
            qr_code: st.qrCode || null,
            has_qr: !!st.qrCode,
          });
        }
      }

      // Boxes - search by serial
      if (!entityType || entityType === "BOX") {
        let boxQuery = db.select().from(boxes).where(eq(boxes.isActive, true));
        if (searchPattern) {
          boxQuery = db.select().from(boxes).where(
            and(eq(boxes.isActive, true), ilike(boxes.serial, searchPattern))
          );
        }
        const boxesResult = await boxQuery;
        for (const b of boxesResult) {
          results.push({
            id: b.id,
            title: `Box ${b.serial}`,
            subtitle: `Status: ${b.status}`,
            qr_code: b.qrCode || null,
            has_qr: !!b.qrCode,
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("[QRCenter] Failed to fetch entities:", error);
      res.status(500).json({ error: "Failed to fetch QR entities" });
    }
  });

  /**
   * POST /api/qr/ensure
   * Ensure entity has a QR code - generate if empty, otherwise no-op
   * Body: { type: "STATION"|"STAND"|"BOX", id: string }
   * Returns: { qr_code: string }
   * Role: Open to all authenticated users
   */
  app.post("/api/qr/ensure", requireAuth, async (req, res) => {
    try {
      const { type, id } = req.body;
      const authUser = (req as any).authUser;

      if (!type || !id) {
        return res.status(400).json({ error: "type and id are required" });
      }

      if (!QR_ENTITY_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${QR_ENTITY_TYPES.join(", ")}` });
      }

      let existingQrCode: string | null = null;
      let entityFound = false;
      let entityDisplayName = "";
      let wasGenerated = false;

      switch (type) {
        case "STATION": {
          const [station] = await db.select().from(stations).where(eq(stations.id, id));
          if (station) {
            entityFound = true;
            entityDisplayName = `${station.code} - ${station.name}`;
            existingQrCode = station.qrCode;
            if (!existingQrCode) {
              const newQrCode = generateQrCode("STATION", id);
              await db.update(stations).set({ qrCode: newQrCode, updatedAt: new Date() }).where(eq(stations.id, id));
              existingQrCode = newQrCode;
              wasGenerated = true;
            }
          }
          break;
        }
        case "STAND": {
          const [stand] = await db.select().from(stands).where(eq(stands.id, id));
          if (stand) {
            entityFound = true;
            entityDisplayName = `Stellplatz ${stand.identifier}`;
            existingQrCode = stand.qrCode;
            if (!existingQrCode) {
              const newQrCode = generateQrCode("STAND", id);
              await db.update(stands).set({ qrCode: newQrCode, updatedAt: new Date() }).where(eq(stands.id, id));
              existingQrCode = newQrCode;
              wasGenerated = true;
            }
          }
          break;
        }
        case "BOX": {
          const [box] = await db.select().from(boxes).where(eq(boxes.id, id));
          if (box) {
            entityFound = true;
            entityDisplayName = `Box ${box.serial}`;
            existingQrCode = box.qrCode;
            if (!existingQrCode) {
              const newQrCode = generateQrCode("BOX", id);
              await db.update(boxes).set({ qrCode: newQrCode, updatedAt: new Date() }).where(eq(boxes.id, id));
              existingQrCode = newQrCode;
              wasGenerated = true;
            }
          }
          break;
        }
      }

      if (!entityFound) {
        return res.status(404).json({ error: `${type} with id ${id} not found` });
      }

      // Log audit event if QR was generated
      if (wasGenerated) {
        await db.insert(activityLogs).values({
          type: "QR",
          action: "QR_ENSURE",
          message: `QR-Code für ${type} "${entityDisplayName}" generiert`,
          userId: authUser?.id,
          metadata: {
            entityType: type,
            entityId: id,
            entityDisplayName,
            newQrCode: existingQrCode,
          },
        });
      }

      res.json({ qr_code: existingQrCode });
    } catch (error) {
      console.error("[QRCenter] Failed to ensure QR code:", error);
      res.status(500).json({ error: "Failed to ensure QR code" });
    }
  });

  /**
   * POST /api/qr/regenerate
   * Regenerate QR code for an entity (Admin only)
   * Body: { type: "STATION"|"STAND"|"BOX", id: string, confirm: true }
   * Returns: { qr_code: string, old_qr_code: string | null }
   * Role: Admin only with confirm flag
   */
  app.post("/api/qr/regenerate", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { type, id, confirm } = req.body;
      const authUser = (req as any).authUser;

      if (!type || !id) {
        return res.status(400).json({ error: "type and id are required" });
      }

      if (!confirm) {
        return res.status(400).json({ error: "confirm: true is required to regenerate QR code" });
      }

      if (!QR_ENTITY_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${QR_ENTITY_TYPES.join(", ")}` });
      }

      let oldQrCode: string | null = null;
      let newQrCode: string;
      let entityFound = false;
      let entityDisplayName = "";

      const version = generateRandomVersion();

      switch (type) {
        case "STATION": {
          const [station] = await db.select().from(stations).where(eq(stations.id, id));
          if (station) {
            entityFound = true;
            oldQrCode = station.qrCode;
            entityDisplayName = `${station.code} - ${station.name}`;
            newQrCode = generateQrCode("STATION", id, version);
            await db.update(stations).set({ qrCode: newQrCode, updatedAt: new Date() }).where(eq(stations.id, id));
          }
          break;
        }
        case "STAND": {
          const [stand] = await db.select().from(stands).where(eq(stands.id, id));
          if (stand) {
            entityFound = true;
            oldQrCode = stand.qrCode;
            entityDisplayName = `Stellplatz ${stand.identifier}`;
            newQrCode = generateQrCode("STAND", id, version);
            await db.update(stands).set({ qrCode: newQrCode, updatedAt: new Date() }).where(eq(stands.id, id));
          }
          break;
        }
        case "BOX": {
          const [box] = await db.select().from(boxes).where(eq(boxes.id, id));
          if (box) {
            entityFound = true;
            oldQrCode = box.qrCode;
            entityDisplayName = `Box ${box.serial}`;
            newQrCode = generateQrCode("BOX", id, version);
            await db.update(boxes).set({ qrCode: newQrCode, updatedAt: new Date() }).where(eq(boxes.id, id));
          }
          break;
        }
      }

      if (!entityFound) {
        return res.status(404).json({ error: `${type} with id ${id} not found` });
      }

      // Log audit event
      await db.insert(activityLogs).values({
        type: "QR",
        action: "QR_REGENERATE",
        message: `QR-Code für ${type} "${entityDisplayName}" neu generiert`,
        userId: authUser.id,
        metadata: {
          entityType: type,
          entityId: id,
          entityDisplayName,
          oldQrCode,
          newQrCode: newQrCode!,
          version,
        },
      });

      res.json({ qr_code: newQrCode!, old_qr_code: oldQrCode });
    } catch (error) {
      console.error("[QRCenter] Failed to regenerate QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });

  // ----------------------------------------------------------------------------
  // TASK SCHEDULERS
  // Daily scheduler: Runs at startup (5 second delay) and every hour
  // Flexible scheduler: Runs at startup (10 second delay) and every hour
  // ----------------------------------------------------------------------------
  setTimeout(() => {
    console.log("[DailyTaskScheduler] Initial run starting in 5 seconds...");
    generateDailyTasksScheduled();
  }, 5000);
  
  setTimeout(() => {
    console.log("[FlexibleScheduler] Initial run starting in 10 seconds...");
    generateFlexibleScheduledTasks();
  }, 10000);
  
  setInterval(() => {
    generateDailyTasksScheduled();
    generateFlexibleScheduledTasks();
  }, 60 * 60 * 1000); // Every hour

  const httpServer = createServer(app);
  return httpServer;
}
