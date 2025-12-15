var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  ACTIVITY_LOG_TYPE_LABELS: () => ACTIVITY_LOG_TYPE_LABELS,
  AUTOMOTIVE_TASK_STATUS_LABELS: () => AUTOMOTIVE_TASK_STATUS_LABELS,
  AUTOMOTIVE_TASK_TRANSITIONS: () => AUTOMOTIVE_TASK_TRANSITIONS,
  AUTOMOTIVE_USER_ROLE_LABELS: () => AUTOMOTIVE_USER_ROLE_LABELS,
  BOX_STATUS_LABELS: () => BOX_STATUS_LABELS,
  SCAN_CONTEXT_LABELS: () => SCAN_CONTEXT_LABELS,
  TASK_STATUS_LABELS: () => TASK_STATUS_LABELS,
  TASK_TYPE_LABELS: () => TASK_TYPE_LABELS,
  VALID_TASK_TRANSITIONS: () => VALID_TASK_TRANSITIONS,
  activityLogTypeEnum: () => activityLogTypeEnum,
  activityLogs: () => activityLogs,
  activityLogsRelations: () => activityLogsRelations,
  assertAutomotiveTransition: () => assertAutomotiveTransition,
  automotiveTaskStatusEnum: () => automotiveTaskStatusEnum,
  automotiveUserRoleEnum: () => automotiveUserRoleEnum,
  boxStatusEnum: () => boxStatusEnum,
  boxes: () => boxes,
  boxesRelations: () => boxesRelations,
  containerStatusEnum: () => containerStatusEnum,
  customerContainers: () => customerContainers,
  customerContainersRelations: () => customerContainersRelations,
  customers: () => customers,
  customersRelations: () => customersRelations,
  departments: () => departments,
  departmentsRelations: () => departmentsRelations,
  fillHistory: () => fillHistory,
  fillHistoryRelations: () => fillHistoryRelations,
  getAutomotiveTimestampFieldForStatus: () => getAutomotiveTimestampFieldForStatus,
  getTimestampFieldForStatus: () => getTimestampFieldForStatus,
  halls: () => halls,
  hallsRelations: () => hallsRelations,
  insertActivityLogSchema: () => insertActivityLogSchema,
  insertBoxSchema: () => insertBoxSchema,
  insertCustomerContainerSchema: () => insertCustomerContainerSchema,
  insertCustomerSchema: () => insertCustomerSchema,
  insertDepartmentSchema: () => insertDepartmentSchema,
  insertFillHistorySchema: () => insertFillHistorySchema,
  insertHallSchema: () => insertHallSchema,
  insertMaterialSchema: () => insertMaterialSchema,
  insertScanEventSchema: () => insertScanEventSchema,
  insertStandSchema: () => insertStandSchema,
  insertStationSchema: () => insertStationSchema,
  insertTaskEventSchema: () => insertTaskEventSchema,
  insertTaskScheduleSchema: () => insertTaskScheduleSchema,
  insertTaskSchema: () => insertTaskSchema,
  insertUserSchema: () => insertUserSchema,
  insertWarehouseContainerSchema: () => insertWarehouseContainerSchema,
  isValidAutomotiveTransition: () => isValidAutomotiveTransition,
  isValidTaskTransition: () => isValidTaskTransition,
  locationTypeEnum: () => locationTypeEnum,
  materials: () => materials,
  materialsRelations: () => materialsRelations,
  priorityEnum: () => priorityEnum,
  quantityUnitEnum: () => quantityUnitEnum,
  scanContextEnum: () => scanContextEnum,
  scanEvents: () => scanEvents,
  scanEventsRelations: () => scanEventsRelations,
  stands: () => stands,
  standsRelations: () => standsRelations,
  stations: () => stations,
  stationsRelations: () => stationsRelations,
  taskEvents: () => taskEvents,
  taskEventsRelations: () => taskEventsRelations,
  taskScheduleRuleTypeEnum: () => taskScheduleRuleTypeEnum,
  taskSchedules: () => taskSchedules,
  taskSchedulesRelations: () => taskSchedulesRelations,
  taskSourceEnum: () => taskSourceEnum,
  taskStatusEnum: () => taskStatusEnum,
  taskTypeEnum: () => taskTypeEnum,
  tasks: () => tasks,
  tasksRelations: () => tasksRelations,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  usersRelations: () => usersRelations,
  warehouseContainers: () => warehouseContainers,
  warehouseContainersRelations: () => warehouseContainersRelations
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var userRoleEnum = pgEnum("user_role", ["ADMIN", "DRIVER"]);
var containerStatusEnum = pgEnum("container_status", [
  "AT_WAREHOUSE",
  // Container is at the warehouse
  "AT_CUSTOMER",
  // Container is at customer location
  "IN_TRANSIT",
  // Container is being transported
  "OUT_OF_SERVICE"
  // Container is not available (maintenance, etc.)
]);
var taskStatusEnum = pgEnum("task_status", [
  "OFFEN",
  // Task created, open and not yet assigned (initial state)
  "PLANNED",
  // Legacy: same as OFFEN (kept for backward compatibility)
  "ASSIGNED",
  // Task assigned to a driver
  "ACCEPTED",
  // Driver has accepted the task (scanned at customer)
  "PICKED_UP",
  // Container picked up from customer
  "IN_TRANSIT",
  // Container being transported to warehouse
  "DELIVERED",
  // Container delivered to warehouse (scanned)
  "COMPLETED",
  // Task fully completed (weight recorded, etc.)
  "CANCELLED"
  // Task was cancelled
]);
var scanContextEnum = pgEnum("scan_context", [
  "WAREHOUSE_INFO",
  // General info scan in warehouse (no task)
  "CUSTOMER_INFO",
  // General info scan at customer (no task)
  "TASK_ACCEPT_AT_CUSTOMER",
  // Driver scans to accept task at customer
  "TASK_PICKUP",
  // Driver scans to confirm pickup
  "TASK_COMPLETE_AT_WAREHOUSE",
  // Driver scans at warehouse to complete delivery
  "INVENTORY_CHECK",
  // Inventory/audit scan
  "MAINTENANCE"
  // Maintenance-related scan
]);
var locationTypeEnum = pgEnum("location_type", [
  "WAREHOUSE",
  "CUSTOMER",
  "OTHER"
]);
var activityLogTypeEnum = pgEnum("activity_log_type", [
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_ACCEPTED",
  "TASK_PICKED_UP",
  "TASK_IN_TRANSIT",
  "TASK_DELIVERED",
  "TASK_COMPLETED",
  "TASK_CANCELLED",
  "TASK_DELETED",
  "CONTAINER_SCANNED_AT_CUSTOMER",
  "CONTAINER_SCANNED_AT_WAREHOUSE",
  "CONTAINER_STATUS_CHANGED",
  "WEIGHT_RECORDED",
  "MANUAL_EDIT",
  "SYSTEM_EVENT"
]);
var priorityEnum = pgEnum("priority", ["normal", "high", "urgent"]);
var quantityUnitEnum = pgEnum("quantity_unit", ["kg", "t", "m3", "pcs"]);
var automotiveUserRoleEnum = pgEnum("automotive_user_role", [
  "ADMIN",
  // Full administrative access
  "PICKUP_DRIVER",
  // Picks up boxes from stands
  "WAREHOUSE",
  // Manages warehouse operations
  "DISPOSAL"
  // Handles disposal/weighing
]);
var automotiveTaskStatusEnum = pgEnum("automotive_task_status", [
  "OPEN",
  // Task created, awaiting pickup
  "PICKED_UP",
  // Box picked up from stand
  "IN_TRANSIT",
  // Box being transported
  "DROPPED_OFF",
  // Box dropped at warehouse
  "TAKEN_OVER",
  // Warehouse has taken over the box
  "WEIGHED",
  // Box has been weighed
  "DISPOSED",
  // Material disposed/processed
  "CANCELLED"
  // Task cancelled
]);
var boxStatusEnum = pgEnum("box_status", [
  "AT_STAND",
  // Box is at production stand
  "IN_TRANSIT",
  // Box is being transported
  "AT_WAREHOUSE",
  // Box is at warehouse
  "AT_DISPOSAL",
  // Box is at disposal area
  "RETIRED"
  // Box is no longer in use
]);
var taskTypeEnum = pgEnum("task_type", [
  "DAILY_FULL",
  // Auto-generated daily task for full stands
  "MANUAL",
  // Manually created task
  "LEGACY"
  // Legacy task (backward compatibility)
]);
var taskSourceEnum = pgEnum("task_source", [
  "SCHEDULED",
  // Created by flexible scheduler from TaskSchedule
  "MANUAL",
  // Manually created by admin
  "ADHOC",
  // Created on-the-fly (e.g., driver scan)
  "LEGACY"
  // Legacy task or migration
]);
var taskScheduleRuleTypeEnum = pgEnum("task_schedule_rule_type", [
  "DAILY",
  // Every day
  "WEEKLY",
  // Specific weekdays
  "INTERVAL"
  // Every N days from start date
]);
var departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  taskEvents: many(taskEvents)
}));
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("DRIVER"),
  // ADMIN or DRIVER
  departmentId: varchar("department_id").references(() => departments.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id]
  }),
  createdTasks: many(tasks, { relationName: "taskCreator" }),
  assignedTasks: many(tasks, { relationName: "taskAssignee" }),
  claimedTasks: many(tasks, { relationName: "taskClaimer" }),
  weighedTasks: many(tasks, { relationName: "taskWeigher" }),
  scanEvents: many(scanEvents),
  activityLogs: many(activityLogs),
  taskEvents: many(taskEvents)
}));
var customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var customersRelations = relations(customers, ({ many }) => ({
  containers: many(customerContainers)
}));
var customerContainers = pgTable("customer_containers", {
  id: varchar("id").primaryKey(),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(),
  // Denormalized for convenience
  location: text("location").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  qrCode: text("qr_code").notNull().unique(),
  materialType: text("material_type").notNull(),
  contentDescription: text("content_description"),
  status: text("status").notNull().default("AT_CUSTOMER"),
  // AT_CUSTOMER, IN_TRANSIT, etc.
  lastEmptied: timestamp("last_emptied"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var customerContainersRelations = relations(customerContainers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [customerContainers.customerId],
    references: [customers.id]
  }),
  tasks: many(tasks),
  scanEvents: many(scanEvents)
}));
var materials = pgTable("materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  hazardClass: text("hazard_class"),
  disposalStream: text("disposal_stream"),
  densityHint: real("density_hint"),
  defaultUnit: text("default_unit").notNull().default("kg"),
  qrCode: text("qr_code").unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var materialsRelations = relations(materials, ({ many }) => ({
  stands: many(stands),
  warehouseContainers: many(warehouseContainers)
}));
var halls = pgTable("halls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  locationMeta: jsonb("location_meta"),
  positionMeta: jsonb("position_meta"),
  qrCode: text("qr_code").unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var hallsRelations = relations(halls, ({ many }) => ({
  stations: many(stations)
}));
var stations = pgTable("stations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hallId: varchar("hall_id").notNull().references(() => halls.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  sequence: integer("sequence"),
  locationMeta: jsonb("location_meta"),
  positionMeta: jsonb("position_meta"),
  qrCode: text("qr_code").unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, (table) => ({
  hallCodeUnique: sql`UNIQUE(hall_id, code)`
}));
var stationsRelations = relations(stations, ({ one, many }) => ({
  hall: one(halls, {
    fields: [stations.hallId],
    references: [halls.id]
  }),
  stands: many(stands)
}));
var stands = pgTable("stands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stationId: varchar("station_id").notNull().references(() => stations.id),
  identifier: text("identifier").notNull(),
  materialId: varchar("material_id").references(() => materials.id),
  qrCode: text("qr_code").notNull().unique(),
  sequence: integer("sequence"),
  positionMeta: jsonb("position_meta"),
  dailyFull: boolean("daily_full").notNull().default(false),
  dailyTaskTimeLocal: text("daily_task_time_local"),
  // e.g., "06:00"
  lastDailyTaskGeneratedAt: timestamp("last_daily_task_generated_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var standsRelations = relations(stands, ({ one, many }) => ({
  station: one(stations, {
    fields: [stands.stationId],
    references: [stations.id]
  }),
  material: one(materials, {
    fields: [stands.materialId],
    references: [materials.id]
  }),
  boxes: many(boxes),
  tasks: many(tasks),
  taskSchedules: many(taskSchedules)
}));
var taskSchedules = pgTable("task_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  standId: varchar("stand_id").notNull().references(() => stands.id),
  stationId: varchar("station_id").references(() => stations.id),
  ruleType: text("rule_type").notNull(),
  // DAILY, WEEKLY, INTERVAL
  timeLocal: text("time_local").notNull(),
  // e.g., "06:00"
  weekdays: integer("weekdays").array(),
  // For WEEKLY: [1,2,3,4,5] = Mon-Fri (1=Monday, 7=Sunday)
  everyNDays: integer("every_n_days"),
  // For INTERVAL: every N days
  startDate: timestamp("start_date"),
  // For INTERVAL: start date for counting
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  createDaysAhead: integer("create_days_ahead").notNull().default(7),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var taskSchedulesRelations = relations(taskSchedules, ({ one, many }) => ({
  stand: one(stands, {
    fields: [taskSchedules.standId],
    references: [stands.id]
  }),
  station: one(stations, {
    fields: [taskSchedules.stationId],
    references: [stations.id]
  }),
  createdBy: one(users, {
    fields: [taskSchedules.createdById],
    references: [users.id]
  }),
  tasks: many(tasks)
}));
var boxes = pgTable("boxes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  standId: varchar("stand_id").references(() => stands.id),
  qrCode: text("qr_code").notNull().unique(),
  serial: text("serial").notNull().unique(),
  status: text("status").notNull().default("AT_STAND"),
  currentTaskId: varchar("current_task_id"),
  lastSeenAt: timestamp("last_seen_at"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var boxesRelations = relations(boxes, ({ one, many }) => ({
  stand: one(stands, {
    fields: [boxes.standId],
    references: [stands.id]
  }),
  currentTask: one(tasks, {
    fields: [boxes.currentTaskId],
    references: [tasks.id],
    relationName: "boxCurrentTask"
  }),
  tasks: many(tasks, { relationName: "boxTasks" })
}));
var warehouseContainers = pgTable("warehouse_containers", {
  id: varchar("id").primaryKey(),
  location: text("location").notNull(),
  warehouseZone: text("warehouse_zone"),
  // e.g., "A-17", "Tor 3"
  qrCode: text("qr_code").notNull().unique(),
  materialType: text("material_type").notNull(),
  contentDescription: text("content_description"),
  currentAmount: real("current_amount").notNull().default(0),
  maxCapacity: real("max_capacity").notNull(),
  quantityUnit: text("quantity_unit").notNull().default("kg"),
  // kg, t, m3
  status: text("status").notNull().default("AT_WAREHOUSE"),
  // AT_WAREHOUSE, OUT_OF_SERVICE
  lastEmptied: timestamp("last_emptied"),
  materialId: varchar("material_id").references(() => materials.id),
  isFull: boolean("is_full").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var warehouseContainersRelations = relations(warehouseContainers, ({ one, many }) => ({
  material: one(materials, {
    fields: [warehouseContainers.materialId],
    references: [materials.id]
  }),
  tasks: many(tasks),
  targetTasks: many(tasks, { relationName: "targetWarehouseContainer" }),
  fillHistory: many(fillHistory),
  scanEvents: many(scanEvents)
}));
var fillHistory = pgTable("fill_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  warehouseContainerId: varchar("warehouse_container_id").notNull().references(() => warehouseContainers.id),
  amountAdded: real("amount_added").notNull(),
  quantityUnit: text("quantity_unit").notNull().default("kg"),
  taskId: varchar("task_id").references(() => tasks.id),
  recordedByUserId: varchar("recorded_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var fillHistoryRelations = relations(fillHistory, ({ one }) => ({
  warehouseContainer: one(warehouseContainers, {
    fields: [fillHistory.warehouseContainerId],
    references: [warehouseContainers.id]
  }),
  task: one(tasks, {
    fields: [fillHistory.taskId],
    references: [tasks.id]
  }),
  recordedBy: one(users, {
    fields: [fillHistory.recordedByUserId],
    references: [users.id]
  })
}));
var tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Task Details
  title: text("title"),
  // Short description, e.g., "Abholung bei ABC GmbH"
  description: text("description"),
  // Detailed description
  // Container References (nullable for stand-based automotive tasks)
  containerID: varchar("container_id").references(() => customerContainers.id),
  deliveryContainerID: varchar("delivery_container_id").references(() => warehouseContainers.id),
  // User References
  createdBy: varchar("created_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  // Pull-based task claiming
  claimedByUserId: varchar("claimed_by_user_id").references(() => users.id),
  // User who claimed the task
  claimedAt: timestamp("claimed_at"),
  // When task was claimed
  handoverAt: timestamp("handover_at"),
  // When task was transferred to another user
  // Planning
  scheduledTime: timestamp("scheduled_time"),
  // Planned execution time
  plannedQuantity: real("planned_quantity"),
  // Expected amount
  plannedQuantityUnit: text("planned_quantity_unit").default("kg"),
  priority: text("priority").notNull().default("normal"),
  // normal, high, urgent
  materialType: text("material_type"),
  // Optional - material type for the task
  // Status and Lifecycle
  status: text("status").notNull().default("OFFEN"),
  // Changed default from PLANNED to OFFEN
  // Lifecycle Timestamps - Set when status changes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  assignedAt: timestamp("assigned_at"),
  acceptedAt: timestamp("accepted_at"),
  pickedUpAt: timestamp("picked_up_at"),
  inTransitAt: timestamp("in_transit_at"),
  deliveredAt: timestamp("delivered_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  // Legacy fields for backward compatibility
  pickupTimestamp: timestamp("pickup_timestamp"),
  pickupLocation: jsonb("pickup_location"),
  deliveryTimestamp: timestamp("delivery_timestamp"),
  // Actual recorded values
  actualQuantity: real("actual_quantity"),
  // Actually measured amount
  actualQuantityUnit: text("actual_quantity_unit").default("kg"),
  measuredWeight: real("measured_weight"),
  // Actual weight measured at completion
  // Additional info
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  estimatedAmount: real("estimated_amount"),
  // Legacy, use plannedQuantity
  // ============================================================================
  // AUTOMOTIVE FACTORY TASK FIELDS
  // ============================================================================
  // Automotive references
  boxId: varchar("box_id").references(() => boxes.id),
  standId: varchar("stand_id").references(() => stands.id),
  targetWarehouseContainerId: varchar("target_warehouse_container_id").references(() => warehouseContainers.id),
  // Automotive lifecycle timestamps
  droppedOffAt: timestamp("dropped_off_at"),
  takenOverAt: timestamp("taken_over_at"),
  weighedAt: timestamp("weighed_at"),
  disposedAt: timestamp("disposed_at"),
  // Automotive measurements
  weightKg: real("weight_kg"),
  weighedByUserId: varchar("weighed_by_user_id").references(() => users.id),
  // Task categorization
  taskType: text("task_type").notNull().default("LEGACY"),
  // DAILY_FULL, MANUAL, LEGACY
  source: text("source").notNull().default("LEGACY"),
  // SCHEDULED, MANUAL, ADHOC, LEGACY
  scheduleId: varchar("schedule_id").references(() => taskSchedules.id),
  // Link to the schedule that created this task
  // Daily task scheduling
  scheduledFor: timestamp("scheduled_for"),
  // Date for which daily task is scheduled
  dedupKey: text("dedup_key").unique(),
  // Format: SCHED:${scheduleId}:${YYYY-MM-DD} or DAILY:${standId}:${YYYY-MM-DD}
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var tasksRelations = relations(tasks, ({ one, many }) => ({
  container: one(customerContainers, {
    fields: [tasks.containerID],
    references: [customerContainers.id]
  }),
  deliveryContainer: one(warehouseContainers, {
    fields: [tasks.deliveryContainerID],
    references: [warehouseContainers.id]
  }),
  targetWarehouseContainer: one(warehouseContainers, {
    fields: [tasks.targetWarehouseContainerId],
    references: [warehouseContainers.id],
    relationName: "targetWarehouseContainer"
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "taskCreator"
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "taskAssignee"
  }),
  claimedBy: one(users, {
    fields: [tasks.claimedByUserId],
    references: [users.id],
    relationName: "taskClaimer"
  }),
  weighedBy: one(users, {
    fields: [tasks.weighedByUserId],
    references: [users.id],
    relationName: "taskWeigher"
  }),
  box: one(boxes, {
    fields: [tasks.boxId],
    references: [boxes.id],
    relationName: "boxTasks"
  }),
  stand: one(stands, {
    fields: [tasks.standId],
    references: [stands.id]
  }),
  schedule: one(taskSchedules, {
    fields: [tasks.scheduleId],
    references: [taskSchedules.id]
  }),
  scanEvents: many(scanEvents),
  activityLogs: many(activityLogs),
  fillHistory: many(fillHistory),
  taskEvents: many(taskEvents)
}));
var taskEvents = pgTable("task_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  actorRole: text("actor_role"),
  actorDepartmentId: varchar("actor_department_id").references(() => departments.id),
  metaJson: jsonb("meta_json"),
  // Contains stationId, hallId, standId, boxId, materialId, containerId, qrType
  timestamp: timestamp("timestamp").notNull().defaultNow()
});
var taskEventsRelations = relations(taskEvents, ({ one }) => ({
  task: one(tasks, {
    fields: [taskEvents.taskId],
    references: [tasks.id]
  }),
  actorUser: one(users, {
    fields: [taskEvents.actorUserId],
    references: [users.id]
  }),
  actorDepartment: one(departments, {
    fields: [taskEvents.actorDepartmentId],
    references: [departments.id]
  })
}));
var scanEvents = pgTable("scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // What was scanned
  containerId: varchar("container_id").notNull(),
  // Can be customer or warehouse container
  containerType: text("container_type").notNull(),
  // "customer" or "warehouse"
  // Task context (optional - null for info-only scans)
  taskId: varchar("task_id").references(() => tasks.id),
  // Who scanned
  scannedByUserId: varchar("scanned_by_user_id").notNull().references(() => users.id),
  // When and where
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
  // Scan context - what was the purpose of this scan
  scanContext: text("scan_context").notNull(),
  // WAREHOUSE_INFO, TASK_ACCEPT_AT_CUSTOMER, etc.
  // Location information
  locationType: text("location_type").notNull(),
  // WAREHOUSE, CUSTOMER, OTHER
  locationDetails: text("location_details"),
  // Free text, e.g., "Tor 3", "Regal A-17"
  geoLocation: jsonb("geo_location"),
  // { latitude, longitude, accuracy }
  // Scan result
  scanResult: text("scan_result").notNull().default("SUCCESS"),
  // SUCCESS, INVALID_CONTAINER, ERROR
  resultMessage: text("result_message"),
  // Human-readable result description
  // Additional data for debugging/audit
  extraData: jsonb("extra_data"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var scanEventsRelations = relations(scanEvents, ({ one }) => ({
  scannedBy: one(users, {
    fields: [scanEvents.scannedByUserId],
    references: [users.id]
  }),
  task: one(tasks, {
    fields: [scanEvents.taskId],
    references: [tasks.id]
  })
}));
var activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Event classification
  type: text("type").notNull(),
  // TASK_CREATED, TASK_ACCEPTED, CONTAINER_SCANNED_AT_WAREHOUSE, etc.
  action: text("action").notNull(),
  // Legacy field, same as type for backward compatibility
  // Human-readable message for UI display
  message: text("message").notNull(),
  // e.g., "Fahrer Müller hat Container XYZ beim Kunden gescannt"
  // References
  userId: varchar("user_id").references(() => users.id),
  // Who triggered this event
  taskId: varchar("task_id").references(() => tasks.id),
  containerId: varchar("container_id"),
  // Can be customer or warehouse container ID
  scanEventId: varchar("scan_event_id").references(() => scanEvents.id),
  // Link to scan if applicable
  // Location at time of event
  location: jsonb("location"),
  // Additional structured details
  details: text("details"),
  // Legacy field
  metadata: jsonb("metadata"),
  // Additional structured data
  // Timestamp
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id]
  }),
  task: one(tasks, {
    fields: [activityLogs.taskId],
    references: [tasks.id]
  }),
  scanEvent: one(scanEvents, {
    fields: [activityLogs.scanEventId],
    references: [scanEvents.id]
  })
}));
var insertDepartmentSchema = createInsertSchema(departments);
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  phone: true,
  role: true,
  departmentId: true
});
var insertCustomerSchema = createInsertSchema(customers);
var insertCustomerContainerSchema = createInsertSchema(customerContainers);
var insertWarehouseContainerSchema = createInsertSchema(warehouseContainers);
var insertTaskSchema = createInsertSchema(tasks);
var insertScanEventSchema = createInsertSchema(scanEvents);
var insertActivityLogSchema = createInsertSchema(activityLogs);
var insertFillHistorySchema = createInsertSchema(fillHistory);
var insertMaterialSchema = createInsertSchema(materials);
var insertHallSchema = createInsertSchema(halls);
var insertStationSchema = createInsertSchema(stations);
var insertStandSchema = createInsertSchema(stands);
var insertBoxSchema = createInsertSchema(boxes);
var insertTaskEventSchema = createInsertSchema(taskEvents);
var insertTaskScheduleSchema = createInsertSchema(taskSchedules);
var VALID_TASK_TRANSITIONS = {
  OFFEN: ["ASSIGNED", "ACCEPTED", "CANCELLED"],
  // New task - can be assigned or directly accepted
  PLANNED: ["ASSIGNED", "ACCEPTED", "CANCELLED"],
  // Legacy: same as OFFEN
  ASSIGNED: ["ACCEPTED", "OFFEN", "PLANNED", "CANCELLED"],
  ACCEPTED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
  // Allow skipping IN_TRANSIT for simpler flow
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  // Terminal state
  CANCELLED: []
  // Terminal state
};
function isValidTaskTransition(currentStatus, newStatus) {
  const validTransitions = VALID_TASK_TRANSITIONS[currentStatus];
  if (!validTransitions) return false;
  return validTransitions.includes(newStatus);
}
function getTimestampFieldForStatus(status) {
  const mapping = {
    ASSIGNED: "assignedAt",
    ACCEPTED: "acceptedAt",
    PICKED_UP: "pickedUpAt",
    IN_TRANSIT: "inTransitAt",
    DELIVERED: "deliveredAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt"
  };
  return mapping[status] || null;
}
var AUTOMOTIVE_TASK_TRANSITIONS = {
  OPEN: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DROPPED_OFF", "CANCELLED"],
  DROPPED_OFF: ["TAKEN_OVER", "CANCELLED"],
  TAKEN_OVER: ["WEIGHED", "CANCELLED"],
  WEIGHED: ["DISPOSED", "CANCELLED"],
  DISPOSED: [],
  // Terminal state - no transitions allowed
  CANCELLED: []
  // Terminal state - no transitions allowed
};
function isValidAutomotiveTransition(currentStatus, newStatus) {
  const validTransitions = AUTOMOTIVE_TASK_TRANSITIONS[currentStatus];
  if (!validTransitions) return false;
  return validTransitions.includes(newStatus);
}
function assertAutomotiveTransition(from, to) {
  if (!isValidAutomotiveTransition(from, to)) {
    throw new Error(
      `Ung\xFCltiger Status\xFCbergang: ${from} \u2192 ${to}. Erlaubte \xDCberg\xE4nge von ${from}: ${AUTOMOTIVE_TASK_TRANSITIONS[from]?.join(", ") || "keine"}`
    );
  }
}
function getAutomotiveTimestampFieldForStatus(status) {
  const mapping = {
    PICKED_UP: "pickedUpAt",
    IN_TRANSIT: "inTransitAt",
    DROPPED_OFF: "droppedOffAt",
    TAKEN_OVER: "takenOverAt",
    WEIGHED: "weighedAt",
    DISPOSED: "disposedAt",
    CANCELLED: "cancelledAt"
  };
  return mapping[status] || null;
}
var TASK_STATUS_LABELS = {
  OFFEN: "Offen",
  PLANNED: "Geplant",
  // Legacy, same as OFFEN
  ASSIGNED: "Zugewiesen",
  ACCEPTED: "Angenommen",
  PICKED_UP: "Abgeholt",
  IN_TRANSIT: "Unterwegs",
  DELIVERED: "Geliefert",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert"
};
var SCAN_CONTEXT_LABELS = {
  WAREHOUSE_INFO: "Info-Scan im Lager",
  CUSTOMER_INFO: "Info-Scan beim Kunden",
  TASK_ACCEPT_AT_CUSTOMER: "Auftragsannahme beim Kunden",
  TASK_PICKUP: "Abholung best\xE4tigt",
  TASK_COMPLETE_AT_WAREHOUSE: "Lieferung im Lager",
  INVENTORY_CHECK: "Inventurpr\xFCfung",
  MAINTENANCE: "Wartungsscan"
};
var ACTIVITY_LOG_TYPE_LABELS = {
  TASK_CREATED: "Auftrag erstellt",
  TASK_ASSIGNED: "Auftrag zugewiesen",
  TASK_ACCEPTED: "Auftrag angenommen",
  TASK_PICKED_UP: "Container abgeholt",
  TASK_IN_TRANSIT: "Transport gestartet",
  TASK_DELIVERED: "Container geliefert",
  TASK_COMPLETED: "Auftrag abgeschlossen",
  TASK_CANCELLED: "Auftrag storniert",
  TASK_DELETED: "Auftrag gel\xF6scht",
  CONTAINER_SCANNED_AT_CUSTOMER: "Container beim Kunden gescannt",
  CONTAINER_SCANNED_AT_WAREHOUSE: "Container im Lager gescannt",
  CONTAINER_STATUS_CHANGED: "Container-Status ge\xE4ndert",
  WEIGHT_RECORDED: "Gewicht erfasst",
  MANUAL_EDIT: "Manuelle Bearbeitung",
  SYSTEM_EVENT: "Systemereignis"
};
var AUTOMOTIVE_USER_ROLE_LABELS = {
  ADMIN: "Administrator",
  PICKUP_DRIVER: "Abholfahrer",
  WAREHOUSE: "Lager",
  DISPOSAL: "Entsorgung"
};
var AUTOMOTIVE_TASK_STATUS_LABELS = {
  OPEN: "Offen",
  PICKED_UP: "Abgeholt",
  IN_TRANSIT: "Unterwegs",
  DROPPED_OFF: "Abgestellt",
  TAKEN_OVER: "\xDCbernommen",
  WEIGHED: "Gewogen",
  DISPOSED: "Entsorgt",
  CANCELLED: "Storniert"
};
var BOX_STATUS_LABELS = {
  AT_STAND: "Am Stellplatz",
  IN_TRANSIT: "Unterwegs",
  AT_WAREHOUSE: "Im Lager",
  AT_DISPOSAL: "Bei Entsorgung",
  RETIRED: "Ausgemustert"
};
var TASK_TYPE_LABELS = {
  DAILY_FULL: "T\xE4gliche Abholung",
  MANUAL: "Manueller Auftrag",
  LEGACY: "Legacy-Auftrag"
};

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. For Supabase, copy the connection string from your Supabase Dashboard \u2192 Settings \u2192 Database \u2192 Connection String (URI format)."
  );
}
var databaseUrl = process.env.DATABASE_URL;
var isSupabase = databaseUrl.includes("supabase") || databaseUrl.includes(":6543");
var poolConfig = {
  connectionString: databaseUrl,
  ...isSupabase && {
    ssl: {
      rejectUnauthorized: false
      // Required for Supabase pooler connections
    }
  }
};
var pool = new Pool(poolConfig);
var db = drizzle(pool, { schema: schema_exports });
async function checkDatabaseHealth() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return { connected: true };
  } catch (error) {
    console.error("Database health check failed:", error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown database error"
    };
  }
}

