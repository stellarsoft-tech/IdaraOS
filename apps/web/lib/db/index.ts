/**
 * Database Client - Drizzle ORM
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Check if SSL should be disabled (for local Docker dev)
const databaseUrl = process.env.DATABASE_URL
const disableSsl = process.env.DB_SSL === "false" || databaseUrl?.includes("localhost") || databaseUrl?.includes("db:5432")

// Connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: disableSsl ? false : (process.env.NODE_ENV === "production" 
    ? { rejectUnauthorized: false } 
    : undefined),
})

// Drizzle client with schema
export const db = drizzle(pool, { schema })

// Re-export schema
export { schema }

// Re-export pool for raw queries if needed
export { pool }

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1")
    return true
  } catch {
    return false
  }
}

