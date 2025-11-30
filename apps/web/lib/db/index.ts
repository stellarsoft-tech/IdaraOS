/**
 * Database Client - Drizzle ORM
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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

