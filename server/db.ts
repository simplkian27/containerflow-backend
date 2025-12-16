import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================
// Supabase PostgreSQL is the ONLY active database for this application.
// The backend connects via DATABASE_URL environment variable.
// No fallback databases, no conditional connections.
//
// Connection String (from Supabase Dashboard → Settings → Database):
// postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// ============================================================================


const databaseUrl = process.env.DATABASE_URL;

// Configure SSL for Supabase connections (required for external connections)
// Supabase URLs contain 'supabase' or use port 6543
const isSupabase = databaseUrl.includes('supabase') || databaseUrl.includes(':6543');
const poolConfig: pg.PoolConfig = {
  connectionString: databaseUrl,
  ...(isSupabase && {
    ssl: {
      rejectUnauthorized: false, // Required for Supabase pooler connections
    },
  }),
};

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

// Health check function to verify database connectivity
// Used by /api/health endpoint to confirm Supabase/PostgreSQL is reachable
export async function checkDatabaseHealth(): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { connected: true };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}
