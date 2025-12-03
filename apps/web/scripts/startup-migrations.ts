#!/usr/bin/env tsx
/**
 * Startup Migration Script
 * 
 * This script runs on application startup (before Next.js server starts).
 * It ensures all migrations are applied to the database.
 * 
 * This is the recommended approach for production deployments:
 * 1. Run migrations before starting the app
 * 2. If migrations fail, the app won't start (fail-fast)
 * 3. Ensures database schema is always in sync with code
 * 
 * Usage:
 *   pnpm db:startup    # Run migrations on startup
 *   
 * Environment:
 *   DATABASE_URL - Required. PostgreSQL connection string.
 *   SKIP_MIGRATIONS - Set to "true" to skip migrations (not recommended)
 */

import { runMigrations } from "../lib/db/migrate"
import { Pool } from "pg"
import fs from "fs"
import path from "path"

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

interface Journal {
  version: string
  dialect: string
  entries: JournalEntry[]
}

async function checkDatabaseReady(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is not set")
    return false
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : undefined,
    connectionTimeoutMillis: 10000,
  })

  try {
    // Simple connectivity check
    await pool.query("SELECT 1")
    return true
  } catch (error) {
    console.error("❌ Cannot connect to database:", error)
    return false
  } finally {
    await pool.end()
  }
}

async function getMigrationStatus(): Promise<{
  journalMigrations: string[]
  appliedMigrations: string[]
  pendingMigrations: string[]
}> {
  const result = {
    journalMigrations: [] as string[],
    appliedMigrations: [] as string[],
    pendingMigrations: [] as string[],
  }

  // Read journal
  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json")
  if (fs.existsSync(journalPath)) {
    const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"))
    result.journalMigrations = journal.entries.map(e => e.tag)
  }

  // Check database
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" 
        ? { rejectUnauthorized: false } 
        : undefined,
    })

    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'drizzle' 
          AND table_name = '__drizzle_migrations'
        ) as exists
      `)

      if (tableCheck.rows[0].exists) {
        const migrations = await pool.query(`
          SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at
        `)
        result.appliedMigrations = migrations.rows.map(r => r.hash)
      }
    } finally {
      await pool.end()
    }
  }

  result.pendingMigrations = result.journalMigrations.filter(
    m => !result.appliedMigrations.includes(m)
  )

  return result
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Startup Migrations")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()

  // Check if migrations should be skipped
  if (process.env.SKIP_MIGRATIONS === "true") {
    console.log("⚠️  SKIP_MIGRATIONS is set - skipping migrations")
    console.log("   This is not recommended for production!")
    process.exit(0)
  }

  // Wait for database to be ready (with retries)
  console.log("🔍 Checking database connectivity...")
  let attempts = 0
  const maxAttempts = 30
  
  while (attempts < maxAttempts) {
    if (await checkDatabaseReady()) {
      console.log("✅ Database is ready")
      break
    }
    
    attempts++
    if (attempts < maxAttempts) {
      console.log(`   Retrying in 2 seconds... (${attempts}/${maxAttempts})`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  if (attempts >= maxAttempts) {
    console.error("❌ Could not connect to database after 60 seconds")
    process.exit(1)
  }

  console.log()

  // Get migration status
  console.log("📋 Checking migration status...")
  const status = await getMigrationStatus()
  
  console.log(`   Total migrations: ${status.journalMigrations.length}`)
  console.log(`   Applied: ${status.appliedMigrations.length}`)
  console.log(`   Pending: ${status.pendingMigrations.length}`)
  console.log()

  if (status.pendingMigrations.length === 0) {
    console.log("✅ No pending migrations - database is up to date")
    console.log()
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    process.exit(0)
  }

  // Run migrations
  console.log("🔄 Applying pending migrations...")
  status.pendingMigrations.forEach(m => console.log(`   - ${m}`))
  console.log()

  try {
    await runMigrations()
    
    console.log()
    console.log("✅ All migrations applied successfully!")
    console.log()
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    process.exit(0)
  } catch (error) {
    console.error()
    console.error("❌ Migration failed!")
    console.error(error)
    console.error()
    console.error("The application will not start until migrations are fixed.")
    console.error()
    console.error("Options:")
    console.error("  1. Fix the migration and redeploy")
    console.error("  2. Set SKIP_MIGRATIONS=true to bypass (not recommended)")
    console.error()
    process.exit(1)
  }
}

main()
