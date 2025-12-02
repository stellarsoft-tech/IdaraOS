#!/usr/bin/env tsx
/**
 * Baseline Migrations Script
 * 
 * This script is for databases that were created using `db:push` (development mode)
 * before migrations were set up. It:
 * 
 * 1. Creates the __drizzle_migrations table if it doesn't exist
 * 2. Marks the initial schema migration as already applied
 * 3. Runs only the data migration portion
 * 
 * Usage:
 *   pnpm db:baseline
 *   
 * After running this once, you can use `pnpm db:run-migrations` normally.
 */

import { Pool } from "pg"

async function baselineMigrations() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Migration Baseline Tool")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : undefined,
  })

  try {
    // Check if tables already exist (meaning db:push was used)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'core_organizations'
      ) as exists
    `)
    
    const tablesExist = tableCheck.rows[0].exists
    
    if (!tablesExist) {
      console.log("❌ Tables don't exist. Run 'pnpm db:run-migrations' instead.")
      process.exit(1)
    }
    
    console.log("✅ Existing tables detected (from db:push)")
    
    // Create the drizzle migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `)
    console.log("✅ Migrations tracking table ready")
    
    // Check if initial migration is already recorded
    const migrationCheck = await pool.query(`
      SELECT * FROM "__drizzle_migrations" 
      WHERE hash = '0000_cheerful_dust'
      LIMIT 1
    `)
    
    if (migrationCheck.rows.length > 0) {
      console.log("✅ Initial migration already baselined")
    } else {
      // Mark initial migration as applied (since tables exist via db:push)
      await pool.query(`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        VALUES ('0000_cheerful_dust', $1)
      `, [Date.now()])
      console.log("✅ Marked initial schema migration as applied")
    }
    
    // Run the data migration
    console.log()
    console.log("🔄 Running data migration: scim → sync...")
    
    const result = await pool.query(`
      UPDATE rbac_user_roles 
      SET source = 'sync' 
      WHERE source = 'scim'
    `)
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`✅ Updated ${result.rowCount} role assignment(s) from 'scim' to 'sync'`)
    } else {
      console.log("✅ No 'scim' values found (already migrated or none existed)")
    }
    
    console.log()
    console.log("✅ Baseline complete! Future deployments will use normal migrations.")
    
  } catch (error) {
    console.error("❌ Baseline failed:", error)
    throw error
  } finally {
    await pool.end()
  }
}

baselineMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