// server/storage.ts
import { eq, desc, and, gte, lte } from "drizzle-orm";
var DatabaseStorage = class {
  // ============================================================================
  // USERS
  // ============================================================================
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getUsers() {
    return db.select().from(users).where(eq(users.isActive, true));
  }
  async updateUser(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user || void 0;
  }
  // ============================================================================
  // CUSTOMERS
  // ============================================================================
  async getCustomers() {
    return db.select().from(customers).where(eq(customers.isActive, true));
  }
  async getCustomer(id) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || void 0;
  }
  async createCustomer(data) {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  }
  async updateCustomer(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [customer] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return customer || void 0;
  }
  // ============================================================================
  // CUSTOMER CONTAINERS
  // ============================================================================
  async getCustomerContainers() {
    return db.select().from(customerContainers).where(eq(customerContainers.isActive, true));
  }
  async getCustomerContainer(id) {
    const [container] = await db.select().from(customerContainers).where(eq(customerContainers.id, id));
    return container || void 0;
  }
  async getCustomerContainerByQR(qrCode) {
    const [container] = await db.select().from(customerContainers).where(eq(customerContainers.qrCode, qrCode));
    return container || void 0;
  }
  async createCustomerContainer(data) {
    const [container] = await db.insert(customerContainers).values(data).returning();
    return container;
  }
  async updateCustomerContainer(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [container] = await db.update(customerContainers).set(updateData).where(eq(customerContainers.id, id)).returning();
    return container || void 0;
  }
  // ============================================================================
  // WAREHOUSE CONTAINERS
  // ============================================================================
  async getWarehouseContainers() {
    return db.select().from(warehouseContainers).where(eq(warehouseContainers.isActive, true));
  }
  async getWarehouseContainer(id) {
    const [container] = await db.select().from(warehouseContainers).where(eq(warehouseContainers.id, id));
    return container || void 0;
  }
  async getWarehouseContainerByQR(qrCode) {
    const [container] = await db.select().from(warehouseContainers).where(eq(warehouseContainers.qrCode, qrCode));
    return container || void 0;
  }
  async createWarehouseContainer(data) {
    const [container] = await db.insert(warehouseContainers).values(data).returning();
    return container;
  }
  async updateWarehouseContainer(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [container] = await db.update(warehouseContainers).set(updateData).where(eq(warehouseContainers.id, id)).returning();
    return container || void 0;
  }
  // ============================================================================
  // TASKS
  // ============================================================================
  async getTasks(filters) {
    const conditions = [];
    if (filters?.assignedTo) {
      conditions.push(eq(tasks.assignedTo, filters.assignedTo));
    }
    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    if (filters?.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(tasks.scheduledTime, startOfDay));
      conditions.push(lte(tasks.scheduledTime, endOfDay));
    }
    if (conditions.length > 0) {
      return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt));
    }
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }
  async getTask(id) {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || void 0;
  }
  async createTask(data) {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }
  async updateTask(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [task] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return task || void 0;
  }
  /**
   * Update task status with validation and automatic timestamp setting
   * Returns undefined if transition is invalid
   */
  async updateTaskStatus(id, newStatus, userId) {
    const currentTask = await this.getTask(id);
    if (!currentTask) return void 0;
    if (!isValidTaskTransition(currentTask.status, newStatus)) {
      console.warn(`Invalid task transition: ${currentTask.status} -> ${newStatus}`);
      return void 0;
    }
    const updateData = {
      status: newStatus,
      updatedAt: /* @__PURE__ */ new Date()
    };
    const timestampField = getTimestampFieldForStatus(newStatus);
    if (timestampField) {
      updateData[timestampField] = /* @__PURE__ */ new Date();
    }
    if (newStatus === "ASSIGNED" && userId) {
      updateData.assignedTo = userId;
    }
    if (newStatus === "ACCEPTED" && (currentTask.status === "OFFEN" || currentTask.status === "PLANNED") && userId) {
      updateData.assignedTo = userId;
      updateData.assignedAt = /* @__PURE__ */ new Date();
    }
    if (newStatus === "ACCEPTED" && userId && !currentTask.assignedTo) {
      updateData.assignedTo = userId;
      updateData.assignedAt = /* @__PURE__ */ new Date();
    }
    const [task] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return task || void 0;
  }
  /**
   * Delete a task and handle related data (scan events, activity logs, fill history)
   * Returns true if the task was deleted, false if not found
   */
  async deleteTask(id) {
    const existingTask = await this.getTask(id);
    if (!existingTask) return false;
    await db.update(scanEvents).set({ taskId: null }).where(eq(scanEvents.taskId, id));
    await db.update(activityLogs).set({ taskId: null }).where(eq(activityLogs.taskId, id));
    await db.update(fillHistory).set({ taskId: null }).where(eq(fillHistory.taskId, id));
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }
  // ============================================================================
  // SCAN EVENTS
  // ============================================================================
  async getScanEvents(filters) {
    const conditions = [];
    if (filters?.containerId) {
      conditions.push(eq(scanEvents.containerId, filters.containerId));
    }
    if (filters?.taskId) {
      conditions.push(eq(scanEvents.taskId, filters.taskId));
    }
    if (filters?.userId) {
      conditions.push(eq(scanEvents.scannedByUserId, filters.userId));
    }
    if (conditions.length > 0) {
      return db.select().from(scanEvents).where(and(...conditions)).orderBy(desc(scanEvents.scannedAt));
    }
    return db.select().from(scanEvents).orderBy(desc(scanEvents.scannedAt));
  }
  async getScanEvent(id) {
    const [event] = await db.select().from(scanEvents).where(eq(scanEvents.id, id));
    return event || void 0;
  }
  async createScanEvent(data) {
    const [event] = await db.insert(scanEvents).values(data).returning();
    return event;
  }
  // ============================================================================
  // ACTIVITY LOGS
  // ============================================================================
  async getActivityLogs(filters) {
    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(activityLogs.userId, filters.userId));
    }
    if (filters?.containerId) {
      conditions.push(eq(activityLogs.containerId, filters.containerId));
    }
    if (filters?.type) {
      conditions.push(eq(activityLogs.type, filters.type));
    }
    if (filters?.taskId) {
      conditions.push(eq(activityLogs.taskId, filters.taskId));
    }
    if (conditions.length > 0) {
      return db.select().from(activityLogs).where(and(...conditions)).orderBy(desc(activityLogs.timestamp));
    }
    return db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp));
  }
  async createActivityLog(data) {
    const logData = {
      ...data,
      action: data.action || data.type
    };
    const [log2] = await db.insert(activityLogs).values(logData).returning();
    return log2;
  }
  // ============================================================================
  // FILL HISTORY
  // ============================================================================
  async getFillHistory(warehouseContainerId) {
    return db.select().from(fillHistory).where(eq(fillHistory.warehouseContainerId, warehouseContainerId)).orderBy(desc(fillHistory.createdAt));
  }
  async createFillHistory(data) {
    const [history] = await db.insert(fillHistory).values(data).returning();
    return history;
  }
  // ============================================================================
  // DEPARTMENTS
  // ============================================================================
  async getDepartments() {
    return db.select().from(departments).where(eq(departments.isActive, true));
  }
  async getDepartment(id) {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department || void 0;
  }
  async createDepartment(data) {
    const [department] = await db.insert(departments).values(data).returning();
    return department;
  }
  async updateDepartment(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [department] = await db.update(departments).set(updateData).where(eq(departments.id, id)).returning();
    return department || void 0;
  }
  async deleteDepartment(id) {
    const [department] = await db.update(departments).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(departments.id, id)).returning();
    return !!department;
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { createHash } from "crypto";
import { eq as eq2, and as and2, desc as desc2, notInArray, isNull, gte as gte2, lte as lte2, sql as sql3, inArray, count, sum, avg, or as or2, ilike } from "drizzle-orm";
function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}
async function requireAuth(req, res, next) {
  const userId = req.headers["x-user-id"] || req.body?.userId;
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
  req.authUser = user;
  next();
}
function requireAdmin(req, res, next) {
  const user = req.authUser;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = user.role?.toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
function normalizeUserRole(user) {
  return {
    ...user,
    role: user.role?.toLowerCase() || "driver"
  };
}
function prepareUserResponse(user) {
  const { password, ...userWithoutPassword } = user;
  return normalizeUserRole(userWithoutPassword);
}
function getTodayBerlin() {
  const berlinDateStr = (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Europe/Berlin" });
  const berlinDate = new Date(berlinDateStr);
  berlinDate.setHours(0, 0, 0, 0);
  return berlinDate;
}
function formatDateBerlin(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}
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
}) {
  try {
    let finalActorRole = actorRole;
    let finalActorDepartmentId = actorDepartmentId;
    if (actorUserId && (!actorRole || !actorDepartmentId)) {
      const user = await storage.getUser(actorUserId);
      if (user) {
        if (!finalActorRole) {
          finalActorRole = user.role || void 0;
        }
        if (!finalActorDepartmentId) {
          finalActorDepartmentId = user.departmentId || void 0;
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
      metaJson: metaJson || null
    });
  } catch (error) {
    console.error("[AuditEvent] Failed to create audit event:", error);
  }
}
async function buildStandContextMeta(standId) {
  const meta = { standId };
  try {
    const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
    if (stand) {
      if (stand.materialId) meta.materialId = stand.materialId;
      if (stand.stationId) {
        meta.stationId = stand.stationId;
        const [station] = await db.select().from(stations).where(eq2(stations.id, stand.stationId));
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
var CLAIM_TTL_MINUTES = 30;
function isClaimExpired(claimedAt) {
  if (!claimedAt) return true;
  const now = /* @__PURE__ */ new Date();
  const expiry = new Date(claimedAt.getTime() + CLAIM_TTL_MINUTES * 60 * 1e3);
  return now > expiry;
}
async function generateDailyTasksScheduled() {
  try {
    console.log("[DailyTaskScheduler] Running scheduled task generation...");
    const today = getTodayBerlin();
    const todayStr = formatDateBerlin(/* @__PURE__ */ new Date());
    const openDailyTasks = await db.select().from(tasks).where(
      and2(eq2(tasks.taskType, "DAILY_FULL"), eq2(tasks.status, "OPEN"))
    );
    let cancelledCount = 0;
    for (const task of openDailyTasks) {
      if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
        const beforeStatus = task.status;
        await db.update(tasks).set({
          status: "CANCELLED",
          cancelledAt: /* @__PURE__ */ new Date(),
          cancellationReason: "Auto-cancelled: New daily task generated",
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(tasks.id, task.id));
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
            boxId: task.boxId || void 0,
            source: "DAILY_SCHEDULER"
          }
        });
        cancelledCount++;
      }
    }
    if (cancelledCount > 0) {
      console.log(`[DailyTaskScheduler] Auto-cancelled ${cancelledCount} previous OPEN daily tasks.`);
    }
    const dailyFullStands = await db.select().from(stands).where(
      and2(eq2(stands.dailyFull, true), eq2(stands.isActive, true))
    );
    let createdCount = 0;
    let skippedCount = 0;
    for (const stand of dailyFullStands) {
      const dedupKey = `DAILY:${stand.id}:${todayStr}`;
      try {
        const [newTask] = await db.insert(tasks).values({
          title: `T\xE4gliche Abholung - Stand ${stand.identifier}`,
          description: `Automatisch generierte t\xE4gliche Abholung`,
          containerID: null,
          boxId: null,
          standId: stand.id,
          materialType: stand.materialId || null,
          taskType: "DAILY_FULL",
          status: "OPEN",
          priority: "normal",
          scheduledFor: today,
          dedupKey
        }).returning();
        await db.update(stands).set({
          lastDailyTaskGeneratedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(stands.id, stand.id));
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
            source: "DAILY"
          }
        });
        createdCount++;
      } catch (e) {
        if (e?.code === "23505") {
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
function getDateInTimezone(date, timezone) {
  const dateStr = date.toLocaleString("en-US", { timeZone: timezone });
  const localDate = new Date(dateStr);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
}
function formatDateInTimezone(date, timezone) {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}
function getDayOfWeekInTimezone(date, timezone) {
  const dateStr = date.toLocaleString("en-US", { timeZone: timezone });
  const localDate = new Date(dateStr);
  const day = localDate.getDay();
  return day === 0 ? 7 : day;
}
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1e3 * 60 * 60 * 24));
}
function shouldGenerateForDate(schedule, targetDate, timezone) {
  const { ruleType, weekdays, everyNDays, startDate } = schedule;
  switch (ruleType) {
    case "DAILY":
      return true;
    case "WEEKLY":
      if (!weekdays || !Array.isArray(weekdays) || weekdays.length === 0) {
        return false;
      }
      const dayOfWeek = getDayOfWeekInTimezone(targetDate, timezone);
      return weekdays.includes(dayOfWeek);
    case "INTERVAL":
      if (!everyNDays || everyNDays < 1 || !startDate) {
        return false;
      }
      const days = daysBetween(startDate, targetDate);
      return days >= 0 && days % everyNDays === 0;
    default:
      return false;
  }
}
async function generateFlexibleScheduledTasks() {
  try {
    console.log("[FlexibleScheduler] Running scheduled task generation...");
    const activeSchedules = await db.select().from(taskSchedules).where(eq2(taskSchedules.isActive, true));
    if (activeSchedules.length === 0) {
      console.log("[FlexibleScheduler] No active schedules found.");
      return;
    }
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    for (const schedule of activeSchedules) {
      const timezone = schedule.timezone || "Europe/Berlin";
      const createDaysAhead = schedule.createDaysAhead || 7;
      const [stand] = await db.select().from(stands).where(eq2(stands.id, schedule.standId));
      if (!stand || !stand.isActive) {
        console.log(`[FlexibleScheduler] Stand ${schedule.standId} not found or inactive, skipping schedule ${schedule.id}`);
        continue;
      }
      const now = /* @__PURE__ */ new Date();
      for (let dayOffset = 0; dayOffset <= createDaysAhead; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + dayOffset);
        if (!shouldGenerateForDate(schedule, targetDate, timezone)) {
          continue;
        }
        const dateStr = formatDateInTimezone(targetDate, timezone);
        const dedupKey = `SCHED:${schedule.id}:${dateStr}`;
        const [hours, minutes] = (schedule.timeLocal || "06:00").split(":").map(Number);
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
            dedupKey
          }).returning();
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
              scheduledFor: scheduledFor.toISOString()
            },
            metaJson: {
              ...standMeta,
              source: "FLEXIBLE_SCHEDULER",
              ruleType: schedule.ruleType
            }
          });
          totalCreated++;
        } catch (e) {
          if (e?.code === "23505") {
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
async function registerRoutes(app2) {
  app2.use("/api", (req, res, next) => {
    const start = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => {
      const duration = Date.now() - start;
      const logMessage = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;
      const responseBody = res._logBody;
      const bodySnippet = responseBody ? JSON.stringify(responseBody).substring(0, 100) + (JSON.stringify(responseBody).length > 100 ? "\u2026" : "") : "";
      console.log(`${logMessage} :: ${bodySnippet}`);
    });
    next();
  });
  app2.get("/api/debug/ping", (req, res) => {
    res.json({
      pong: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL
      }
    });
  });
  app2.head("/api/health", (req, res) => {
    res.status(200).end();
  });
  app2.get("/api/health", async (req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      if (dbHealth.connected) {
        res.status(200).json({
          status: "ok",
          database: "connected",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        res.status(503).json({
          status: "degraded",
          database: "disconnected",
          error: dbHealth.error,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        database: "unknown",
        error: error instanceof Error ? error.message : "Health check failed",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app2.get("/api/auth/replit", (req, res) => {
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
        id: userId,
        name: userName,
        roles: userRoles ? userRoles.split(",") : []
      }
    });
  });
  app2.post("/api/auth/replit/login", async (req, res) => {
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
          name: userName,
          role: isFirstUser ? "admin" : "driver"
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
  app2.post("/api/auth/login", async (req, res) => {
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
  app2.get("/api/users", async (req, res) => {
    try {
      const users2 = await storage.getUsers();
      const usersWithoutPasswords = users2.map((user) => prepareUserResponse(user));
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  app2.get("/api/users/:id", async (req, res) => {
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
  app2.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
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
        role: role || "driver"
      });
      res.status(201).json(prepareUserResponse(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  app2.patch("/api/users/:id", async (req, res) => {
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
  app2.get("/api/departments", async (req, res) => {
    try {
      const departmentList = await storage.getDepartments();
      res.json(departmentList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });
  app2.get("/api/departments/:id", async (req, res) => {
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
  app2.post("/api/departments", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }
      const department = await storage.createDepartment({
        name,
        code,
        description: description || null
      });
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "Department code already exists" });
      }
      res.status(500).json({ error: "Failed to create department" });
    }
  });
  app2.patch("/api/departments/:id", requireAuth, requireAdmin, async (req, res) => {
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
  app2.delete("/api/departments/:id", requireAuth, requireAdmin, async (req, res) => {
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
  app2.get("/api/admin/schedules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schedulesList = await db.select({
        schedule: taskSchedules,
        stand: stands,
        station: stations
      }).from(taskSchedules).leftJoin(stands, eq2(taskSchedules.standId, stands.id)).leftJoin(stations, eq2(taskSchedules.stationId, stations.id)).orderBy(desc2(taskSchedules.createdAt));
      const result = schedulesList.map((row) => ({
        ...row.schedule,
        stand: row.stand,
        station: row.station
      }));
      res.json(result);
    } catch (error) {
      console.error("[Schedules] Failed to fetch schedules:", error);
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });
  app2.get("/api/admin/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [schedule] = await db.select({
        schedule: taskSchedules,
        stand: stands,
        station: stations
      }).from(taskSchedules).leftJoin(stands, eq2(taskSchedules.standId, stands.id)).leftJoin(stations, eq2(taskSchedules.stationId, stations.id)).where(eq2(taskSchedules.id, req.params.id));
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json({
        ...schedule.schedule,
        stand: schedule.stand,
        station: schedule.station
      });
    } catch (error) {
      console.error("[Schedules] Failed to fetch schedule:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });
  app2.post("/api/admin/schedules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
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
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
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
        isActive: true
      }).returning();
      res.status(201).json(newSchedule);
    } catch (error) {
      console.error("[Schedules] Failed to create schedule:", error);
      res.status(500).json({ error: "Failed to create schedule" });
    }
  });
  app2.patch("/api/admin/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, standId, stationId, ruleType, timeLocal, weekdays, everyNDays, startDate, timezone, createDaysAhead, isActive } = req.body;
      const [existing] = await db.select().from(taskSchedules).where(eq2(taskSchedules.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      const finalRuleType = ruleType ?? existing.ruleType;
      if (ruleType && !["DAILY", "WEEKLY", "INTERVAL"].includes(ruleType)) {
        return res.status(400).json({ error: "ruleType must be DAILY, WEEKLY, or INTERVAL" });
      }
      const updateData = {
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (name !== void 0) updateData.name = name;
      if (standId !== void 0) updateData.standId = standId;
      if (stationId !== void 0) updateData.stationId = stationId;
      if (ruleType !== void 0) updateData.ruleType = ruleType;
      if (timeLocal !== void 0) updateData.timeLocal = timeLocal;
      if (timezone !== void 0) updateData.timezone = timezone;
      if (createDaysAhead !== void 0) updateData.createDaysAhead = createDaysAhead;
      if (isActive !== void 0) updateData.isActive = isActive;
      if (finalRuleType === "WEEKLY") {
        if (weekdays !== void 0) updateData.weekdays = weekdays;
        updateData.everyNDays = null;
        updateData.startDate = null;
      } else if (finalRuleType === "INTERVAL") {
        if (everyNDays !== void 0) updateData.everyNDays = everyNDays;
        if (startDate !== void 0) updateData.startDate = startDate ? new Date(startDate) : null;
        updateData.weekdays = null;
      } else if (finalRuleType === "DAILY") {
        updateData.weekdays = null;
        updateData.everyNDays = null;
        updateData.startDate = null;
      }
      const [updated] = await db.update(taskSchedules).set(updateData).where(eq2(taskSchedules.id, id)).returning();
      res.json(updated);
    } catch (error) {
      console.error("[Schedules] Failed to update schedule:", error);
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });
  app2.delete("/api/admin/schedules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(taskSchedules).where(eq2(taskSchedules.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      await db.update(taskSchedules).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(taskSchedules.id, id));
      res.json({ success: true, message: "Schedule deactivated" });
    } catch (error) {
      console.error("[Schedules] Failed to delete schedule:", error);
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });
  app2.post("/api/admin/schedules/:id/run", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const authUser = req.authUser;
      const [schedule] = await db.select({
        schedule: taskSchedules,
        stand: stands
      }).from(taskSchedules).leftJoin(stands, eq2(taskSchedules.standId, stands.id)).where(eq2(taskSchedules.id, id));
      if (!schedule || !schedule.schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      if (!schedule.schedule.isActive) {
        return res.status(400).json({ error: "Cannot run inactive schedule" });
      }
      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(/* @__PURE__ */ new Date());
      const dedupKey = `SCHED:${schedule.schedule.id}:${todayStr}`;
      const [existingTask] = await db.select().from(tasks).where(eq2(tasks.dedupKey, dedupKey));
      if (existingTask) {
        return res.status(409).json({
          error: "Task already exists for this schedule today",
          existingTaskId: existingTask.id
        });
      }
      const standIdentifier = schedule.stand?.identifier || "Unknown";
      const [newTask] = await db.insert(tasks).values({
        title: `${schedule.schedule.name} - Stand ${standIdentifier}`,
        description: `Manuell ausgel\xF6st von ${authUser.name}`,
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
        createdBy: authUser.id
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
          source: "MANUAL_TRIGGER"
        }
      });
      res.status(201).json(newTask);
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Task already exists for this schedule today" });
      }
      console.error("[Schedules] Failed to run schedule:", error);
      res.status(500).json({ error: "Failed to run schedule" });
    }
  });
  app2.get("/api/admin/schedules/:id/preview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const days = Math.min(parseInt(req.query.days) || 14, 90);
      const [schedule] = await db.select().from(taskSchedules).where(eq2(taskSchedules.id, id));
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      const timezone = schedule.timezone || "Europe/Berlin";
      const now = /* @__PURE__ */ new Date();
      const previewDates = [];
      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + dayOffset);
        if (schedule.ruleType === "INTERVAL" && schedule.startDate) {
          const startDateLocal = getDateInTimezone(schedule.startDate, timezone);
          const targetDateLocal = getDateInTimezone(targetDate, timezone);
          if (targetDateLocal < startDateLocal) {
            continue;
          }
        }
        if (shouldGenerateForDate(schedule, targetDate, timezone)) {
          const dateStr = formatDateInTimezone(targetDate, timezone);
          const [hours, minutes] = (schedule.timeLocal || "06:00").split(":").map(Number);
          const scheduledTime = `${String(hours || 6).padStart(2, "0")}:${String(minutes || 0).padStart(2, "0")}`;
          const dayOfWeek = getDayOfWeekInTimezone(targetDate, timezone);
          previewDates.push({
            date: dateStr,
            scheduledTime,
            dayOfWeek
          });
        }
      }
      res.json({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        ruleType: schedule.ruleType,
        previewDays: days,
        dates: previewDates
      });
    } catch (error) {
      console.error("[Schedules] Failed to generate preview:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });
  app2.post("/api/admin/tasks", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, standId, description, priority, scheduledFor } = req.body;
      const authUser = req.authUser;
      if (!title || !standId) {
        return res.status(400).json({ error: "Title and standId are required" });
      }
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      let scheduledDate = /* @__PURE__ */ new Date();
      if (scheduledFor) {
        const parsedDate = new Date(scheduledFor);
        if (!parsedDate || isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid scheduledFor date format" });
        }
        scheduledDate = parsedDate;
      }
      const dateStr = formatDateBerlin(scheduledDate);
      const dedupSource = `${title}|${standId}|${dateStr}`;
      const dedupHash = createHash("sha256").update(dedupSource).digest("hex").substring(0, 16);
      const dedupKey = `MANUAL:${dedupHash}`;
      const [newTask] = await db.insert(tasks).values({
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
        createdBy: authUser.id
      }).returning();
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
          source: "MANUAL_CREATION"
        }
      });
      res.status(201).json(newTask);
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "A task with this title already exists for this stand and date" });
      }
      console.error("[Tasks] Failed to create manual task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });
  app2.post("/api/warehouse-containers/:id/empty", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const authUser = req.authUser;
      const [container] = await db.select().from(warehouseContainers).where(eq2(warehouseContainers.id, id));
      if (!container) {
        return res.status(404).json({ error: "Warehouse container not found" });
      }
      const beforeData = {
        currentAmount: container.currentAmount,
        isFull: container.isFull,
        lastEmptied: container.lastEmptied
      };
      const [updated] = await db.update(warehouseContainers).set({
        currentAmount: 0,
        isFull: false,
        lastEmptied: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(warehouseContainers.id, id)).returning();
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
          materialType: container.materialType
        }
      });
      res.json({
        success: true,
        container: updated,
        previousAmount: beforeData.currentAmount
      });
    } catch (error) {
      console.error("[WarehouseContainers] Failed to empty container:", error);
      res.status(500).json({ error: "Failed to empty container" });
    }
  });
  app2.get("/api/customers", async (req, res) => {
    try {
      const customerList = await storage.getCustomers();
      res.json(customerList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });
  app2.get("/api/customers/:id", async (req, res) => {
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
  app2.post("/api/customers", requireAuth, requireAdmin, async (req, res) => {
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
        isActive: true
      });
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });
  app2.patch("/api/customers/:id", async (req, res) => {
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
  app2.get("/api/containers/customer", async (req, res) => {
    try {
      const containers = await storage.getCustomerContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer containers" });
    }
  });
  app2.get("/api/containers/customer/:id", async (req, res) => {
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
  app2.get("/api/containers/customer/qr/:qrCode", async (req, res) => {
    try {
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
  app2.post("/api/containers/customer", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id, ...rest } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Container ID is required" });
      }
      const stableQrCode = `customer-${id}`;
      const container = await storage.createCustomerContainer({
        id,
        ...rest,
        qrCode: stableQrCode
        // Always use stable QR code
      });
      res.status(201).json(container);
    } catch (error) {
      console.error("Error creating customer container:", error);
      res.status(500).json({ error: "Failed to create container" });
    }
  });
  app2.patch("/api/containers/customer/:id", async (req, res) => {
    try {
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
  app2.post("/api/containers/customer/:id/regenerate-qr", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      const existingContainer = await storage.getCustomerContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }
      const oldQrCode = existingContainer.qrCode;
      const newQrCode = `customer-${req.params.id}-${Date.now()}`;
      const container = await storage.updateCustomerContainer(req.params.id, {
        qrCode: newQrCode
      });
      if (!container) {
        return res.status(500).json({ error: "Failed to regenerate QR code" });
      }
      await storage.createActivityLog({
        type: "SYSTEM_EVENT",
        action: "SYSTEM_EVENT",
        message: `QR-Code f\xFCr Container ${req.params.id} wurde neu generiert. Bitte neuen Code ausdrucken und am Container anbringen.`,
        userId: userId || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: /* @__PURE__ */ new Date(),
        details: `Alter QR-Code: ${oldQrCode}`,
        metadata: { oldQrCode, newQrCode, action: "QR_CODE_REGENERATED" }
      });
      res.json(container);
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });
  app2.get("/api/containers/warehouse", async (req, res) => {
    try {
      const containers = await storage.getWarehouseContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch warehouse containers" });
    }
  });
  app2.get("/api/containers/warehouse/:id", async (req, res) => {
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
  app2.get("/api/containers/warehouse/qr/:qrCode", async (req, res) => {
    try {
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
  app2.post("/api/containers/warehouse", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id, ...rest } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Container ID is required" });
      }
      const stableQrCode = `warehouse-${id}`;
      const container = await storage.createWarehouseContainer({
        id,
        ...rest,
        qrCode: stableQrCode
        // Always use stable QR code
      });
      res.status(201).json(container);
    } catch (error) {
      console.error("Error creating warehouse container:", error);
      res.status(500).json({ error: "Failed to create container" });
    }
  });
  app2.patch("/api/containers/warehouse/:id", async (req, res) => {
    try {
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
  app2.post("/api/containers/warehouse/:id/regenerate-qr", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      const existingContainer = await storage.getWarehouseContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }
      const oldQrCode = existingContainer.qrCode;
      const newQrCode = `warehouse-${req.params.id}-${Date.now()}`;
      const container = await storage.updateWarehouseContainer(req.params.id, {
        qrCode: newQrCode
      });
      if (!container) {
        return res.status(500).json({ error: "Failed to regenerate QR code" });
      }
      await storage.createActivityLog({
        type: "SYSTEM_EVENT",
        action: "SYSTEM_EVENT",
        message: `QR-Code f\xFCr Container ${req.params.id} wurde neu generiert. Bitte neuen Code ausdrucken und am Container anbringen.`,
        userId: userId || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: /* @__PURE__ */ new Date(),
        details: `Alter QR-Code: ${oldQrCode}`,
        metadata: { oldQrCode, newQrCode, action: "QR_CODE_REGENERATED" }
      });
      res.json(container);
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });
  app2.post("/api/containers/warehouse/:id/reset", requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      const authUser = req.authUser;
      const userRole = authUser?.role?.toLowerCase();
      if (!authUser || userRole !== "admin" && userRole !== "driver") {
        return res.status(403).json({ error: "Only admin or driver roles can empty containers" });
      }
      const existingContainer = await storage.getWarehouseContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }
      if (existingContainer.currentAmount === 0) {
        return res.json({
          message: "Container is already empty",
          container: existingContainer
        });
      }
      const previousAmount = existingContainer.currentAmount;
      const container = await storage.updateWarehouseContainer(req.params.id, {
        currentAmount: 0,
        lastEmptied: /* @__PURE__ */ new Date()
      });
      if (!container) {
        return res.status(500).json({ error: "Failed to reset container" });
      }
      await storage.createFillHistory({
        warehouseContainerId: req.params.id,
        amountAdded: -previousAmount,
        quantityUnit: existingContainer.quantityUnit,
        taskId: null,
        recordedByUserId: authUser?.id || null
      });
      const roleLabel = userRole === "admin" ? "Admin" : "Fahrer";
      await storage.createActivityLog({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_STATUS_CHANGED",
        message: `Lagercontainer ${req.params.id} wurde von ${roleLabel} ${authUser?.name || "Unbekannt"} geleert (${previousAmount} ${existingContainer.quantityUnit} entfernt)`,
        userId: authUser?.id || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: /* @__PURE__ */ new Date(),
        details: reason || null,
        metadata: { previousAmount, reason, action: "CONTAINER_EMPTIED", role: authUser.role }
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
  app2.get("/api/containers/warehouse/:id/history", async (req, res) => {
    try {
      const history = await storage.getFillHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fill history" });
    }
  });
  app2.get("/api/tasks", async (req, res) => {
    try {
      const { assignedTo, status, date, showAll } = req.query;
      const userId = req.headers["x-user-id"] || req.query.userId;
      let userRole = "DRIVER";
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          userRole = user.role?.toUpperCase() || "DRIVER";
        }
      }
      const filters = {};
      if (userRole === "ADMIN") {
        if (assignedTo) filters.assignedTo = assignedTo;
        if (status) {
          filters.status = status;
        }
      } else {
        if (userId) {
          filters.assignedTo = userId;
        } else if (assignedTo) {
          filters.assignedTo = assignedTo;
        }
        if (status) filters.status = status;
      }
      if (date) filters.date = new Date(date);
      let taskList = await storage.getTasks(Object.keys(filters).length > 0 ? filters : void 0);
      if (userRole === "ADMIN" && !status && showAll !== "true") {
        const FINAL_STATUSES = ["COMPLETED", "CANCELLED"];
        taskList = taskList.filter((t) => !FINAL_STATUSES.includes(t.status));
      }
      res.json(taskList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });
  app2.get("/api/tasks/:id", async (req, res) => {
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
  app2.post("/api/tasks", requireAuth, requireAdmin, async (req, res) => {
    try {
      let materialType = req.body.materialType;
      if (!materialType && req.body.containerID) {
        const container = await storage.getCustomerContainer(req.body.containerID);
        if (container) {
          materialType = container.materialType || "";
        }
      }
      materialType = materialType || "";
      const taskData = {
        ...req.body,
        materialType,
        // Use derived or provided materialType
        status: "OFFEN",
        // Always start with OFFEN - never trust client status
        assignedTo: null,
        // Pull-based: no pre-assignment, drivers claim tasks
        claimedByUserId: null,
        // Not claimed yet
        claimedAt: null
        // Not claimed yet
      };
      if (taskData.scheduledTime) {
        const parsedDate = new Date(taskData.scheduledTime);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid scheduledTime format" });
        }
        taskData.scheduledTime = parsedDate;
      }
      const timestampFields = [
        "assignedAt",
        "acceptedAt",
        "pickedUpAt",
        "inTransitAt",
        "deliveredAt",
        "completedAt",
        "cancelledAt",
        "pickupTimestamp",
        "deliveryTimestamp"
      ];
      for (const field of timestampFields) {
        if (taskData[field]) {
          const parsedDate = new Date(taskData[field]);
          if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: `Invalid ${field} format` });
          }
          taskData[field] = parsedDate;
        }
      }
      if (taskData.deliveryContainerID && taskData.plannedQuantity) {
        const targetContainer = await storage.getWarehouseContainer(taskData.deliveryContainerID);
        if (!targetContainer) {
          return res.status(400).json({ error: "Zielcontainer nicht gefunden" });
        }
        const remainingCapacity = targetContainer.maxCapacity - targetContainer.currentAmount;
        if (taskData.plannedQuantity > remainingCapacity) {
          return res.status(400).json({
            error: "Zielcontainer hat nicht genug \xFCbriges Volumen f\xFCr diese Menge.",
            remainingCapacity,
            requestedAmount: taskData.plannedQuantity,
            unit: targetContainer.quantityUnit
          });
        }
      }
      const task = await storage.createTask(taskData);
      await storage.createActivityLog({
        type: "TASK_CREATED",
        action: "TASK_CREATED",
        message: `Auftrag erstellt f\xFCr Container ${task.containerID}`,
        userId: req.body.createdBy || null,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: /* @__PURE__ */ new Date(),
        details: null,
        metadata: null,
        location: null,
        scanEventId: null
      });
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create task:", error);
      res.status(500).json({ error: "Failed to create task", details: error instanceof Error ? error.message : String(error) });
    }
  });
  app2.patch("/api/tasks/:id", async (req, res) => {
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
  app2.delete("/api/tasks/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const taskId = req.params.id;
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }
      const deleted = await storage.deleteTask(taskId);
      if (!deleted) {
        return res.status(500).json({ error: "Fehler beim L\xF6schen des Auftrags" });
      }
      await storage.createActivityLog({
        type: "TASK_DELETED",
        action: "TASK_DELETED",
        message: `Auftrag ${taskId} wurde von Admin ${authUser?.name || "Unbekannt"} gel\xF6scht`,
        userId: authUser?.id || null,
        taskId: null,
        // Task no longer exists
        containerId: task.containerID,
        scanEventId: null,
        location: null,
        timestamp: /* @__PURE__ */ new Date(),
        details: `Status vor L\xF6schung: ${task.status}`,
        metadata: {
          deletedTaskId: taskId,
          taskStatus: task.status,
          containerId: task.containerID,
          assignedTo: task.assignedTo
        }
      });
      res.json({ message: "Auftrag erfolgreich gel\xF6scht" });
    } catch (error) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Fehler beim L\xF6schen des Auftrags" });
    }
  });
  app2.post("/api/tasks/:id/assign", async (req, res) => {
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
        timestamp: /* @__PURE__ */ new Date(),
        details: null,
        metadata: null,
        location: null,
        scanEventId: null
      });
      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign task" });
    }
  });
  app2.post("/api/tasks/:id/accept", async (req, res) => {
    try {
      const { userId, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      if (!isAdmin && !isAssignedDriver && task.assignedTo) {
        return res.status(403).json({
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag annehmen.",
          assignedTo: task.assignedTo
        });
      }
      const LATER_STATES = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
      if (LATER_STATES.includes(task.status)) {
        const sourceContainer2 = await storage.getCustomerContainer(task.containerID);
        let targetContainer2 = null;
        if (task.deliveryContainerID) {
          targetContainer2 = await storage.getWarehouseContainer(task.deliveryContainerID);
        }
        const response2 = {
          task,
          alreadyAccepted: true,
          sourceContainer: sourceContainer2 ? {
            id: sourceContainer2.id,
            label: sourceContainer2.id,
            location: sourceContainer2.location,
            content: sourceContainer2.materialType,
            materialType: sourceContainer2.materialType,
            customerName: sourceContainer2.customerName,
            unit: task.plannedQuantityUnit || "kg",
            currentQuantity: task.estimatedAmount || 0,
            plannedPickupQuantity: task.plannedQuantity || task.estimatedAmount || 0
          } : null
        };
        if (targetContainer2) {
          response2.targetContainer = {
            id: targetContainer2.id,
            label: targetContainer2.id,
            location: targetContainer2.location,
            content: targetContainer2.materialType,
            materialType: targetContainer2.materialType,
            capacity: targetContainer2.maxCapacity,
            currentFill: targetContainer2.currentAmount,
            remainingCapacity: targetContainer2.maxCapacity - targetContainer2.currentAmount,
            unit: targetContainer2.quantityUnit
          };
        }
        return res.json(response2);
      }
      const sourceContainer = await storage.getCustomerContainer(task.containerID);
      if (!sourceContainer) {
        return res.status(404).json({ error: "Kundencontainer nicht gefunden" });
      }
      let targetContainer = null;
      if (task.deliveryContainerID) {
        targetContainer = await storage.getWarehouseContainer(task.deliveryContainerID);
        if (targetContainer) {
          if (sourceContainer.materialType !== targetContainer.materialType) {
            return res.status(400).json({
              error: "Der Zielcontainer enth\xE4lt ein anderes Material. Bitte w\xE4hle einen passenden Lagercontainer.",
              sourceMaterial: sourceContainer.materialType,
              targetMaterial: targetContainer.materialType
            });
          }
          const remainingCapacity = targetContainer.maxCapacity - targetContainer.currentAmount;
          if (task.plannedQuantity && task.plannedQuantity > remainingCapacity) {
            return res.status(400).json({
              error: "Zielcontainer hat nicht genug \xFCbriges Volumen f\xFCr diese Menge.",
              remainingCapacity,
              requestedAmount: task.plannedQuantity,
              unit: targetContainer.quantityUnit
            });
          }
        }
      }
      const updatedTask = await storage.updateTaskStatus(req.params.id, "ACCEPTED", userId);
      if (!updatedTask) {
        return res.status(400).json({ error: "Ung\xFCltiger Status-\xDCbergang. Aktueller Status: " + task.status });
      }
      await storage.updateTask(req.params.id, {
        pickupLocation: location
      });
      const scanEvent = await storage.createScanEvent({
        containerId: task.containerID,
        containerType: "customer",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: /* @__PURE__ */ new Date(),
        scanContext: "TASK_ACCEPT_AT_CUSTOMER",
        locationType: "CUSTOMER",
        locationDetails: location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null
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
        timestamp: /* @__PURE__ */ new Date(),
        details: null,
        metadata: { autoAssigned: task.status === "PLANNED" }
      });
      const response = {
        task: updatedTask,
        sourceContainer: {
          id: sourceContainer.id,
          label: sourceContainer.id,
          location: sourceContainer.location,
          content: sourceContainer.materialType,
          // content field maps to materialType
          materialType: sourceContainer.materialType,
          customerName: sourceContainer.customerName,
          unit: updatedTask.plannedQuantityUnit || "kg",
          currentQuantity: updatedTask.estimatedAmount || 0,
          plannedPickupQuantity: updatedTask.plannedQuantity || updatedTask.estimatedAmount || 0
        }
      };
      if (targetContainer) {
        response.targetContainer = {
          id: targetContainer.id,
          label: targetContainer.id,
          location: targetContainer.location,
          content: targetContainer.materialType,
          // content field maps to materialType
          materialType: targetContainer.materialType,
          capacity: targetContainer.maxCapacity,
          currentFill: targetContainer.currentAmount,
          remainingCapacity: targetContainer.maxCapacity - targetContainer.currentAmount,
          unit: targetContainer.quantityUnit
        };
      }
      res.json(response);
    } catch (error) {
      console.error("Failed to accept task:", error);
      res.status(500).json({ error: "Fehler beim Annehmen des Auftrags" });
    }
  });
  app2.post("/api/tasks/:id/pickup", async (req, res) => {
    try {
      const { userId, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      if (!isAdmin && !isAssignedDriver) {
        return res.status(403).json({
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag abholen.",
          assignedTo: task.assignedTo
        });
      }
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
        return res.status(400).json({ error: "Ung\xFCltiger Status-\xDCbergang" });
      }
      const scanEvent = await storage.createScanEvent({
        containerId: task.containerID,
        containerType: "customer",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: /* @__PURE__ */ new Date(),
        scanContext: "TASK_PICKUP",
        locationType: "CUSTOMER",
        locationDetails: location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null
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
        timestamp: /* @__PURE__ */ new Date(),
        details: null,
        metadata: null
      });
      res.json(updatedTask);
    } catch (error) {
      console.error("Failed to pickup task:", error);
      res.status(500).json({ error: "Fehler beim Abholen des Containers" });
    }
  });
  app2.post("/api/tasks/:id/delivery", async (req, res) => {
    try {
      const { userId, warehouseContainerId, amount, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      if (!isAdmin && !isAssignedDriver) {
        return res.status(403).json({
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag abliefern.",
          assignedTo: task.assignedTo
        });
      }
      if (task.status === "COMPLETED") {
        return res.json({ ...task, alreadyCompleted: true });
      }
      const warehouseContainer = await storage.getWarehouseContainer(warehouseContainerId);
      if (!warehouseContainer) {
        return res.status(404).json({ error: "Lagercontainer nicht gefunden" });
      }
      if (warehouseContainer.materialType !== task.materialType) {
        return res.status(400).json({
          error: "Der Zielcontainer enth\xE4lt ein anderes Material. Bitte w\xE4hle einen passenden Lagercontainer.",
          sourceMaterial: task.materialType,
          targetMaterial: warehouseContainer.materialType
        });
      }
      const deliveredAmount = amount || task.plannedQuantity || task.estimatedAmount || 0;
      const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
      if (deliveredAmount > availableSpace) {
        return res.status(400).json({
          error: "Zielcontainer hat nicht genug \xFCbriges Volumen f\xFCr diese Menge.",
          remainingCapacity: availableSpace,
          requestedAmount: deliveredAmount,
          unit: warehouseContainer.quantityUnit
        });
      }
      let updatedTask = await storage.updateTaskStatus(req.params.id, "DELIVERED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Ung\xFCltiger Status-\xDCbergang" });
      }
      await storage.updateTask(req.params.id, {
        deliveryContainerID: warehouseContainerId
      });
      const scanEvent = await storage.createScanEvent({
        containerId: warehouseContainerId,
        containerType: "warehouse",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: /* @__PURE__ */ new Date(),
        scanContext: "TASK_COMPLETE_AT_WAREHOUSE",
        locationType: "WAREHOUSE",
        locationDetails: warehouseContainer.warehouseZone || location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null
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
        timestamp: /* @__PURE__ */ new Date(),
        details: null,
        metadata: null
      });
      const newAmount = warehouseContainer.currentAmount + deliveredAmount;
      await storage.updateWarehouseContainer(warehouseContainerId, {
        currentAmount: newAmount
      });
      await storage.createFillHistory({
        warehouseContainerId,
        amountAdded: deliveredAmount,
        quantityUnit: warehouseContainer.quantityUnit,
        taskId: task.id,
        recordedByUserId: userId
      });
      await storage.updateCustomerContainer(task.containerID, {
        lastEmptied: /* @__PURE__ */ new Date(),
        status: "AT_CUSTOMER"
      });
      await storage.updateTask(req.params.id, {
        actualQuantity: deliveredAmount
      });
      updatedTask = await storage.updateTaskStatus(req.params.id, "COMPLETED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Fehler beim Abschlie\xDFen des Auftrags" });
      }
      await storage.createActivityLog({
        type: "TASK_COMPLETED",
        action: "TASK_COMPLETED",
        message: `Auftrag ${task.id} abgeschlossen, ${deliveredAmount} ${warehouseContainer.quantityUnit} erfasst`,
        userId,
        taskId: task.id,
        containerId: warehouseContainerId,
        timestamp: /* @__PURE__ */ new Date(),
        metadata: { amountAdded: deliveredAmount, unit: warehouseContainer.quantityUnit },
        details: null,
        location: null,
        scanEventId: null
      });
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
          amountAdded: deliveredAmount
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record delivery" });
    }
  });
  app2.post("/api/tasks/:id/cancel", async (req, res) => {
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
        cancellationReason: reason
      });
      await storage.createActivityLog({
        type: "TASK_CANCELLED",
        action: "TASK_CANCELLED",
        message: `Auftrag ${task.id} wurde storniert: ${reason || "Kein Grund angegeben"}`,
        userId,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: /* @__PURE__ */ new Date(),
        metadata: { reason },
        details: null,
        location: null,
        scanEventId: null
      });
      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel task" });
    }
  });
  app2.post("/api/tasks/:id/claim", requireAuth, async (req, res) => {
    try {
      const authUser = req.authUser;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }
      const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "DISPOSED"];
      if (TERMINAL_STATUSES.includes(task.status)) {
        return res.status(400).json({
          error: "Abgeschlossene Auftr\xE4ge k\xF6nnen nicht beansprucht werden",
          currentStatus: task.status
        });
      }
      const now = /* @__PURE__ */ new Date();
      let autoReleasedExpired = false;
      if (task.claimedByUserId) {
        if (!isClaimExpired(task.claimedAt)) {
          const claimingUser = await storage.getUser(task.claimedByUserId);
          return res.status(409).json({
            error: "Auftrag wurde bereits von einem anderen Benutzer beansprucht",
            claimedBy: claimingUser?.name || "Unbekannt",
            claimedAt: task.claimedAt,
            expiresAt: task.claimedAt ? new Date(task.claimedAt.getTime() + CLAIM_TTL_MINUTES * 60 * 1e3) : null
          });
        } else {
          autoReleasedExpired = true;
          const standMeta2 = task.standId ? await buildStandContextMeta(task.standId) : {};
          await createAuditEvent({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "AUTO_RELEASE_EXPIRED",
            entityType: "task",
            entityId: task.id,
            beforeData: { claimedByUserId: task.claimedByUserId, claimedAt: task.claimedAt },
            afterData: { claimedByUserId: null, claimedAt: null },
            metaJson: {
              ...standMeta2,
              boxId: task.boxId || void 0,
              reason: "Claim expired after TTL"
            }
          });
        }
      }
      await storage.updateTask(req.params.id, {
        claimedByUserId: authUser.id,
        claimedAt: now
      });
      const updatedTask = await storage.getTask(req.params.id);
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
          boxId: task.boxId || void 0,
          autoReleasedExpired
        }
      });
      res.json({
        task: updatedTask,
        claimed: true,
        expiresAt: new Date(now.getTime() + CLAIM_TTL_MINUTES * 60 * 1e3),
        autoReleasedExpired
      });
    } catch (error) {
      console.error("Failed to claim task:", error);
      res.status(500).json({ error: "Fehler beim Beanspruchen des Auftrags" });
    }
  });
  app2.post("/api/tasks/:id/release", requireAuth, async (req, res) => {
    try {
      const authUser = req.authUser;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }
      const previousClaim = {
        claimedByUserId: task.claimedByUserId,
        claimedAt: task.claimedAt
      };
      await storage.updateTask(req.params.id, {
        claimedByUserId: null,
        claimedAt: null
      });
      const updatedTask = await storage.getTask(req.params.id);
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
          boxId: task.boxId || void 0
        }
      });
      res.json({
        task: updatedTask,
        released: true
      });
    } catch (error) {
      console.error("Failed to release task:", error);
      res.status(500).json({ error: "Fehler beim Freigeben des Auftrags" });
    }
  });
  app2.post("/api/tasks/:id/transition", requireAuth, async (req, res) => {
    try {
      const { toStatus, weightKg, targetWarehouseContainerId, reason } = req.body;
      const authUser = req.authUser;
      if (!toStatus) {
        return res.status(400).json({ error: "toStatus is required" });
      }
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }
      try {
        assertAutomotiveTransition(task.status, toStatus);
      } catch (error) {
        return res.status(409).json({
          error: error.message,
          currentStatus: task.status,
          requestedStatus: toStatus
        });
      }
      if (task.status === "TAKEN_OVER" && toStatus === "WEIGHED") {
        if (weightKg === void 0 || weightKg === null) {
          return res.status(400).json({ error: "weightKg is required for WEIGHED status" });
        }
      }
      const now = /* @__PURE__ */ new Date();
      let autoClaimed = false;
      let autoReleased = false;
      const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};
      if (!task.claimedByUserId || isClaimExpired(task.claimedAt)) {
        autoClaimed = true;
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
            boxId: task.boxId || void 0,
            reason: "Auto-claimed before status transition"
          }
        });
      }
      const beforeData = {
        status: task.status,
        weightKg: task.weightKg,
        targetWarehouseContainerId: task.targetWarehouseContainerId,
        claimedByUserId: task.claimedByUserId,
        claimedAt: task.claimedAt
      };
      const updateData = {
        status: toStatus,
        updatedAt: now
      };
      if (autoClaimed) {
        updateData.claimedByUserId = authUser.id;
        updateData.claimedAt = now;
      }
      if (toStatus === "DROPPED_OFF") {
        updateData.claimedByUserId = null;
        updateData.claimedAt = null;
        autoReleased = true;
      }
      const timestampField = getAutomotiveTimestampFieldForStatus(toStatus);
      if (timestampField) {
        updateData[timestampField] = now;
      }
      if (weightKg !== void 0) {
        updateData.weightKg = weightKg;
        updateData.weighedByUserId = authUser.id;
      }
      if (targetWarehouseContainerId !== void 0) {
        updateData.targetWarehouseContainerId = targetWarehouseContainerId;
      }
      if (reason !== void 0) {
        updateData.cancellationReason = reason;
      }
      await storage.updateTask(req.params.id, updateData);
      if ((toStatus === "DISPOSED" || toStatus === "CANCELLED") && task.boxId) {
        await db.update(boxes).set({
          currentTaskId: null,
          status: toStatus === "DISPOSED" ? "AT_WAREHOUSE" : "AT_STAND",
          updatedAt: now
        }).where(eq2(boxes.id, task.boxId));
      }
      const eventMetaJson = {
        ...standMeta,
        boxId: task.boxId || void 0,
        containerId: task.boxId || void 0,
        targetWarehouseContainerId: updateData.targetWarehouseContainerId || void 0,
        autoClaimed,
        autoReleased
      };
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
        metaJson: eventMetaJson
      });
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
            boxId: task.boxId || void 0,
            reason: "Auto-released on DROPPED_OFF transition"
          }
        });
      }
      if (toStatus === "WEIGHED" && weightKg !== void 0) {
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "WEIGHT_RECORDED",
          entityType: "task",
          entityId: task.id,
          beforeData: { weightKg: task.weightKg },
          afterData: { weightKg },
          metaJson: eventMetaJson
        });
      }
      const updatedTask = await storage.getTask(req.params.id);
      res.json({
        task: updatedTask,
        transitioned: true,
        fromStatus: task.status,
        toStatus,
        autoClaimed,
        autoReleased
      });
    } catch (error) {
      console.error("Failed to transition task:", error);
      res.status(500).json({ error: "Fehler beim Statuswechsel des Auftrags" });
    }
  });
  app2.post("/api/tasks/:id/handover", requireAuth, async (req, res) => {
    try {
      const { newUserId } = req.body;
      const authUser = req.authUser;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }
      if (!newUserId) {
        return res.status(400).json({ error: "newUserId ist erforderlich" });
      }
      const newUser = await storage.getUser(newUserId);
      if (!newUser) {
        return res.status(404).json({ error: "Neuer Benutzer nicht gefunden" });
      }
      const userRole = authUser.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isCurrentOwner = task.claimedByUserId === authUser.id || task.assignedTo === authUser.id;
      if (!isAdmin && !isCurrentOwner) {
        return res.status(403).json({
          error: "Nur der aktuelle Besitzer oder ein Admin kann diesen Auftrag \xFCbergeben"
        });
      }
      const NON_TRANSFERABLE_STATUSES = ["COMPLETED", "CANCELLED"];
      if (NON_TRANSFERABLE_STATUSES.includes(task.status)) {
        return res.status(400).json({
          error: "Abgeschlossene oder stornierte Auftr\xE4ge k\xF6nnen nicht \xFCbergeben werden",
          currentStatus: task.status
        });
      }
      const oldUser = task.claimedByUserId ? await storage.getUser(task.claimedByUserId) : authUser;
      const oldUserName = oldUser?.name || "Unbekannt";
      const now = /* @__PURE__ */ new Date();
      await storage.updateTask(req.params.id, {
        claimedByUserId: newUserId,
        assignedTo: newUserId,
        handoverAt: now
      });
      const updatedTask = await storage.getTask(req.params.id);
      await storage.createActivityLog({
        type: "TASK_ASSIGNED",
        action: "TASK_ASSIGNED",
        message: `Auftrag \xFCbergeben von ${oldUserName} an ${newUser.name}`,
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
        scanEventId: null
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
      res.status(500).json({ error: "Fehler bei der Auftrags\xFCbergabe" });
    }
  });
  app2.get("/api/scan-events", async (req, res) => {
    try {
      const { containerId, taskId, userId } = req.query;
      const filters = {};
      if (containerId) filters.containerId = containerId;
      if (taskId) filters.taskId = taskId;
      if (userId) filters.userId = userId;
      const events = await storage.getScanEvents(Object.keys(filters).length > 0 ? filters : void 0);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scan events" });
    }
  });
  app2.get("/api/scan-events/:id", async (req, res) => {
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
  app2.post("/api/scan-events", async (req, res) => {
    try {
      const { containerId, containerType, userId, scanContext, locationType, locationDetails, geoLocation, taskId, measuredWeight } = req.body;
      if (!containerId || !containerType || !userId || !scanContext || !locationType) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (scanContext === "TASK_COMPLETE_AT_WAREHOUSE") {
        if (!taskId) {
          return res.status(400).json({ error: "taskId ist erforderlich f\xFCr Lager-Abschluss-Scan" });
        }
        if (measuredWeight === void 0 || measuredWeight === null) {
          return res.status(400).json({ error: "measuredWeight ist erforderlich f\xFCr Lager-Abschluss-Scan" });
        }
        const weight = parseFloat(measuredWeight);
        if (isNaN(weight) || weight <= 0) {
          return res.status(400).json({ error: "measuredWeight muss gr\xF6\xDFer als 0 sein" });
        }
        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({ error: "Auftrag nicht gefunden" });
        }
        const warehouseContainer = await storage.getWarehouseContainer(containerId);
        if (!warehouseContainer) {
          return res.status(404).json({ error: "Lagercontainer nicht gefunden" });
        }
        const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
        if (weight > availableSpace) {
          return res.status(400).json({
            error: "Zielcontainer hat nicht genug \xFCbriges Volumen f\xFCr diese Menge.",
            remainingCapacity: availableSpace,
            requestedAmount: weight,
            unit: warehouseContainer.quantityUnit
          });
        }
        const scanEvent2 = await storage.createScanEvent({
          containerId,
          containerType,
          taskId,
          scannedByUserId: userId,
          scannedAt: /* @__PURE__ */ new Date(),
          scanContext,
          locationType,
          locationDetails: locationDetails || warehouseContainer.warehouseZone || null,
          geoLocation: geoLocation || null,
          scanResult: "SUCCESS",
          resultMessage: null,
          extraData: { measuredWeight: weight }
        });
        await storage.updateTask(taskId, {
          measuredWeight: weight,
          actualQuantity: weight,
          deliveryContainerID: containerId
        });
        const newAmount = warehouseContainer.currentAmount + weight;
        await storage.updateWarehouseContainer(containerId, {
          currentAmount: newAmount
        });
        await storage.createFillHistory({
          warehouseContainerId: containerId,
          amountAdded: weight,
          quantityUnit: warehouseContainer.quantityUnit,
          taskId,
          recordedByUserId: userId
        });
        if (task.containerID) {
          await storage.updateCustomerContainer(task.containerID, {
            lastEmptied: /* @__PURE__ */ new Date(),
            status: "AT_CUSTOMER"
          });
        }
        await storage.updateTaskStatus(taskId, "COMPLETED");
        const user = await storage.getUser(userId);
        const userName = user?.name || "Unbekannt";
        await storage.createActivityLog({
          type: "WEIGHT_RECORDED",
          action: "WEIGHT_RECORDED",
          message: `Gewicht erfasst: ${weight} ${warehouseContainer.quantityUnit} von ${userName}`,
          userId,
          taskId,
          containerId,
          scanEventId: scanEvent2.id,
          location: geoLocation || null,
          timestamp: /* @__PURE__ */ new Date(),
          details: null,
          metadata: { measuredWeight: weight, unit: warehouseContainer.quantityUnit }
        });
        await storage.createActivityLog({
          type: "TASK_COMPLETED",
          action: "TASK_COMPLETED",
          message: `Auftrag ${taskId} abgeschlossen, ${weight} ${warehouseContainer.quantityUnit} erfasst`,
          userId,
          taskId,
          containerId,
          scanEventId: scanEvent2.id,
          location: geoLocation || null,
          timestamp: /* @__PURE__ */ new Date(),
          details: null,
          metadata: { measuredWeight: weight, unit: warehouseContainer.quantityUnit }
        });
        const updatedTask = await storage.getTask(taskId);
        return res.status(201).json({
          scanEvent: scanEvent2,
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
            amountAdded: weight
          }
        });
      }
      const scanEvent = await storage.createScanEvent({
        containerId,
        containerType,
        taskId: taskId || null,
        scannedByUserId: userId,
        scannedAt: /* @__PURE__ */ new Date(),
        scanContext,
        locationType,
        locationDetails: locationDetails || null,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null
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
        timestamp: /* @__PURE__ */ new Date(),
        details: null,
        metadata: null
      });
      res.status(201).json(scanEvent);
    } catch (error) {
      console.error("Failed to create scan event:", error);
      res.status(500).json({ error: "Failed to create scan event" });
    }
  });
  app2.get("/api/activity-logs", async (req, res) => {
    try {
      const { userId, containerId, type, taskId, startDate, endDate } = req.query;
      const filters = {};
      if (userId) filters.userId = userId;
      if (containerId) filters.containerId = containerId;
      if (type) filters.type = type;
      if (taskId) filters.taskId = taskId;
      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : void 0);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });
  app2.get("/api/activity-logs/export/csv", async (req, res) => {
    try {
      const { userId, containerId, type, taskId, startDate, endDate } = req.query;
      const filters = {};
      if (userId) filters.userId = userId;
      if (containerId) filters.containerId = containerId;
      if (type) filters.type = type;
      if (taskId) filters.taskId = taskId;
      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : void 0);
      const users2 = await storage.getUsers();
      const getUserName = (id) => {
        if (!id) return "System";
        const user = users2.find((u) => u.id === id);
        return user?.name || "Unknown";
      };
      const csvHeader = "ID,Datum,Uhrzeit,Benutzer,Typ,Nachricht,Container ID,Auftrag ID\n";
      const csvRows = logs.map((log2) => {
        const date = new Date(log2.timestamp);
        const dateStr = date.toLocaleDateString("de-DE");
        const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const userName = getUserName(log2.userId).replace(/,/g, ";");
        const logType = (log2.type || "").replace(/,/g, ";");
        const message = (log2.message || "").replace(/,/g, ";").replace(/\n/g, " ");
        const containerId2 = (log2.containerId || "").replace(/,/g, ";");
        const taskIdVal = (log2.taskId || "").replace(/,/g, ";");
        return `${log2.id},${dateStr},${timeStr},${userName},${logType},${message},${containerId2},${taskIdVal}`;
      }).join("\n");
      const csv = csvHeader + csvRows;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=aktivitaetslog-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`);
      res.send("\uFEFF" + csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export activity logs" });
    }
  });
  app2.get("/api/analytics/driver-performance", async (req, res) => {
    try {
      const allTasks = await storage.getTasks();
      const users2 = await storage.getUsers();
      const drivers = users2.filter((u) => u.role === "driver" || u.role === "DRIVER");
      const now = /* @__PURE__ */ new Date();
      const today = now.toDateString();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      const driverStats = drivers.map((driver) => {
        const driverTasks = allTasks.filter((t) => t.assignedTo === driver.id);
        const completedTasks = driverTasks.filter((t) => t.status === "COMPLETED" || t.status === "completed");
        const completedToday = completedTasks.filter((t) => {
          if (!t.completedAt) return false;
          return new Date(t.completedAt).toDateString() === today;
        });
        const completedThisWeek = completedTasks.filter((t) => {
          if (!t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return completedDate >= startOfWeek;
        });
        const avgDeliveryTime = completedTasks.length > 0 ? completedTasks.reduce((sum2, t) => {
          if (t.acceptedAt && t.completedAt) {
            return sum2 + (new Date(t.completedAt).getTime() - new Date(t.acceptedAt).getTime());
          }
          return sum2;
        }, 0) / completedTasks.length / (1e3 * 60) : 0;
        const completionRate = driverTasks.length > 0 ? Math.round(completedTasks.length / driverTasks.length * 100) : 0;
        const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "in_progress"];
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          totalAssigned: driverTasks.length,
          totalCompleted: completedTasks.length,
          completedToday: completedToday.length,
          completedThisWeek: completedThisWeek.length,
          inProgress: driverTasks.filter((t) => inProgressStatuses.includes(t.status)).length,
          completionRate,
          avgDeliveryTimeMinutes: Math.round(avgDeliveryTime)
        };
      });
      const overallStats = {
        totalDrivers: drivers.length,
        activeDrivers: driverStats.filter((d) => d.inProgress > 0 || d.completedToday > 0).length,
        totalCompletedToday: driverStats.reduce((sum2, d) => sum2 + d.completedToday, 0),
        totalCompletedThisWeek: driverStats.reduce((sum2, d) => sum2 + d.completedThisWeek, 0),
        avgCompletionRate: driverStats.length > 0 ? Math.round(driverStats.reduce((sum2, d) => sum2 + d.completionRate, 0) / driverStats.length) : 0
      };
      res.json({
        drivers: driverStats,
        overall: overallStats
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver performance" });
    }
  });
  app2.get("/api/analytics/fill-trends", async (req, res) => {
    try {
      const warehouseContainers2 = await storage.getWarehouseContainers();
      const allTasks = await storage.getTasks();
      const now = /* @__PURE__ */ new Date();
      const daysAgo = (days) => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date;
      };
      const dailyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = daysAgo(i);
        const dateStr = date.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
        const dayTasks = allTasks.filter((t) => {
          if (!t.completedAt) return false;
          const taskDate = new Date(t.completedAt);
          return taskDate.toDateString() === date.toDateString();
        });
        const totalDelivered = dayTasks.reduce((sum2, t) => {
          const container = warehouseContainers2.find((c) => c.id === t.deliveryContainerID);
          return sum2 + (container ? 50 : 0);
        }, 0);
        dailyData.push({
          date: dateStr,
          deliveries: dayTasks.length,
          volumeKg: totalDelivered
        });
      }
      const currentFillLevels = warehouseContainers2.map((c) => ({
        id: c.id,
        location: c.location,
        materialType: c.materialType,
        currentAmount: c.currentAmount,
        maxCapacity: c.maxCapacity,
        fillPercentage: Math.round(c.currentAmount / c.maxCapacity * 100)
      }));
      const materialBreakdown = warehouseContainers2.reduce((acc, c) => {
        const existing = acc.find((m) => m.material === c.materialType);
        if (existing) {
          existing.currentAmount += c.currentAmount;
          existing.maxCapacity += c.maxCapacity;
        } else {
          acc.push({
            material: c.materialType,
            currentAmount: c.currentAmount,
            maxCapacity: c.maxCapacity
          });
        }
        return acc;
      }, []);
      res.json({
        dailyTrends: dailyData,
        containerLevels: currentFillLevels,
        materialBreakdown
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });
  app2.get("/api/dashboard/stats", async (req, res) => {
    try {
      const { driverId } = req.query;
      const allTasks = await storage.getTasks();
      const warehouseContainers2 = await storage.getWarehouseContainers();
      const users2 = await storage.getUsers();
      const tasksToCount = driverId ? allTasks.filter((t) => t.assignedTo === driverId) : allTasks;
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = /* @__PURE__ */ new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayTasks = tasksToCount.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= today && created <= todayEnd;
      });
      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];
      const openTasks = tasksToCount.filter((t) => openStatuses.includes(t.status)).length;
      const inProgressTasks = tasksToCount.filter((t) => inProgressStatuses.includes(t.status)).length;
      const completedTasks = tasksToCount.filter((t) => completedStatuses.includes(t.status)).length;
      const completedToday = todayTasks.filter((t) => completedStatuses.includes(t.status)).length;
      const cancelledTasks = tasksToCount.filter((t) => cancelledStatuses.includes(t.status)).length;
      const activeDrivers = users2.filter((u) => (u.role === "driver" || u.role === "DRIVER") && u.isActive).length;
      const criticalContainers = warehouseContainers2.filter((c) => {
        const fillPercentage = c.currentAmount / c.maxCapacity * 100;
        return fillPercentage >= 80;
      }).length;
      const totalCapacity = warehouseContainers2.reduce((acc, c) => acc + c.maxCapacity, 0);
      const usedCapacity = warehouseContainers2.reduce((acc, c) => acc + c.currentAmount, 0);
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
        totalTasks: tasksToCount.length
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });
  app2.get("/api/drivers/:id/stats", async (req, res) => {
    try {
      const driverId = req.params.id;
      const driver = await storage.getUser(driverId);
      if (!driver) {
        return res.status(404).json({ error: "Fahrer nicht gefunden" });
      }
      const allTasks = await storage.getTasks({ assignedTo: driverId });
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = /* @__PURE__ */ new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayTasks = allTasks.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= today && created <= todayEnd;
      });
      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];
      const openTasks = allTasks.filter((t) => openStatuses.includes(t.status)).length;
      const inProgressTasks = allTasks.filter((t) => inProgressStatuses.includes(t.status)).length;
      const completedTasks = allTasks.filter((t) => completedStatuses.includes(t.status)).length;
      const completedToday = todayTasks.filter((t) => completedStatuses.includes(t.status)).length;
      const cancelledTasks = allTasks.filter((t) => cancelledStatuses.includes(t.status)).length;
      const activityLogs2 = await storage.getActivityLogs({ userId: driverId });
      const lastActivity = activityLogs2.length > 0 ? activityLogs2[0].timestamp : null;
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
        lastActivity
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver stats" });
    }
  });
  app2.get("/api/drivers/overview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users2 = await storage.getUsers();
      const allTasks = await storage.getTasks();
      const drivers = users2.filter((u) => u.role === "DRIVER" || u.role === "driver");
      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];
      const driverOverview = await Promise.all(drivers.map(async (driver) => {
        const driverTasks = allTasks.filter((t) => t.assignedTo === driver.id);
        const activityLogs2 = await storage.getActivityLogs({ userId: driver.id });
        const lastActivity = activityLogs2.length > 0 ? activityLogs2[0].timestamp : null;
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          isActive: driver.isActive,
          openTasks: driverTasks.filter((t) => openStatuses.includes(t.status)).length,
          inProgressTasks: driverTasks.filter((t) => inProgressStatuses.includes(t.status)).length,
          completedTasks: driverTasks.filter((t) => completedStatuses.includes(t.status)).length,
          cancelledTasks: driverTasks.filter((t) => cancelledStatuses.includes(t.status)).length,
          totalTasks: driverTasks.length,
          lastActivity
        };
      }));
      res.json(driverOverview);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver overview" });
    }
  });
  app2.get("/api/materials", async (req, res) => {
    try {
      const result = await db.select().from(materials).where(eq2(materials.isActive, true));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch materials:", error);
      res.status(500).json({ error: "Failed to fetch materials" });
    }
  });
  app2.get("/api/materials/:id", async (req, res) => {
    try {
      const [material] = await db.select().from(materials).where(eq2(materials.id, req.params.id));
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      res.json(material);
    } catch (error) {
      console.error("Failed to fetch material:", error);
      res.status(500).json({ error: "Failed to fetch material" });
    }
  });
  app2.post("/api/materials", requireAuth, requireAdmin, async (req, res) => {
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
        qrCode: qrCode || null
      }).returning();
      res.status(201).json(material);
    } catch (error) {
      console.error("Failed to create material:", error);
      res.status(500).json({ error: "Failed to create material" });
    }
  });
  app2.put("/api/materials/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(materials).where(eq2(materials.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Material not found" });
      }
      const { name, code, description, hazardClass, disposalStream, densityHint, defaultUnit, qrCode, isActive } = req.body;
      const [material] = await db.update(materials).set({
        ...name !== void 0 && { name },
        ...code !== void 0 && { code },
        ...description !== void 0 && { description },
        ...hazardClass !== void 0 && { hazardClass },
        ...disposalStream !== void 0 && { disposalStream },
        ...densityHint !== void 0 && { densityHint },
        ...defaultUnit !== void 0 && { defaultUnit },
        ...qrCode !== void 0 && { qrCode },
        ...isActive !== void 0 && { isActive },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(materials.id, req.params.id)).returning();
      res.json(material);
    } catch (error) {
      console.error("Failed to update material:", error);
      res.status(500).json({ error: "Failed to update material" });
    }
  });
  app2.get("/api/halls", async (req, res) => {
    try {
      const result = await db.select().from(halls).where(eq2(halls.isActive, true));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch halls:", error);
      res.status(500).json({ error: "Failed to fetch halls" });
    }
  });
  app2.get("/api/halls/:id", async (req, res) => {
    try {
      const [hall] = await db.select().from(halls).where(eq2(halls.id, req.params.id));
      if (!hall) {
        return res.status(404).json({ error: "Hall not found" });
      }
      const hallStations = await db.select().from(stations).where(
        and2(eq2(stations.hallId, req.params.id), eq2(stations.isActive, true))
      );
      res.json({ ...hall, stations: hallStations });
    } catch (error) {
      console.error("Failed to fetch hall:", error);
      res.status(500).json({ error: "Failed to fetch hall" });
    }
  });
  app2.post("/api/halls", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description, locationMeta } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }
      const [hall] = await db.insert(halls).values({
        name,
        code,
        description: description || null,
        locationMeta: locationMeta || null
      }).returning();
      res.status(201).json(hall);
    } catch (error) {
      console.error("Failed to create hall:", error);
      res.status(500).json({ error: "Failed to create hall" });
    }
  });
  app2.get("/api/stations", async (req, res) => {
    try {
      const { hallId } = req.query;
      let conditions = [eq2(stations.isActive, true)];
      if (hallId && typeof hallId === "string") {
        conditions.push(eq2(stations.hallId, hallId));
      }
      const result = await db.select().from(stations).where(and2(...conditions));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch stations:", error);
      res.status(500).json({ error: "Failed to fetch stations" });
    }
  });
  app2.get("/api/stations/:id", async (req, res) => {
    try {
      const [station] = await db.select().from(stations).where(eq2(stations.id, req.params.id));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }
      const stationStands = await db.select().from(stands).where(
        and2(eq2(stands.stationId, req.params.id), eq2(stands.isActive, true))
      );
      res.json({ ...station, stands: stationStands });
    } catch (error) {
      console.error("Failed to fetch station:", error);
      res.status(500).json({ error: "Failed to fetch station" });
    }
  });
  app2.get("/api/stations/:id/details", requireAuth, async (req, res) => {
    try {
      const [station] = await db.select().from(stations).where(eq2(stations.id, req.params.id));
      if (!station) {
        return res.status(404).json({ error: "Station nicht gefunden" });
      }
      const [hall] = await db.select().from(halls).where(eq2(halls.id, station.hallId));
      const stationStands = await db.select().from(stands).where(
        and2(eq2(stands.stationId, req.params.id), eq2(stands.isActive, true))
      );
      const materialIds = stationStands.map((s) => s.materialId).filter(Boolean);
      const standMaterials = materialIds.length > 0 ? await db.select().from(materials).where(inArray(materials.id, materialIds)) : [];
      const materialMap = new Map(standMaterials.map((m) => [m.id, m]));
      const standIds = stationStands.map((s) => s.id);
      const standBoxes = standIds.length > 0 ? await db.select().from(boxes).where(
        and2(inArray(boxes.standId, standIds), eq2(boxes.isActive, true))
      ) : [];
      const openTasks = standIds.length > 0 ? await db.select().from(tasks).where(
        and2(
          inArray(tasks.standId, standIds),
          notInArray(tasks.status, ["DISPOSED", "CANCELLED", "COMPLETED", "completed"])
        )
      ) : [];
      const standsWithDetails = stationStands.map((stand) => ({
        ...stand,
        material: stand.materialId ? materialMap.get(stand.materialId) || null : null,
        boxes: standBoxes.filter((b) => b.standId === stand.id),
        openTasks: openTasks.filter((t) => t.standId === stand.id)
      }));
      res.json({
        ...station,
        hall: hall || null,
        stands: standsWithDetails,
        totalBoxes: standBoxes.length,
        totalOpenTasks: openTasks.length
      });
    } catch (error) {
      console.error("Failed to fetch station details:", error);
      res.status(500).json({ error: "Fehler beim Laden der Stationsdetails" });
    }
  });
  app2.post("/api/stations", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { hallId, name, code, sequence, locationMeta } = req.body;
      if (!hallId || !name || !code) {
        return res.status(400).json({ error: "hallId, name, and code are required" });
      }
      const [hall] = await db.select().from(halls).where(eq2(halls.id, hallId));
      if (!hall) {
        return res.status(404).json({ error: "Hall not found" });
      }
      const [existingStation] = await db.select().from(stations).where(
        and2(eq2(stations.hallId, hallId), eq2(stations.code, code))
      );
      if (existingStation) {
        return res.status(400).json({ error: `Stationscode '${code}' existiert bereits in dieser Halle` });
      }
      const [station] = await db.insert(stations).values({
        hallId,
        name,
        code,
        sequence: sequence || null,
        locationMeta: locationMeta || null
      }).returning();
      res.status(201).json(station);
    } catch (error) {
      console.error("Failed to create station:", error);
      res.status(500).json({ error: "Failed to create station" });
    }
  });
  app2.put("/api/stations/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, sequence, locationMeta, positionMeta, isActive } = req.body;
      const [existingStation] = await db.select().from(stations).where(eq2(stations.id, req.params.id));
      if (!existingStation) {
        return res.status(404).json({ error: "Station not found" });
      }
      if (code && code !== existingStation.code) {
        const [duplicateStation] = await db.select().from(stations).where(
          and2(
            eq2(stations.hallId, existingStation.hallId),
            eq2(stations.code, code),
            sql3`${stations.id} != ${req.params.id}`
          )
        );
        if (duplicateStation) {
          return res.status(400).json({ error: `Stationscode '${code}' existiert bereits in dieser Halle` });
        }
      }
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (name !== void 0) updateData.name = name;
      if (code !== void 0) updateData.code = code;
      if (sequence !== void 0) updateData.sequence = sequence;
      if (locationMeta !== void 0) updateData.locationMeta = locationMeta;
      if (positionMeta !== void 0) updateData.positionMeta = positionMeta;
      if (isActive !== void 0) updateData.isActive = isActive;
      const [updatedStation] = await db.update(stations).set(updateData).where(eq2(stations.id, req.params.id)).returning();
      res.json(updatedStation);
    } catch (error) {
      console.error("Failed to update station:", error);
      res.status(500).json({ error: "Failed to update station" });
    }
  });
  app2.patch("/api/stations/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { hallId } = req.body;
      const authUser = req.authUser;
      if (!hallId) {
        return res.status(400).json({ error: "hallId ist erforderlich" });
      }
      const [existingStation] = await db.select().from(stations).where(eq2(stations.id, req.params.id));
      if (!existingStation) {
        return res.status(404).json({ error: "Station nicht gefunden" });
      }
      if (hallId === existingStation.hallId) {
        return res.status(400).json({ error: "Station ist bereits in dieser Halle" });
      }
      const [targetHall] = await db.select().from(halls).where(eq2(halls.id, hallId));
      if (!targetHall) {
        return res.status(404).json({ error: "Ziel-Halle nicht gefunden" });
      }
      if (!targetHall.isActive) {
        return res.status(400).json({ error: "Ziel-Halle ist nicht aktiv" });
      }
      const [duplicateStation] = await db.select().from(stations).where(
        and2(eq2(stations.hallId, hallId), eq2(stations.code, existingStation.code))
      );
      if (duplicateStation) {
        return res.status(400).json({ error: `Stationscode '${existingStation.code}' existiert bereits in der Ziel-Halle` });
      }
      const [sourceHall] = await db.select().from(halls).where(eq2(halls.id, existingStation.hallId));
      const [updatedStation] = await db.update(stations).set({ hallId, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stations.id, req.params.id)).returning();
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
          toHallName: targetHall.name
        }
      });
      res.json(updatedStation);
    } catch (error) {
      console.error("Failed to move station:", error);
      res.status(500).json({ error: "Fehler beim Verschieben der Station" });
    }
  });
  app2.patch("/api/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { materialId, isActive, stationId } = req.body;
      const authUser = req.authUser;
      if (materialId === void 0 && isActive === void 0 && stationId === void 0) {
        return res.status(400).json({ error: "Keine \xC4nderungen angegeben" });
      }
      const [existingStand] = await db.select().from(stands).where(eq2(stands.id, req.params.id));
      if (!existingStand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }
      const changes = [];
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (materialId !== void 0 && materialId !== existingStand.materialId) {
        if (materialId !== null) {
          const [targetMaterial] = await db.select().from(materials).where(eq2(materials.id, materialId));
          if (!targetMaterial) {
            return res.status(404).json({ error: "Material nicht gefunden" });
          }
          if (!targetMaterial.isActive) {
            return res.status(400).json({ error: "Material ist nicht aktiv" });
          }
          changes.push(`Material: ${existingStand.materialId || "keins"} \u2192 ${materialId}`);
        } else {
          changes.push(`Material entfernt`);
        }
        updateData.materialId = materialId;
      }
      if (stationId !== void 0 && stationId !== existingStand.stationId) {
        const [targetStation] = await db.select().from(stations).where(eq2(stations.id, stationId));
        if (!targetStation) {
          return res.status(404).json({ error: "Ziel-Station nicht gefunden" });
        }
        if (!targetStation.isActive) {
          return res.status(400).json({ error: "Ziel-Station ist nicht aktiv" });
        }
        const [targetHall] = await db.select().from(halls).where(eq2(halls.id, targetStation.hallId));
        if (!targetHall?.isActive) {
          return res.status(400).json({ error: "Halle der Ziel-Station ist nicht aktiv" });
        }
        changes.push(`Station: ${existingStand.stationId} \u2192 ${stationId}`);
        updateData.stationId = stationId;
      }
      if (isActive !== void 0 && isActive !== existingStand.isActive) {
        updateData.isActive = isActive;
        changes.push(`Aktiv: ${existingStand.isActive} \u2192 ${isActive}`);
        if (!isActive && existingStand.isActive) {
          const standBoxes = await db.select().from(boxes).where(
            and2(eq2(boxes.standId, req.params.id), eq2(boxes.isActive, true))
          );
          if (standBoxes.length > 0) {
            await db.update(boxes).set({ standId: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(boxes.standId, req.params.id));
            changes.push(`${standBoxes.length} Box(en) vom Stellplatz abgemeldet`);
          }
        }
      }
      if (Object.keys(updateData).length === 1) {
        return res.status(400).json({ error: "Keine \xC4nderungen vorgenommen" });
      }
      const [updatedStand] = await db.update(stands).set(updateData).where(eq2(stands.id, req.params.id)).returning();
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
            isActive: existingStand.isActive
          },
          after: {
            materialId: updatedStand.materialId,
            stationId: updatedStand.stationId,
            isActive: updatedStand.isActive
          }
        }
      });
      res.json(updatedStand);
    } catch (error) {
      console.error("Failed to edit stand:", error);
      res.status(500).json({ error: "Fehler beim Bearbeiten des Stellplatzes" });
    }
  });
  app2.get("/api/stands", async (req, res) => {
    try {
      const { stationId, materialId, includeInactive } = req.query;
      let conditions = [];
      if (includeInactive !== "true") {
        conditions.push(eq2(stands.isActive, true));
      }
      if (stationId && typeof stationId === "string") {
        conditions.push(eq2(stands.stationId, stationId));
      }
      if (materialId && typeof materialId === "string") {
        conditions.push(eq2(stands.materialId, materialId));
      }
      const result = conditions.length > 0 ? await db.select().from(stands).where(and2(...conditions)) : await db.select().from(stands);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch stands:", error);
      res.status(500).json({ error: "Failed to fetch stands" });
    }
  });
  app2.get("/api/stands/qr/:qrCode", async (req, res) => {
    try {
      const [stand] = await db.select().from(stands).where(eq2(stands.qrCode, req.params.qrCode));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      const [station] = await db.select().from(stations).where(eq2(stations.id, stand.stationId));
      const [hall] = station ? await db.select().from(halls).where(eq2(halls.id, station.hallId)) : [null];
      const [material] = stand.materialId ? await db.select().from(materials).where(eq2(materials.id, stand.materialId)) : [null];
      const standBoxes = await db.select().from(boxes).where(eq2(boxes.standId, stand.id));
      res.json({ stand, station, hall, material, boxes: standBoxes });
    } catch (error) {
      console.error("Failed to fetch stand by QR:", error);
      res.status(500).json({ error: "Failed to fetch stand" });
    }
  });
  app2.get("/api/stands/:id", async (req, res) => {
    try {
      const [stand] = await db.select().from(stands).where(eq2(stands.id, req.params.id));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      res.json(stand);
    } catch (error) {
      console.error("Failed to fetch stand:", error);
      res.status(500).json({ error: "Failed to fetch stand" });
    }
  });
  app2.post("/api/stands", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { stationId, identifier, materialId, qrCode, sequence, positionMeta, dailyFull } = req.body;
      if (!stationId || !identifier || !qrCode) {
        return res.status(400).json({ error: "stationId, identifier, and qrCode are required" });
      }
      const [station] = await db.select().from(stations).where(eq2(stations.id, stationId));
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
        dailyFull: dailyFull || false
      }).returning();
      res.status(201).json(stand);
    } catch (error) {
      console.error("Failed to create stand:", error);
      res.status(500).json({ error: "Failed to create stand" });
    }
  });
  app2.put("/api/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(stands).where(eq2(stands.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Stand not found" });
      }
      const { identifier, materialId, qrCode, sequence, positionMeta, dailyFull, isActive } = req.body;
      const [stand] = await db.update(stands).set({
        ...identifier !== void 0 && { identifier },
        ...materialId !== void 0 && { materialId },
        ...qrCode !== void 0 && { qrCode },
        ...sequence !== void 0 && { sequence },
        ...positionMeta !== void 0 && { positionMeta },
        ...dailyFull !== void 0 && { dailyFull },
        ...isActive !== void 0 && { isActive },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(stands.id, req.params.id)).returning();
      res.json(stand);
    } catch (error) {
      console.error("Failed to update stand:", error);
      res.status(500).json({ error: "Failed to update stand" });
    }
  });
  app2.patch("/api/automotive/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(stands).where(eq2(stands.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Stand not found" });
      }
      const { dailyFull, dailyTaskTimeLocal, identifier, materialId, qrCode, sequence, positionMeta, isActive } = req.body;
      const [stand] = await db.update(stands).set({
        ...dailyFull !== void 0 && { dailyFull },
        ...dailyTaskTimeLocal !== void 0 && { dailyTaskTimeLocal },
        ...identifier !== void 0 && { identifier },
        ...materialId !== void 0 && { materialId },
        ...qrCode !== void 0 && { qrCode },
        ...sequence !== void 0 && { sequence },
        ...positionMeta !== void 0 && { positionMeta },
        ...isActive !== void 0 && { isActive },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(stands.id, req.params.id)).returning();
      res.json(stand);
    } catch (error) {
      console.error("Failed to patch stand:", error);
      res.status(500).json({ error: "Failed to update stand" });
    }
  });
  app2.get("/api/boxes", async (req, res) => {
    try {
      const { includeInactive, standId } = req.query;
      const conditions = [];
      if (includeInactive !== "true") {
        conditions.push(eq2(boxes.isActive, true));
      }
      if (standId) {
        conditions.push(eq2(boxes.standId, standId));
      }
      const result = conditions.length > 0 ? await db.select().from(boxes).where(and2(...conditions)) : await db.select().from(boxes);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch boxes:", error);
      res.status(500).json({ error: "Failed to fetch boxes" });
    }
  });
  app2.get("/api/admin/stands/:standId/boxes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { standId } = req.params;
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }
      const result = await db.select().from(boxes).where(
        and2(eq2(boxes.standId, standId), eq2(boxes.isActive, true))
      );
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch boxes for stand:", error);
      res.status(500).json({ error: "Failed to fetch boxes" });
    }
  });
  app2.post("/api/admin/stands/:standId/assign-box", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { standId } = req.params;
      const { boxId, boxSerial, boxQr } = req.body;
      const authUser = req.authUser;
      if (!boxId && !boxSerial && !boxQr) {
        return res.status(400).json({ error: "boxId, boxSerial oder boxQr erforderlich" });
      }
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }
      let box;
      if (boxId) {
        [box] = await db.select().from(boxes).where(eq2(boxes.id, boxId));
      } else if (boxSerial) {
        [box] = await db.select().from(boxes).where(eq2(boxes.serial, boxSerial));
      } else if (boxQr) {
        [box] = await db.select().from(boxes).where(eq2(boxes.qrCode, boxQr));
      }
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }
      if (!box.isActive) {
        return res.status(400).json({ error: "Box ist deaktiviert" });
      }
      if (box.standId !== null && box.standId !== standId) {
        const [currentStand] = await db.select().from(stands).where(eq2(stands.id, box.standId));
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
      const [updatedBox] = await db.update(boxes).set({
        standId,
        status: "AT_STAND",
        lastSeenAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(boxes.id, box.id)).returning();
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
          after: { standId, status: "AT_STAND" }
        }
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
        metaJson: { ...standMeta, boxId: box.id, source: "ADMIN_UI" }
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
  app2.post("/api/admin/stands/:standId/unassign-box", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { standId } = req.params;
      const { boxId } = req.body;
      const authUser = req.authUser;
      if (!boxId) {
        return res.status(400).json({ error: "boxId erforderlich" });
      }
      const [box] = await db.select().from(boxes).where(eq2(boxes.id, boxId));
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }
      if (box.standId !== standId) {
        return res.status(400).json({ error: "Box ist nicht an diesem Stellplatz" });
      }
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
      const beforeData = { standId: box.standId, status: box.status };
      const [updatedBox] = await db.update(boxes).set({
        standId: null,
        status: "IN_TRANSIT",
        lastSeenAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(boxes.id, boxId)).returning();
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
          after: { standId: null, status: "IN_TRANSIT" }
        }
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
        metaJson: { ...standMeta, boxId, source: "ADMIN_UI" }
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
  app2.get("/api/boxes/qr/:qrCode", async (req, res) => {
    try {
      const [box] = await db.select().from(boxes).where(eq2(boxes.qrCode, req.params.qrCode));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      res.json(box);
    } catch (error) {
      console.error("Failed to fetch box by QR:", error);
      res.status(500).json({ error: "Failed to fetch box" });
    }
  });
  app2.get("/api/boxes/:id", async (req, res) => {
    try {
      const [box] = await db.select().from(boxes).where(eq2(boxes.id, req.params.id));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      res.json(box);
    } catch (error) {
      console.error("Failed to fetch box:", error);
      res.status(500).json({ error: "Failed to fetch box" });
    }
  });
  app2.post("/api/boxes", requireAuth, requireAdmin, async (req, res) => {
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
        notes: notes || null
      }).returning();
      res.status(201).json(box);
    } catch (error) {
      console.error("Failed to create box:", error);
      res.status(500).json({ error: "Failed to create box" });
    }
  });
  app2.put("/api/boxes/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const [existing] = await db.select().from(boxes).where(eq2(boxes.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Box not found" });
      }
      const { qrCode, serial, standId, status, notes, isActive } = req.body;
      const wasAtStand = existing.standId !== null;
      const beingRemovedFromStand = standId === null && wasAtStand;
      const [box] = await db.update(boxes).set({
        ...qrCode !== void 0 && { qrCode },
        ...serial !== void 0 && { serial },
        ...standId !== void 0 && { standId },
        ...status !== void 0 && { status },
        ...notes !== void 0 && { notes },
        ...isActive !== void 0 && { isActive },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(boxes.id, req.params.id)).returning();
      if (beingRemovedFromStand) {
        const standMeta = await buildStandContextMeta(existing.standId);
        await createAuditEvent({
          taskId: existing.currentTaskId || req.params.id,
          actorUserId: authUser.id,
          action: "BOX_REMOVED",
          entityType: "box",
          entityId: existing.id,
          beforeData: { standId: existing.standId, status: existing.status },
          afterData: { standId: null, status: status || existing.status },
          metaJson: { ...standMeta, boxId: existing.id, source: "ADMIN_UI" }
        });
      }
      res.json(box);
    } catch (error) {
      console.error("Failed to update box:", error);
      res.status(500).json({ error: "Failed to update box" });
    }
  });
  app2.post("/api/boxes/:id/position", requireAuth, async (req, res) => {
    try {
      const { stationId, standId } = req.body;
      const authUser = req.authUser;
      if (!standId) {
        return res.status(400).json({ error: "standId is required" });
      }
      const [box] = await db.select().from(boxes).where(eq2(boxes.id, req.params.id));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      const [station] = await db.select().from(stations).where(eq2(stations.id, stand.stationId));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }
      const [hall] = await db.select().from(halls).where(eq2(halls.id, station.hallId));
      let material = null;
      if (stand.materialId) {
        const [mat] = await db.select().from(materials).where(eq2(materials.id, stand.materialId));
        material = mat;
      }
      const beforeData = { standId: box.standId, status: box.status };
      const placementChanged = box.standId !== standId;
      const [updatedBox] = await db.update(boxes).set({
        standId,
        status: "AT_STAND",
        lastSeenAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(boxes.id, req.params.id)).returning();
      const standMeta = await buildStandContextMeta(standId);
      const eventMetaJson = {
        ...standMeta,
        boxId: box.id,
        containerId: box.id,
        previousStandId: box.standId || void 0
      };
      await createAuditEvent({
        taskId: box.currentTaskId || req.params.id,
        actorUserId: authUser.id,
        action: placementChanged ? "PLACEMENT_CHANGED" : "BOX_POSITIONED",
        entityType: "box",
        entityId: box.id,
        beforeData,
        afterData: { standId, status: "AT_STAND" },
        metaJson: eventMetaJson
      });
      res.json({
        box: updatedBox,
        stand,
        material,
        station,
        hall
      });
    } catch (error) {
      console.error("Failed to position box:", error);
      res.status(500).json({ error: "Failed to position box" });
    }
  });
  app2.get("/api/automotive/tasks", requireAuth, async (req, res) => {
    try {
      const { status, materialId, stationId, hallId, from, to, scheduledFor } = req.query;
      const conditions = [];
      if (status) {
        conditions.push(eq2(tasks.status, status));
      }
      if (materialId) {
        conditions.push(eq2(tasks.materialType, materialId));
      }
      if (scheduledFor) {
        const scheduledDate = new Date(scheduledFor);
        scheduledDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(scheduledDate);
        nextDay.setDate(nextDay.getDate() + 1);
        conditions.push(gte2(tasks.scheduledFor, scheduledDate));
        conditions.push(lte2(tasks.scheduledFor, nextDay));
      }
      if (from) {
        conditions.push(gte2(tasks.scheduledFor, new Date(from)));
      }
      if (to) {
        conditions.push(lte2(tasks.scheduledFor, new Date(to)));
      }
      let query = db.select({
        task: tasks,
        stand: stands,
        station: stations,
        hall: halls,
        material: materials,
        claimedByUser: users
      }).from(tasks).leftJoin(stands, eq2(tasks.standId, stands.id)).leftJoin(stations, eq2(stands.stationId, stations.id)).leftJoin(halls, eq2(stations.hallId, halls.id)).leftJoin(materials, eq2(tasks.materialType, materials.id)).leftJoin(users, eq2(tasks.claimedByUserId, users.id));
      if (stationId) {
        conditions.push(eq2(stands.stationId, stationId));
      }
      if (hallId) {
        conditions.push(eq2(stations.hallId, hallId));
      }
      const result = conditions.length > 0 ? await query.where(and2(...conditions)).orderBy(desc2(tasks.createdAt)) : await query.orderBy(desc2(tasks.createdAt));
      const tasksWithDetails = result.map((row) => ({
        ...row.task,
        stand: row.stand,
        station: row.station,
        hall: row.hall,
        material: row.material,
        claimedByUser: row.claimedByUser ? {
          id: row.claimedByUser.id,
          name: row.claimedByUser.name,
          email: row.claimedByUser.email
        } : null
      }));
      res.json(tasksWithDetails);
    } catch (error) {
      console.error("Failed to fetch automotive tasks:", error);
      res.status(500).json({ error: "Failed to fetch automotive tasks" });
    }
  });
  app2.post("/api/automotive/tasks", requireAuth, async (req, res) => {
    try {
      const { boxId, standId, taskType } = req.body;
      const authUser = req.authUser;
      if (!boxId || !standId) {
        return res.status(400).json({ error: "boxId and standId are required" });
      }
      const validTaskTypes = ["MANUAL", "DAILY_FULL"];
      if (taskType && !validTaskTypes.includes(taskType)) {
        return res.status(400).json({ error: "taskType must be MANUAL or DAILY_FULL" });
      }
      const [box] = await db.select().from(boxes).where(eq2(boxes.id, boxId));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      const activeTaskStatuses = ["OPEN", "PICKED_UP", "IN_TRANSIT", "DROPPED_OFF", "TAKEN_OVER", "WEIGHED"];
      const existingActiveTasks = await db.select().from(tasks).where(
        and2(
          eq2(tasks.boxId, boxId),
          notInArray(tasks.status, ["DISPOSED", "CANCELLED"])
        )
      );
      if (existingActiveTasks.length > 0) {
        return res.status(409).json({
          error: "Box already has an active task",
          activeTask: existingActiveTasks[0]
        });
      }
      const [station] = await db.select().from(stations).where(eq2(stations.id, stand.stationId));
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
        priority: "normal"
      }).returning();
      await db.update(boxes).set({ currentTaskId: task.id, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(boxes.id, boxId));
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
          source: "MANUAL"
        }
      });
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create automotive task:", error);
      res.status(500).json({ error: "Failed to create automotive task" });
    }
  });
  app2.put("/api/automotive/tasks/:id/status", requireAuth, async (req, res) => {
    try {
      const { status, weightKg, targetWarehouseContainerId, reason, scannedBoxId, scannedStandId } = req.body;
      const authUser = req.authUser;
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }
      const [task] = await db.select().from(tasks).where(eq2(tasks.id, req.params.id));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      try {
        assertAutomotiveTransition(task.status, status);
      } catch (error) {
        return res.status(409).json({
          error: error.message,
          currentStatus: task.status,
          requestedStatus: status
        });
      }
      const boxScanRequired = [
        { from: "OPEN", to: "PICKED_UP" },
        { from: "IN_TRANSIT", to: "DROPPED_OFF" },
        { from: "DROPPED_OFF", to: "TAKEN_OVER" },
        { from: "TAKEN_OVER", to: "WEIGHED" },
        { from: "WEIGHED", to: "DISPOSED" }
      ];
      const requiresBoxScan = boxScanRequired.some(
        (t) => t.from === task.status && t.to === status
      );
      if (requiresBoxScan && !scannedBoxId) {
        return res.status(400).json({ error: "Box-Scan erforderlich" });
      }
      if (scannedBoxId && task.boxId && scannedBoxId !== task.boxId) {
        return res.status(400).json({ error: "Gescannte Box stimmt nicht mit der Aufgabe \xFCberein" });
      }
      if (task.status === "OPEN" && status === "PICKED_UP" && scannedBoxId) {
        const [scannedBox] = await db.select().from(boxes).where(eq2(boxes.id, scannedBoxId));
        if (!scannedBox) {
          return res.status(404).json({ error: "Gescannte Box nicht gefunden" });
        }
        if (task.standId && scannedBox.standId !== task.standId) {
          return res.status(400).json({ error: "Box befindet sich nicht am richtigen Stand" });
        }
      }
      if (task.status === "IN_TRANSIT" && status === "DROPPED_OFF") {
        if (!scannedStandId) {
          return res.status(400).json({ error: "Stand-Scan erforderlich f\xFCr Abgabe" });
        }
        const [scannedStand] = await db.select().from(stands).where(eq2(stands.id, scannedStandId));
        if (!scannedStand) {
          return res.status(404).json({ error: "Gescannter Stand nicht gefunden" });
        }
      }
      if (task.status === "TAKEN_OVER" && status === "WEIGHED") {
        if (weightKg === void 0 || weightKg === null) {
          return res.status(400).json({ error: "weightKg is required for WEIGHED status" });
        }
      }
      const now = /* @__PURE__ */ new Date();
      let autoClaimed = false;
      let autoReleased = false;
      const standMeta = task.standId ? await buildStandContextMeta(task.standId) : {};
      if (!task.claimedByUserId || isClaimExpired(task.claimedAt)) {
        autoClaimed = true;
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
            boxId: task.boxId || void 0,
            reason: "Auto-claimed before status transition"
          }
        });
      }
      const beforeData = {
        status: task.status,
        weightKg: task.weightKg,
        targetWarehouseContainerId: task.targetWarehouseContainerId,
        claimedByUserId: task.claimedByUserId,
        claimedAt: task.claimedAt
      };
      const updateData = {
        status,
        updatedAt: now
      };
      if (scannedBoxId && !task.boxId) {
        updateData.boxId = scannedBoxId;
      }
      if (autoClaimed) {
        updateData.claimedByUserId = authUser.id;
        updateData.claimedAt = now;
      }
      if (status === "DROPPED_OFF") {
        updateData.claimedByUserId = null;
        updateData.claimedAt = null;
        autoReleased = true;
      }
      const timestampField = getAutomotiveTimestampFieldForStatus(status);
      if (timestampField) {
        updateData[timestampField] = now;
      }
      if (weightKg !== void 0) {
        updateData.weightKg = weightKg;
        updateData.weighedByUserId = authUser.id;
      }
      if (targetWarehouseContainerId !== void 0) {
        updateData.targetWarehouseContainerId = targetWarehouseContainerId;
      }
      if (reason !== void 0) {
        updateData.cancellationReason = reason;
      }
      const [updatedTask] = await db.update(tasks).set(updateData).where(eq2(tasks.id, req.params.id)).returning();
      const effectiveBoxId = scannedBoxId || task.boxId;
      if (status === "PICKED_UP" && effectiveBoxId) {
        await db.update(boxes).set({
          standId: null,
          status: "IN_TRANSIT",
          currentTaskId: updatedTask.id,
          lastSeenAt: now,
          updatedAt: now
        }).where(eq2(boxes.id, effectiveBoxId));
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
            source: "PICKUP_SCAN"
          }
        });
      }
      if (status === "DROPPED_OFF" && effectiveBoxId && scannedStandId) {
        await db.update(boxes).set({
          standId: scannedStandId,
          status: "AT_STAND",
          lastSeenAt: now,
          updatedAt: now
        }).where(eq2(boxes.id, effectiveBoxId));
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
            source: "DROPOFF_SCAN"
          }
        });
      }
      if (status === "DISPOSED" || status === "CANCELLED") {
        if (effectiveBoxId) {
          await db.update(boxes).set({
            currentTaskId: null,
            status: status === "DISPOSED" ? "AT_WAREHOUSE" : "AT_STAND",
            updatedAt: now
          }).where(eq2(boxes.id, effectiveBoxId));
        }
      }
      const eventMetaJson = {
        ...standMeta,
        boxId: task.boxId || void 0,
        containerId: task.boxId || void 0,
        targetWarehouseContainerId: updateData.targetWarehouseContainerId || void 0,
        autoClaimed,
        autoReleased
      };
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
        metaJson: eventMetaJson
      });
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
            boxId: task.boxId || void 0,
            reason: "Auto-released on DROPPED_OFF transition"
          }
        });
      }
      if (status === "WEIGHED" && weightKg !== void 0) {
        await createAuditEvent({
          taskId: task.id,
          actorUserId: authUser.id,
          action: "WEIGHT_RECORDED",
          entityType: "task",
          entityId: task.id,
          beforeData: { weightKg: task.weightKg },
          afterData: { weightKg },
          metaJson: eventMetaJson
        });
      }
      res.json({ ...updatedTask, autoClaimed, autoReleased });
    } catch (error) {
      console.error("Failed to update task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });
  app2.get("/api/automotive/tasks/:id/suggest-container", async (req, res) => {
    try {
      const [task] = await db.select().from(tasks).where(eq2(tasks.id, req.params.id));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      let materialId = task.materialType;
      if (task.standId) {
        const [stand] = await db.select().from(stands).where(eq2(stands.id, task.standId));
        if (stand && stand.materialId) {
          materialId = stand.materialId;
        }
      }
      const containers = await db.select().from(warehouseContainers).where(
        and2(
          eq2(warehouseContainers.isActive, true),
          eq2(warehouseContainers.isFull, false),
          eq2(warehouseContainers.isBlocked, false),
          materialId ? eq2(warehouseContainers.materialId, materialId) : isNull(warehouseContainers.materialId)
        )
      );
      const sortedContainers = containers.map((c) => ({
        ...c,
        availableCapacity: c.maxCapacity - c.currentAmount
      })).sort((a, b) => b.availableCapacity - a.availableCapacity);
      res.json(sortedContainers);
    } catch (error) {
      console.error("Failed to suggest container:", error);
      res.status(500).json({ error: "Failed to suggest container" });
    }
  });
  app2.post("/api/automotive/daily-tasks/generate", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const now = /* @__PURE__ */ new Date();
      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(/* @__PURE__ */ new Date());
      const openDailyTasks = await db.select().from(tasks).where(
        and2(eq2(tasks.taskType, "DAILY_FULL"), eq2(tasks.status, "OPEN"))
      );
      let cancelledCount = 0;
      for (const task of openDailyTasks) {
        if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
          await db.update(tasks).set({
            status: "CANCELLED",
            cancelledAt: /* @__PURE__ */ new Date(),
            cancellationReason: "Auto-cancelled: New daily task generated",
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq2(tasks.id, task.id));
          cancelledCount++;
        }
      }
      const dailyFullStands = await db.select().from(stands).where(
        and2(
          eq2(stands.dailyFull, true),
          eq2(stands.isActive, true)
        )
      );
      const createdTasks = [];
      const skipped = [];
      for (const stand of dailyFullStands) {
        const dedupKey = `DAILY:${stand.id}:${todayStr}`;
        try {
          const [task] = await db.insert(tasks).values({
            title: `T\xE4gliche Abholung - Stand ${stand.identifier}`,
            description: `Automatisch generierte t\xE4gliche Abholung f\xFCr Stand ${stand.identifier}`,
            containerID: null,
            boxId: null,
            standId: stand.id,
            materialType: stand.materialId || null,
            taskType: "DAILY_FULL",
            status: "OPEN",
            createdBy: authUser.id,
            priority: "normal",
            scheduledFor: today,
            dedupKey
          }).returning();
          await db.update(stands).set({ lastDailyTaskGeneratedAt: now, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stands.id, stand.id));
          await db.insert(taskEvents).values({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "TASK_CREATED",
            entityType: "task",
            entityId: task.id,
            beforeData: null,
            afterData: { status: "OPEN", boxId: null, standId: stand.id, taskType: "DAILY_FULL", dedupKey }
          });
          createdTasks.push({
            task,
            stand: { id: stand.id, identifier: stand.identifier }
          });
        } catch (e) {
          if (e?.code === "23505") {
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
        skipped,
        generatedAt: now.toISOString()
      });
    } catch (error) {
      console.error("Failed to generate daily tasks:", error);
      res.status(500).json({ error: "Failed to generate daily tasks" });
    }
  });
  app2.get("/api/automotive/daily-tasks/status", async (req, res) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dailyFullStands = await db.select().from(stands).where(
        and2(
          eq2(stands.dailyFull, true),
          eq2(stands.isActive, true)
        )
      );
      const status = dailyFullStands.map((stand) => ({
        standId: stand.id,
        identifier: stand.identifier,
        lastGeneratedAt: stand.lastDailyTaskGeneratedAt?.toISOString() || null,
        generatedToday: stand.lastDailyTaskGeneratedAt ? stand.lastDailyTaskGeneratedAt >= todayStart : false
      }));
      const totalStands = status.length;
      const generatedToday = status.filter((s) => s.generatedToday).length;
      const pendingToday = totalStands - generatedToday;
      res.json({
        totalDailyFullStands: totalStands,
        generatedToday,
        pendingToday,
        stands: status,
        checkedAt: now.toISOString()
      });
    } catch (error) {
      console.error("Failed to get daily tasks status:", error);
      res.status(500).json({ error: "Failed to get daily tasks status" });
    }
  });
  app2.get("/api/daily-tasks/today", async (req, res) => {
    try {
      const todayStr = formatDateBerlin(/* @__PURE__ */ new Date());
      const todayTasks = await db.select().from(tasks).where(
        and2(
          eq2(tasks.taskType, "DAILY_FULL"),
          eq2(tasks.status, "OPEN")
        )
      );
      const filteredTasks = todayTasks.filter(
        (t) => t.dedupKey?.startsWith(`DAILY:`) && t.dedupKey?.endsWith(`:${todayStr}`)
      );
      res.json(filteredTasks);
    } catch (error) {
      console.error("Failed to fetch today's daily tasks:", error);
      res.status(500).json({ error: "Failed to fetch today's daily tasks" });
    }
  });
  app2.post("/api/admin/daily-tasks/run", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const now = /* @__PURE__ */ new Date();
      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(/* @__PURE__ */ new Date());
      const openDailyTasks = await db.select().from(tasks).where(
        and2(eq2(tasks.taskType, "DAILY_FULL"), eq2(tasks.status, "OPEN"))
      );
      let cancelledCount = 0;
      for (const task of openDailyTasks) {
        if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
          await db.update(tasks).set({
            status: "CANCELLED",
            cancelledAt: /* @__PURE__ */ new Date(),
            cancellationReason: "Auto-cancelled: New daily task generated",
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq2(tasks.id, task.id));
          cancelledCount++;
        }
      }
      const dailyFullStands = await db.select().from(stands).where(
        and2(
          eq2(stands.dailyFull, true),
          eq2(stands.isActive, true)
        )
      );
      const createdTasks = [];
      const skipped = [];
      for (const stand of dailyFullStands) {
        const dedupKey = `DAILY:${stand.id}:${todayStr}`;
        try {
          const [task] = await db.insert(tasks).values({
            title: `T\xE4gliche Abholung - Stand ${stand.identifier}`,
            description: `Automatisch generierte t\xE4gliche Abholung f\xFCr Stand ${stand.identifier}`,
            containerID: null,
            boxId: null,
            standId: stand.id,
            materialType: stand.materialId || null,
            taskType: "DAILY_FULL",
            status: "OPEN",
            createdBy: authUser.id,
            priority: "normal",
            scheduledFor: today,
            dedupKey
          }).returning();
          await db.update(stands).set({ lastDailyTaskGeneratedAt: now, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stands.id, stand.id));
          await db.insert(taskEvents).values({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "TASK_CREATED",
            entityType: "task",
            entityId: task.id,
            beforeData: null,
            afterData: { status: "OPEN", boxId: null, standId: stand.id, taskType: "DAILY_FULL", dedupKey }
          });
          createdTasks.push({
            task,
            stand: { id: stand.id, identifier: stand.identifier }
          });
        } catch (e) {
          if (e?.code === "23505") {
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
        skipped,
        generatedAt: now.toISOString()
      });
    } catch (error) {
      console.error("Failed to run daily tasks:", error);
      res.status(500).json({ error: "Failed to run daily tasks" });
    }
  });
  app2.post("/api/scan/place-box", requireAuth, async (req, res) => {
    try {
      const { standQr, boxQr, geo, locationDetails } = req.body;
      const authUser = req.authUser;
      if (!standQr || !boxQr) {
        return res.status(400).json({ error: "standQr and boxQr are required" });
      }
      const [stand] = await db.select().from(stands).where(eq2(stands.qrCode, standQr));
      if (!stand) {
        return res.status(404).json({ error: "Stellplatz nicht gefunden" });
      }
      const [box] = await db.select().from(boxes).where(eq2(boxes.qrCode, boxQr));
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }
      const [station] = await db.select().from(stations).where(eq2(stations.id, stand.stationId));
      const [hall] = station ? await db.select().from(halls).where(eq2(halls.id, station.hallId)) : [null];
      let material = null;
      if (stand.materialId) {
        const [mat] = await db.select().from(materials).where(eq2(materials.id, stand.materialId));
        material = mat;
      }
      const standMeta = await buildStandContextMeta(stand.id);
      const existingBoxes = await db.select().from(boxes).where(
        and2(eq2(boxes.standId, stand.id), eq2(boxes.status, "AT_STAND"))
      );
      for (const existingBox of existingBoxes) {
        if (existingBox.id !== box.id) {
          await db.update(boxes).set({
            standId: null,
            status: "IN_TRANSIT",
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq2(boxes.id, existingBox.id));
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
              source: "SCAN_PLACE_BOX"
            }
          });
          await db.insert(activityLogs).values({
            type: "BOX_AUTO_REPLACED",
            action: "BOX_AUTO_REPLACED",
            message: `Box ${existingBox.serial} wurde automatisch vom Stellplatz ${stand.identifier} entfernt (ersetzt durch ${box.serial})`,
            userId: authUser.id,
            containerId: existingBox.id
          });
        }
      }
      const beforeData = { standId: box.standId, status: box.status };
      const [updatedBox] = await db.update(boxes).set({
        standId: stand.id,
        status: "AT_STAND",
        lastSeenAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(boxes.id, box.id)).returning();
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
        extraData: { standId: stand.id, standQr, boxQr }
      }).returning();
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
          previousStandId: beforeData.standId || void 0,
          source: "SCAN_PLACE_BOX"
        }
      });
      await db.insert(activityLogs).values({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_STATUS_CHANGED",
        message: `Box ${box.serial} wurde am Stellplatz ${stand.identifier} abgestellt`,
        userId: authUser.id,
        containerId: box.id,
        taskId: box.currentTaskId || null,
        scanEventId: scanEvent.id,
        location: geo || null
      });
      if (box.currentTaskId) {
        const [task] = await db.select().from(tasks).where(eq2(tasks.id, box.currentTaskId));
        if (task && (task.status === "PICKED_UP" || task.status === "IN_TRANSIT")) {
          try {
            assertAutomotiveTransition(task.status, "DROPPED_OFF");
            const timestampField = getAutomotiveTimestampFieldForStatus("DROPPED_OFF");
            await db.update(tasks).set({
              status: "DROPPED_OFF",
              [timestampField]: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date(),
              // Release claim when dropped off
              claimedByUserId: null,
              claimedAt: null
            }).where(eq2(tasks.id, task.id));
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
                source: "SCAN_PLACE_BOX"
              }
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
        message: `Box ${box.serial} erfolgreich am Stellplatz ${stand.identifier} abgestellt`
      });
    } catch (error) {
      console.error("Failed to place box:", error);
      res.status(500).json({ error: "Platzierung fehlgeschlagen" });
    }
  });
  app2.post("/api/scan/pickup-box", requireAuth, async (req, res) => {
    try {
      const { boxQr, geo, locationDetails } = req.body;
      const authUser = req.authUser;
      if (!boxQr) {
        return res.status(400).json({ error: "boxQr is required" });
      }
      const [box] = await db.select().from(boxes).where(eq2(boxes.qrCode, boxQr));
      if (!box) {
        return res.status(404).json({ error: "Box nicht gefunden" });
      }
      const previousStandId = box.standId;
      let previousStand = null;
      let previousStation = null;
      let previousHall = null;
      let previousMaterial = null;
      if (previousStandId) {
        const [stand] = await db.select().from(stands).where(eq2(stands.id, previousStandId));
        previousStand = stand;
        if (stand) {
          const [station] = await db.select().from(stations).where(eq2(stations.id, stand.stationId));
          previousStation = station;
          if (station) {
            const [hall] = await db.select().from(halls).where(eq2(halls.id, station.hallId));
            previousHall = hall;
          }
          if (stand.materialId) {
            const [mat] = await db.select().from(materials).where(eq2(materials.id, stand.materialId));
            previousMaterial = mat;
          }
        }
      }
      const beforeData = { standId: box.standId, status: box.status };
      const [updatedBox] = await db.update(boxes).set({
        standId: null,
        status: "IN_TRANSIT",
        lastSeenAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(boxes.id, box.id)).returning();
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
        extraData: { previousStandId, boxQr }
      }).returning();
      const contextMeta = previousStandId ? await buildStandContextMeta(previousStandId) : { boxId: box.id };
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
          previousStandId: previousStandId || void 0,
          source: "SCAN_PICKUP_BOX"
        }
      });
      await db.insert(activityLogs).values({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_STATUS_CHANGED",
        message: `Box ${box.serial} wurde abgeholt${previousStand ? ` vom Stellplatz ${previousStand.identifier}` : ""}`,
        userId: authUser.id,
        containerId: box.id,
        taskId: box.currentTaskId || null,
        scanEventId: scanEvent.id,
        location: geo || null,
        metadata: { previousStandId }
      });
      if (box.currentTaskId) {
        const [task] = await db.select().from(tasks).where(eq2(tasks.id, box.currentTaskId));
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
              await db.update(tasks).set({
                status: newStatus,
                [timestampField]: /* @__PURE__ */ new Date(),
                claimedByUserId: authUser.id,
                claimedAt: /* @__PURE__ */ new Date(),
                updatedAt: /* @__PURE__ */ new Date()
              }).where(eq2(tasks.id, task.id));
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
                  source: "SCAN_PICKUP_BOX"
                }
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
        message: `Box ${box.serial} erfolgreich abgeholt${previousStand ? ` von Stellplatz ${previousStand.identifier}` : ""}`
      });
    } catch (error) {
      console.error("Failed to pickup box:", error);
      res.status(500).json({ error: "Abholung fehlgeschlagen" });
    }
  });
  app2.get("/api/task-events", async (req, res) => {
    try {
      const { taskId } = req.query;
      if (!taskId || typeof taskId !== "string") {
        return res.status(400).json({ error: "taskId query parameter is required" });
      }
      const events = await db.select().from(taskEvents).where(eq2(taskEvents.taskId, taskId)).orderBy(desc2(taskEvents.timestamp));
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch task events:", error);
      res.status(500).json({ error: "Failed to fetch task events" });
    }
  });
  app2.get("/api/activity", async (req, res) => {
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
        limit: limitParam
      } = req.query;
      const page = Math.max(1, parseInt(pageParam) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(limitParam) || 50));
      const offset = (page - 1) * limit;
      const conditions = [];
      if (from && typeof from === "string") {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          conditions.push(gte2(taskEvents.timestamp, fromDate));
        }
      }
      if (to && typeof to === "string") {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          conditions.push(lte2(taskEvents.timestamp, toDate));
        }
      }
      if (userId && typeof userId === "string") {
        conditions.push(eq2(taskEvents.actorUserId, userId));
      }
      if (departmentId && typeof departmentId === "string") {
        conditions.push(eq2(taskEvents.actorDepartmentId, departmentId));
      }
      if (action && typeof action === "string") {
        const actions = action.split(",").map((a) => a.trim()).filter((a) => a);
        if (actions.length === 1) {
          conditions.push(eq2(taskEvents.action, actions[0]));
        } else if (actions.length > 1) {
          conditions.push(inArray(taskEvents.action, actions));
        }
      }
      if (materialId && typeof materialId === "string") {
        conditions.push(sql3`${taskEvents.metaJson}->>'materialId' = ${materialId}`);
      }
      if (stationId && typeof stationId === "string") {
        conditions.push(sql3`${taskEvents.metaJson}->>'stationId' = ${stationId}`);
      }
      if (hallId && typeof hallId === "string") {
        conditions.push(sql3`${taskEvents.metaJson}->>'hallId' = ${hallId}`);
      }
      const whereClause = conditions.length > 0 ? and2(...conditions) : void 0;
      const [countResult] = await db.select({ total: count() }).from(taskEvents).where(whereClause);
      const total = Number(countResult?.total || 0);
      const events = await db.select({
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
        taskId: taskEvents.taskId
      }).from(taskEvents).leftJoin(users, eq2(taskEvents.actorUserId, users.id)).where(whereClause).orderBy(desc2(taskEvents.timestamp)).limit(limit).offset(offset);
      const totalPages = Math.ceil(total / limit);
      res.json({
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (error) {
      console.error("Failed to fetch activity feed:", error);
      res.status(500).json({ error: "Failed to fetch activity feed" });
    }
  });
  app2.get("/api/analytics/materials", requireAuth, async (req, res) => {
    try {
      const { from, to, groupBy = "material" } = req.query;
      const conditions = [eq2(tasks.status, "DISPOSED")];
      if (from) {
        conditions.push(gte2(tasks.disposedAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte2(tasks.disposedAt, new Date(to)));
      }
      if (groupBy === "material") {
        const result = await db.select({
          materialId: tasks.materialType,
          materialName: materials.name,
          totalWeightKg: sum(tasks.weightKg),
          taskCount: count(),
          avgLeadTimeMinutes: avg(sql3`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`)
        }).from(tasks).leftJoin(materials, eq2(tasks.materialType, materials.id)).where(and2(...conditions)).groupBy(tasks.materialType, materials.name);
        res.json(result);
      } else {
        let dateExpr;
        if (groupBy === "day") {
          dateExpr = sql3`DATE(${tasks.disposedAt})`;
        } else if (groupBy === "week") {
          dateExpr = sql3`DATE_TRUNC('week', ${tasks.disposedAt})`;
        } else if (groupBy === "month") {
          dateExpr = sql3`DATE_TRUNC('month', ${tasks.disposedAt})`;
        } else {
          return res.status(400).json({ error: "Invalid groupBy parameter. Use: material, day, week, or month" });
        }
        const result = await db.select({
          period: dateExpr,
          totalWeightKg: sum(tasks.weightKg),
          taskCount: count()
        }).from(tasks).where(and2(...conditions)).groupBy(dateExpr).orderBy(dateExpr);
        res.json({ data: result, groupBy });
      }
    } catch (error) {
      console.error("[Analytics] Materials error:", error);
      res.status(500).json({ error: "Failed to fetch materials analytics" });
    }
  });
  app2.get("/api/analytics/stations", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      const conditions = [eq2(tasks.status, "DISPOSED")];
      if (from) {
        conditions.push(gte2(tasks.disposedAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte2(tasks.disposedAt, new Date(to)));
      }
      const result = await db.select({
        stationId: stands.stationId,
        stationName: stations.name,
        taskCount: count(),
        totalWeightKg: sum(tasks.weightKg),
        avgLeadTimeMinutes: avg(sql3`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`)
      }).from(tasks).innerJoin(stands, eq2(tasks.standId, stands.id)).innerJoin(stations, eq2(stands.stationId, stations.id)).where(and2(...conditions)).groupBy(stands.stationId, stations.name);
      res.json(result);
    } catch (error) {
      console.error("[Analytics] Stations error:", error);
      res.status(500).json({ error: "Failed to fetch stations analytics" });
    }
  });
  app2.get("/api/analytics/halls", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      const conditions = [eq2(tasks.status, "DISPOSED")];
      if (from) {
        conditions.push(gte2(tasks.disposedAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte2(tasks.disposedAt, new Date(to)));
      }
      const result = await db.select({
        hallId: stations.hallId,
        hallName: halls.name,
        taskCount: count(),
        totalWeightKg: sum(tasks.weightKg),
        avgLeadTimeMinutes: avg(sql3`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`)
      }).from(tasks).innerJoin(stands, eq2(tasks.standId, stands.id)).innerJoin(stations, eq2(stands.stationId, stations.id)).innerJoin(halls, eq2(stations.hallId, halls.id)).where(and2(...conditions)).groupBy(stations.hallId, halls.name);
      res.json(result);
    } catch (error) {
      console.error("[Analytics] Halls error:", error);
      res.status(500).json({ error: "Failed to fetch halls analytics" });
    }
  });
  app2.get("/api/analytics/users", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      const conditions = [eq2(tasks.status, "DISPOSED")];
      if (from) {
        conditions.push(gte2(tasks.disposedAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte2(tasks.disposedAt, new Date(to)));
      }
      const weighedByResult = await db.select({
        userId: tasks.weighedByUserId,
        userName: users.name,
        userEmail: users.email,
        role: sql3`'weigher'`.as("role"),
        totalWeightKg: sum(tasks.weightKg),
        taskCount: count()
      }).from(tasks).innerJoin(users, eq2(tasks.weighedByUserId, users.id)).where(and2(...conditions)).groupBy(tasks.weighedByUserId, users.name, users.email);
      const claimedByResult = await db.select({
        userId: tasks.claimedByUserId,
        userName: users.name,
        userEmail: users.email,
        role: sql3`'driver'`.as("role"),
        totalWeightKg: sum(tasks.weightKg),
        taskCount: count()
      }).from(tasks).innerJoin(users, eq2(tasks.claimedByUserId, users.id)).where(and2(...conditions)).groupBy(tasks.claimedByUserId, users.name, users.email);
      res.json({
        data: {
          byWeigher: weighedByResult,
          byDriver: claimedByResult
        }
      });
    } catch (error) {
      console.error("[Analytics] Users error:", error);
      res.status(500).json({ error: "Failed to fetch users analytics" });
    }
  });
  app2.get("/api/analytics/departments", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.query;
      const conditions = [eq2(tasks.status, "DISPOSED")];
      if (from) {
        conditions.push(gte2(tasks.disposedAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte2(tasks.disposedAt, new Date(to)));
      }
      const result = await db.select({
        departmentId: users.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        totalWeightKg: sum(tasks.weightKg),
        taskCount: count()
      }).from(tasks).innerJoin(users, eq2(tasks.claimedByUserId, users.id)).innerJoin(departments, eq2(users.departmentId, departments.id)).where(and2(...conditions)).groupBy(users.departmentId, departments.name, departments.code);
      res.json({ data: result });
    } catch (error) {
      console.error("[Analytics] Departments error:", error);
      res.status(500).json({ error: "Failed to fetch departments analytics" });
    }
  });
  app2.get("/api/analytics/lead-times", requireAuth, async (req, res) => {
    try {
      const { from, to, by } = req.query;
      const conditions = [eq2(tasks.status, "DISPOSED")];
      if (from) {
        conditions.push(gte2(tasks.disposedAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte2(tasks.disposedAt, new Date(to)));
      }
      if (by === "material") {
        const result = await db.select({
          groupId: tasks.materialType,
          groupName: materials.name,
          avgLeadTimeMinutes: avg(sql3`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
          minLeadTimeMinutes: sql3`MIN(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
          maxLeadTimeMinutes: sql3`MAX(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
          taskCount: count()
        }).from(tasks).leftJoin(materials, eq2(tasks.materialType, materials.id)).where(and2(...conditions)).groupBy(tasks.materialType, materials.name);
        res.json(result);
      } else if (by === "station") {
        const result = await db.select({
          groupId: stands.stationId,
          groupName: stations.name,
          avgLeadTimeMinutes: avg(sql3`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
          minLeadTimeMinutes: sql3`MIN(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
          maxLeadTimeMinutes: sql3`MAX(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
          taskCount: count()
        }).from(tasks).innerJoin(stands, eq2(tasks.standId, stands.id)).innerJoin(stations, eq2(stands.stationId, stations.id)).where(and2(...conditions)).groupBy(stands.stationId, stations.name);
        res.json(result);
      } else {
        const result = await db.select({
          groupId: sql3`'overall'`.as("groupId"),
          groupName: sql3`'All Tasks'`.as("groupName"),
          avgLeadTimeMinutes: avg(sql3`EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60`),
          minLeadTimeMinutes: sql3`MIN(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
          maxLeadTimeMinutes: sql3`MAX(EXTRACT(EPOCH FROM (${tasks.disposedAt} - ${tasks.createdAt})) / 60)`,
          taskCount: count()
        }).from(tasks).where(and2(...conditions));
        res.json(result);
      }
    } catch (error) {
      console.error("[Analytics] Lead times error:", error);
      res.status(500).json({ error: "Failed to fetch lead times analytics" });
    }
  });
  app2.get("/api/analytics/backlog", requireAuth, async (req, res) => {
    try {
      const olderThanHours = parseInt(req.query.olderThanHours) || 24;
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1e3);
      const activeStatuses = ["OPEN", "PICKED_UP", "IN_TRANSIT", "DROPPED_OFF", "TAKEN_OVER", "WEIGHED"];
      const result = await db.select({
        taskId: tasks.id,
        title: tasks.title,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        standId: tasks.standId,
        standIdentifier: stands.identifier
      }).from(tasks).leftJoin(stands, eq2(tasks.standId, stands.id)).where(
        and2(
          inArray(tasks.status, activeStatuses),
          lte2(tasks.updatedAt, cutoffTime)
        )
      ).orderBy(tasks.updatedAt);
      const now = Date.now();
      const tasksWithHours = result.map((task) => ({
        ...task,
        hoursInStatus: task.updatedAt ? Math.round((now - new Date(task.updatedAt).getTime()) / (1e3 * 60 * 60)) : null
      }));
      res.json(tasksWithHours);
    } catch (error) {
      console.error("[Analytics] Backlog error:", error);
      res.status(500).json({ error: "Failed to fetch backlog analytics" });
    }
  });
  app2.get("/api/admin/stands-with-materials", requireAuth, requireAdmin, async (req, res) => {
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
        materialCode: materials.code
      }).from(stands).leftJoin(materials, eq2(stands.materialId, materials.id)).where(and2(eq2(stands.stationId, stationId), eq2(stands.isActive, true)));
      res.json(result);
    } catch (error) {
      console.error("[Admin] Failed to fetch stands with materials:", error);
      res.status(500).json({ error: "Failed to fetch stands" });
    }
  });
  app2.post("/api/admin/tasks", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { hallId, stationId, standId, scheduledFor } = req.body;
      const authUser = req.authUser;
      if (!hallId || !stationId || !standId) {
        return res.status(400).json({ error: "hallId, stationId, and standId are required" });
      }
      const [station] = await db.select().from(stations).where(eq2(stations.id, stationId));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }
      if (station.hallId !== hallId) {
        return res.status(400).json({ error: "Station does not belong to the specified hall" });
      }
      const [stand] = await db.select().from(stands).where(eq2(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      if (stand.stationId !== stationId) {
        return res.status(400).json({ error: "Stand does not belong to the specified station" });
      }
      if (!stand.isActive) {
        return res.status(400).json({ error: "Stand is not active" });
      }
      const [existingOpenTask] = await db.select().from(tasks).where(
        and2(
          eq2(tasks.standId, standId),
          eq2(tasks.status, "OPEN")
        )
      );
      if (existingOpenTask) {
        console.log(`[ManualTask] Warning: Creating new task for stand ${standId} which already has an OPEN task ${existingOpenTask.id}`);
      }
      const [newTask] = await db.insert(tasks).values({
        title: `Manuelle Aufgabe - Stand ${stand.identifier}`,
        description: null,
        status: "OPEN",
        source: "MANUAL",
        taskType: "AUTOMOTIVE",
        standId,
        materialType: stand.materialId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        dedupKey: null,
        scheduleId: null,
        priority: "normal"
      }).returning();
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
          materialId: stand.materialId || void 0,
          source: "MANUAL"
        }
      });
      console.log(`[Admin] Manual task created: ${newTask.id} for stand ${stand.identifier}`);
      res.status(201).json(newTask);
    } catch (error) {
      console.error("[Admin] Failed to create manual task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });
  app2.post("/api/seed/kaiserslautern", requireAuth, requireAdmin, async (req, res) => {
    try {
      let parseStandIdentifiers2 = function(label) {
        const identifiers = [];
        const match = label.match(/Cluster\s+([\d\/\-,\s]+)/);
        if (!match) return identifiers;
        const parts = match[1].split(/[\/,]/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes("-")) {
            const [start, end] = trimmed.split("-").map((s) => parseInt(s.trim(), 10));
            if (!isNaN(start) && !isNaN(end) && end > start && end - start < 20) {
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
      };
      var parseStandIdentifiers = parseStandIdentifiers2;
      console.log("[Seed] Starting Kaiserslautern factory seeding...");
      const seeded = {
        halls: { created: 0, skipped: 0 },
        stations: { created: 0, skipped: 0 },
        stands: { created: 0, skipped: 0 }
      };
      const hallsData = [
        { code: "K70", name: "Bau K70", x: 0.25, y: 0.37 },
        { code: "K25", name: "Bau K25", x: 0.44, y: 0.23 },
        { code: "K19", name: "Bau K19", x: 0.45, y: 0.34 },
        { code: "K18", name: "Bau K18", x: 0.56, y: 0.28 },
        { code: "K30", name: "Bau K30", x: 0.34, y: 0.6 },
        { code: "K16", name: "Bau K16", x: 0.73, y: 0.33 },
        { code: "K13", name: "Bau K13", x: 0.81, y: 0.76 }
      ];
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
        { code: "K19-S06", hallCode: "K19", name: "Cluster 608-611/602/609/610", x: 0.71, y: 0.8, label: "Cluster 608-611/602/609/610 (unten rechts)" },
        { code: "K25-S01", hallCode: "K25", name: "Cluster 36/37/47", x: 0.1, y: 0.65, label: "Cluster 36/37/47 (links unten)" },
        { code: "K25-S02", hallCode: "K25", name: "Cluster 706", x: 0.19, y: 0.52, label: "Cluster 706 (links Mitte)" },
        { code: "K25-S03", hallCode: "K25", name: "Cluster 67/68/69/660", x: 0.53, y: 0.66, label: "Cluster 67/68/69/660 (unten Mitte)" },
        { code: "K25-S04", hallCode: "K25", name: "Cluster 225-228/224", x: 0.71, y: 0.62, label: "Cluster 225-228/224 (rechts)" },
        { code: "K25-S05", hallCode: "K25", name: "Cluster 41/663", x: 0.81, y: 0.17, label: "Cluster 41/663 (oben rechts)" },
        { code: "K25-S06", hallCode: "K25", name: "Cluster 672/714", x: 0.07, y: 0.35, label: "Cluster 672/714 (oben links)" }
      ];
      const hallIdMap = {};
      for (const h of hallsData) {
        const [existing] = await db.select().from(halls).where(eq2(halls.code, h.code));
        if (existing) {
          hallIdMap[h.code] = existing.id;
          seeded.halls.skipped++;
        } else {
          const [created] = await db.insert(halls).values({
            name: h.name,
            code: h.code,
            positionMeta: { x: h.x, y: h.y, mapCode: "OUT" }
          }).returning();
          hallIdMap[h.code] = created.id;
          seeded.halls.created++;
        }
      }
      const stationIdMap = {};
      for (const s of stationsData) {
        const hallId = hallIdMap[s.hallCode];
        if (!hallId) {
          console.warn(`[Seed] Hall ${s.hallCode} not found for station ${s.code}`);
          continue;
        }
        const [existing] = await db.select().from(stations).where(eq2(stations.code, s.code));
        if (existing) {
          stationIdMap[s.code] = existing.id;
          seeded.stations.skipped++;
        } else {
          const [created] = await db.insert(stations).values({
            hallId,
            name: s.name,
            code: s.code,
            positionMeta: { x: s.x, y: s.y, mapCode: s.hallCode, label: s.label }
          }).returning();
          stationIdMap[s.code] = created.id;
          seeded.stations.created++;
        }
      }
      for (const s of stationsData) {
        const stationId = stationIdMap[s.code];
        if (!stationId) continue;
        const standIdentifiers = parseStandIdentifiers2(s.label);
        for (const identifier of standIdentifiers) {
          const fullId = `${s.hallCode}-${identifier}`;
          const qrCode = JSON.stringify({ t: "STAND", id: fullId });
          const [existing] = await db.select().from(stands).where(eq2(stands.qrCode, qrCode));
          if (existing) {
            seeded.stands.skipped++;
          } else {
            try {
              await db.insert(stands).values({
                stationId,
                identifier,
                qrCode
              });
              seeded.stands.created++;
            } catch (err) {
              if (err?.code === "23505") {
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
        seeded
      });
    } catch (error) {
      console.error("[Seed] Kaiserslautern seeding failed:", error);
      res.status(500).json({ error: "Failed to seed factory data" });
    }
  });
  app2.patch("/api/admin/halls/:id/map-marker", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { x, y } = req.body;
      const authUser = req.authUser;
      if (x === void 0 && y === void 0) {
        return res.status(400).json({ error: "x oder y Koordinate erforderlich" });
      }
      if (x !== null && (typeof x !== "number" || x < 0 || x > 1)) {
        return res.status(400).json({ error: "x muss eine Zahl zwischen 0 und 1 sein" });
      }
      if (y !== null && (typeof y !== "number" || y < 0 || y > 1)) {
        return res.status(400).json({ error: "y muss eine Zahl zwischen 0 und 1 sein" });
      }
      const [hall] = await db.select().from(halls).where(eq2(halls.id, req.params.id));
      if (!hall) {
        return res.status(404).json({ error: "Halle nicht gefunden" });
      }
      const beforeLocationMeta = hall.locationMeta;
      let newLocationMeta;
      if (x === null && y === null) {
        newLocationMeta = { ...hall.locationMeta || {}, mapMarker: null };
      } else {
        newLocationMeta = {
          ...hall.locationMeta || {},
          mapMarker: { x, y }
        };
      }
      const [updatedHall] = await db.update(halls).set({ locationMeta: newLocationMeta, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(halls.id, req.params.id)).returning();
      await db.insert(activityLogs).values({
        type: "MANUAL_EDIT",
        action: "MAP_HALL_MARKER_SET",
        message: `Hallenmarker f\xFCr ${hall.name} (${hall.code}) gesetzt`,
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
          mapKey: "OUT.png"
        }
      });
      res.json({
        ...updatedHall,
        mapMarker: newLocationMeta?.mapMarker || null
      });
    } catch (error) {
      console.error("[MapEditor] Failed to set hall marker:", error);
      res.status(500).json({ error: "Fehler beim Setzen des Hallenmarkers" });
    }
  });
  app2.get("/api/admin/halls/:id/map-marker", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [hall] = await db.select().from(halls).where(eq2(halls.id, req.params.id));
      if (!hall) {
        return res.status(404).json({ error: "Halle nicht gefunden" });
      }
      const locationMeta = hall.locationMeta;
      res.json({
        hallId: hall.id,
        hallCode: hall.code,
        hallName: hall.name,
        mapMarker: locationMeta?.mapMarker || null
      });
    } catch (error) {
      console.error("[MapEditor] Failed to get hall marker:", error);
      res.status(500).json({ error: "Fehler beim Abrufen des Hallenmarkers" });
    }
  });
  app2.patch("/api/admin/stations/:id/position", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { x, y } = req.body;
      const authUser = req.authUser;
      if (x === void 0 && y === void 0) {
        return res.status(400).json({ error: "x oder y Koordinate erforderlich" });
      }
      if (x !== null && (typeof x !== "number" || x < 0 || x > 1)) {
        return res.status(400).json({ error: "x muss eine Zahl zwischen 0 und 1 sein" });
      }
      if (y !== null && (typeof y !== "number" || y < 0 || y > 1)) {
        return res.status(400).json({ error: "y muss eine Zahl zwischen 0 und 1 sein" });
      }
      const [station] = await db.select().from(stations).where(eq2(stations.id, req.params.id));
      if (!station) {
        return res.status(404).json({ error: "Station nicht gefunden" });
      }
      const [hall] = await db.select().from(halls).where(eq2(halls.id, station.hallId));
      const beforeLocationMeta = station.locationMeta;
      let newLocationMeta;
      if (x === null && y === null) {
        newLocationMeta = null;
      } else {
        newLocationMeta = { x, y };
      }
      const [updatedStation] = await db.update(stations).set({ locationMeta: newLocationMeta, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stations.id, req.params.id)).returning();
      await db.insert(activityLogs).values({
        type: "MANUAL_EDIT",
        action: "MAP_STATION_MARKER_SET",
        message: `Stationsposition f\xFCr ${station.name} (${station.code}) gesetzt`,
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
          mapKey: hall?.code ? `${hall.code}.png` : null
        }
      });
      res.json({
        ...updatedStation,
        position: newLocationMeta
      });
    } catch (error) {
      console.error("[MapEditor] Failed to set station position:", error);
      res.status(500).json({ error: "Fehler beim Setzen der Stationsposition" });
    }
  });
  app2.get("/api/admin/map-editor/data", requireAuth, requireAdmin, async (req, res) => {
    try {
      const hallsResult = await db.select().from(halls);
      const stationsResult = await db.select().from(stations);
      const hallsWithMarkers = hallsResult.map((h) => {
        const locationMeta = h.locationMeta;
        return {
          id: h.id,
          code: h.code,
          name: h.name,
          isActive: h.isActive,
          mapMarker: locationMeta?.mapMarker || null,
          mapImageKey: locationMeta?.mapImageKey || (h.code === "OUT" ? "OUT.png" : `${h.code}.png`)
        };
      });
      const stationsWithPositions = stationsResult.map((s) => {
        const locationMeta = s.locationMeta;
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          hallId: s.hallId,
          isActive: s.isActive,
          position: locationMeta ? { x: locationMeta.x, y: locationMeta.y } : null
        };
      });
      const hallsWithoutMarkers = hallsWithMarkers.filter((h) => !h.mapMarker && h.code !== "OUT");
      const stationsWithoutPosition = stationsWithPositions.filter((s) => !s.position);
      res.json({
        halls: hallsWithMarkers,
        stations: stationsWithPositions,
        missing: {
          halls: hallsWithoutMarkers,
          stations: stationsWithoutPosition
        }
      });
    } catch (error) {
      console.error("[MapEditor] Failed to fetch data:", error);
      res.status(500).json({ error: "Failed to fetch map editor data" });
    }
  });
  app2.get("/api/factory/map-data", async (req, res) => {
    try {
      const hallsResult = await db.select().from(halls).where(eq2(halls.isActive, true));
      const stationsResult = await db.select().from(stations).where(eq2(stations.isActive, true));
      res.json({
        halls: hallsResult.map((h) => {
          const locationMeta = h.locationMeta;
          return {
            id: h.id,
            code: h.code,
            name: h.name,
            positionMeta: locationMeta?.mapMarker || h.positionMeta
          };
        }),
        stations: stationsResult.map((s) => {
          const locationMeta = s.locationMeta;
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            hallId: s.hallId,
            positionMeta: locationMeta ? { x: locationMeta.x, y: locationMeta.y } : s.positionMeta
          };
        })
      });
    } catch (error) {
      console.error("[MapData] Failed to fetch:", error);
      res.status(500).json({ error: "Failed to fetch map data" });
    }
  });
  const QR_ENTITY_TYPES = ["STATION", "STAND", "BOX"];
  function generateQrCode(type, id, version) {
    const payload = { t: type, id };
    if (version) {
      payload.v = version;
    }
    return JSON.stringify(payload);
  }
  function generateRandomVersion() {
    return Math.random().toString(36).substring(2, 10);
  }
  app2.get("/api/qr/entities", requireAuth, async (req, res) => {
    try {
      const { type, query } = req.query;
      const entityType = type;
      const searchQuery = query;
      if (entityType && !QR_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${QR_ENTITY_TYPES.join(", ")}` });
      }
      const results = [];
      const searchPattern = searchQuery ? `%${searchQuery}%` : null;
      if (!entityType || entityType === "STATION") {
        let stationQuery = db.select().from(stations).where(eq2(stations.isActive, true));
        if (searchPattern) {
          stationQuery = db.select().from(stations).where(
            and2(
              eq2(stations.isActive, true),
              or2(ilike(stations.code, searchPattern), ilike(stations.name, searchPattern))
            )
          );
        }
        const stationsResult = await stationQuery;
        const hallsForStations = await db.select().from(halls);
        const hallMap = new Map(hallsForStations.map((h) => [h.id, h]));
        for (const s of stationsResult) {
          const hall = hallMap.get(s.hallId);
          results.push({
            id: s.id,
            title: `${s.code} - ${s.name}`,
            subtitle: hall ? `Halle: ${hall.name}` : null,
            qr_code: s.qrCode || null,
            has_qr: !!s.qrCode
          });
        }
      }
      if (!entityType || entityType === "STAND") {
        let standQuery = db.select().from(stands).where(eq2(stands.isActive, true));
        if (searchPattern) {
          standQuery = db.select().from(stands).where(
            and2(eq2(stands.isActive, true), ilike(stands.identifier, searchPattern))
          );
        }
        const standsResult = await standQuery;
        const stationsForStands = await db.select().from(stations);
        const stationMap = new Map(stationsForStands.map((st) => [st.id, st]));
        const materialsForStands = await db.select().from(materials);
        const materialMap = new Map(materialsForStands.map((m) => [m.id, m]));
        for (const st of standsResult) {
          const station = stationMap.get(st.stationId);
          const material = st.materialId ? materialMap.get(st.materialId) : null;
          results.push({
            id: st.id,
            title: `Stellplatz ${st.identifier}`,
            subtitle: station ? `Station: ${station.name}${material ? ` | Material: ${material.name}` : ""}` : null,
            qr_code: st.qrCode || null,
            has_qr: !!st.qrCode
          });
        }
      }
      if (!entityType || entityType === "BOX") {
        let boxQuery = db.select().from(boxes).where(eq2(boxes.isActive, true));
        if (searchPattern) {
          boxQuery = db.select().from(boxes).where(
            and2(eq2(boxes.isActive, true), ilike(boxes.serial, searchPattern))
          );
        }
        const boxesResult = await boxQuery;
        for (const b of boxesResult) {
          results.push({
            id: b.id,
            title: `Box ${b.serial}`,
            subtitle: `Status: ${b.status}`,
            qr_code: b.qrCode || null,
            has_qr: !!b.qrCode
          });
        }
      }
      res.json(results);
    } catch (error) {
      console.error("[QRCenter] Failed to fetch entities:", error);
      res.status(500).json({ error: "Failed to fetch QR entities" });
    }
  });
  app2.post("/api/qr/ensure", requireAuth, async (req, res) => {
    try {
      const { type, id } = req.body;
      const authUser = req.authUser;
      if (!type || !id) {
        return res.status(400).json({ error: "type and id are required" });
      }
      if (!QR_ENTITY_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${QR_ENTITY_TYPES.join(", ")}` });
      }
      let existingQrCode = null;
      let entityFound = false;
      let entityDisplayName = "";
      let wasGenerated = false;
      switch (type) {
        case "STATION": {
          const [station] = await db.select().from(stations).where(eq2(stations.id, id));
          if (station) {
            entityFound = true;
            entityDisplayName = `${station.code} - ${station.name}`;
            existingQrCode = station.qrCode;
            if (!existingQrCode) {
              const newQrCode = generateQrCode("STATION", id);
              await db.update(stations).set({ qrCode: newQrCode, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stations.id, id));
              existingQrCode = newQrCode;
              wasGenerated = true;
            }
          }
          break;
        }
        case "STAND": {
          const [stand] = await db.select().from(stands).where(eq2(stands.id, id));
          if (stand) {
            entityFound = true;
            entityDisplayName = `Stellplatz ${stand.identifier}`;
            existingQrCode = stand.qrCode;
            if (!existingQrCode) {
              const newQrCode = generateQrCode("STAND", id);
              await db.update(stands).set({ qrCode: newQrCode, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stands.id, id));
              existingQrCode = newQrCode;
              wasGenerated = true;
            }
          }
          break;
        }
        case "BOX": {
          const [box] = await db.select().from(boxes).where(eq2(boxes.id, id));
          if (box) {
            entityFound = true;
            entityDisplayName = `Box ${box.serial}`;
            existingQrCode = box.qrCode;
            if (!existingQrCode) {
              const newQrCode = generateQrCode("BOX", id);
              await db.update(boxes).set({ qrCode: newQrCode, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(boxes.id, id));
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
      if (wasGenerated) {
        await db.insert(activityLogs).values({
          type: "QR",
          action: "QR_ENSURE",
          message: `QR-Code f\xFCr ${type} "${entityDisplayName}" generiert`,
          userId: authUser?.id,
          metadata: {
            entityType: type,
            entityId: id,
            entityDisplayName,
            newQrCode: existingQrCode
          }
        });
      }
      res.json({ qr_code: existingQrCode });
    } catch (error) {
      console.error("[QRCenter] Failed to ensure QR code:", error);
      res.status(500).json({ error: "Failed to ensure QR code" });
    }
  });
  app2.post("/api/qr/regenerate", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { type, id, confirm } = req.body;
      const authUser = req.authUser;
      if (!type || !id) {
        return res.status(400).json({ error: "type and id are required" });
      }
      if (!confirm) {
        return res.status(400).json({ error: "confirm: true is required to regenerate QR code" });
      }
      if (!QR_ENTITY_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${QR_ENTITY_TYPES.join(", ")}` });
      }
      let oldQrCode = null;
      let newQrCode;
      let entityFound = false;
      let entityDisplayName = "";
      const version = generateRandomVersion();
      switch (type) {
        case "STATION": {
          const [station] = await db.select().from(stations).where(eq2(stations.id, id));
          if (station) {
            entityFound = true;
            oldQrCode = station.qrCode;
            entityDisplayName = `${station.code} - ${station.name}`;
            newQrCode = generateQrCode("STATION", id, version);
            await db.update(stations).set({ qrCode: newQrCode, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stations.id, id));
          }
          break;
        }
        case "STAND": {
          const [stand] = await db.select().from(stands).where(eq2(stands.id, id));
          if (stand) {
            entityFound = true;
            oldQrCode = stand.qrCode;
            entityDisplayName = `Stellplatz ${stand.identifier}`;
            newQrCode = generateQrCode("STAND", id, version);
            await db.update(stands).set({ qrCode: newQrCode, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(stands.id, id));
          }
          break;
        }
        case "BOX": {
          const [box] = await db.select().from(boxes).where(eq2(boxes.id, id));
          if (box) {
            entityFound = true;
            oldQrCode = box.qrCode;
            entityDisplayName = `Box ${box.serial}`;
            newQrCode = generateQrCode("BOX", id, version);
            await db.update(boxes).set({ qrCode: newQrCode, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(boxes.id, id));
          }
          break;
        }
      }
      if (!entityFound) {
        return res.status(404).json({ error: `${type} with id ${id} not found` });
      }
      await db.insert(activityLogs).values({
        type: "QR",
        action: "QR_REGENERATE",
        message: `QR-Code f\xFCr ${type} "${entityDisplayName}" neu generiert`,
        userId: authUser.id,
        metadata: {
          entityType: type,
          entityId: id,
          entityDisplayName,
          oldQrCode,
          newQrCode,
          version
        }
      });
      res.json({ qr_code: newQrCode, old_qr_code: oldQrCode });
    } catch (error) {
      console.error("[QRCenter] Failed to regenerate QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });
  setTimeout(() => {
    console.log("[DailyTaskScheduler] Initial run starting in 5 seconds...");
    generateDailyTasksScheduled();
  }, 5e3);
  setTimeout(() => {
    console.log("[FlexibleScheduler] Initial run starting in 10 seconds...");
    generateFlexibleScheduledTasks();
  }, 1e4);
  setInterval(() => {
    generateDailyTasksScheduled();
    generateFlexibleScheduledTasks();
  }, 60 * 60 * 1e3);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-user-id, x-replit-user-id, x-replit-user-name, x-replit-user-roles"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.originalUrl || req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
}
(async () => {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL || "");
    log(`Using Supabase PostgreSQL via DATABASE_URL (host: ${dbUrl.hostname})`);
  } catch {
    log(`Using Supabase PostgreSQL via DATABASE_URL`);
  }
  const expectedDomain = process.env.EXPO_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
  if (expectedDomain) {
    log(`Expecting EXPO_PUBLIC_DOMAIN for client: ${expectedDomain}`);
  } else {
    log(
      "EXPO_PUBLIC_DOMAIN not set in server env. Mobile client must provide it."
    );
  }
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  await registerRoutes(app);
  setupErrorHandler(app);
  const PORT = Number(process.env.PORT || 5e3);
  const HOST = "0.0.0.0";
  app.listen(PORT, HOST, () => {
    console.log(`API listening on http://${HOST}:${PORT}`);
  });
})().catch((error) => {
  console.error("Server failed to start", error);
  process.exit(1);
});
