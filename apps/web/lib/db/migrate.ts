/**
 * Database Migration Runner
 * 
 * This module handles running Drizzle ORM migrations programmatically.
 * It's used during deployment and can be invoked via the CLI script.
 * 
 * Usage:
 *   pnpm db:run-migrations
 * 
 * The migration runner:
 * 1. Connects to the database using DATABASE_URL
 * 2. Reads migration files from the ./drizzle folder
 * 3. Applies any pending migrations in order
 * 4. Tracks applied migrations in drizzle.__drizzle_migrations table
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"
import path from "path"

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  console.log("🔄 Starting database migrations...")
  
  const pool = new Pool({
    connectionString: databaseUrl,
    // Use SSL in production
    ssl: process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : undefined,
  })

  const db = drizzle(pool)

  try {
    // Run migrations from the drizzle folder
    const migrationsFolder = path.join(process.cwd(), "drizzle")
    
    await migrate(db, { 
      migrationsFolder,
    })
    
    console.log("✅ Migrations completed successfully!")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  } finally {
    await pool.end()
  }
}

// Export for programmatic use
export default runMigrations

