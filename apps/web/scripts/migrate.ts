#!/usr/bin/env tsx
/**
 * Database Migration CLI
 * 
 * A robust, CI/CD-friendly migration runner that handles common scenarios
 * without requiring user interaction.
 * 
 * Usage:
 *   pnpm db:migrate:run              # Run pending migrations
 *   pnpm db:migrate:run --force      # Force run even if conflicts detected
 *   pnpm db:migrate:status           # Show migration status
 *   pnpm db:migrate:fix              # Fix out-of-sync migrations
 * 
 * Exit Codes:
 *   0 - Success
 *   1 - Error
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { sql } from "drizzle-orm"
import { Pool } from "pg"
import path from "path"
import fs from "fs"

// ============================================================================
// Configuration
// ============================================================================

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle")
const JOURNAL_PATH = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json")

interface MigrationEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

interface Journal {
  version: string
  dialect: string
  entries: MigrationEntry[]
}

// ============================================================================
// Database Connection
// ============================================================================

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set")
    process.exit(1)
  }

  // Check if SSL should be disabled (for local Docker dev)
  const disableSsl = process.env.DB_SSL === "false" || databaseUrl.includes("localhost") || databaseUrl.includes("db:5432")
  
  return new Pool({
    connectionString: databaseUrl,
    ssl: disableSsl ? false : (process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : undefined),
  })
}

// ============================================================================
// Migration Status
// ============================================================================

async function getMigrationStatus(pool: Pool): Promise<{
  applied: string[]
  pending: string[]
  journal: Journal | null
}> {
  const db = drizzle(pool)
  
  // Read local journal
  let journal: Journal | null = null
  try {
    const journalContent = fs.readFileSync(JOURNAL_PATH, "utf-8")
    journal = JSON.parse(journalContent)
  } catch {
    console.warn("⚠️  Could not read migration journal")
  }

  // Get applied migrations from database
  let applied: string[] = []
  try {
    const result = await db.execute(sql`
      SELECT hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `)
    applied = (result.rows as { hash: string }[]).map(r => r.hash)
  } catch {
    // Table doesn't exist yet - no migrations applied
  }

  // Calculate pending migrations
  const localMigrations = journal?.entries.map(e => e.tag) ?? []
  const pending = localMigrations.filter(m => !applied.includes(m))

  return { applied, pending, journal }
}

async function showStatus(): Promise<void> {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  Migration Status")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()

  const pool = createPool()
  
  try {
    const { applied, pending, journal } = await getMigrationStatus(pool)
    
    console.log(`📁 Local migrations: ${journal?.entries.length ?? 0}`)
    console.log(`✅ Applied: ${applied.length}`)
    console.log(`⏳ Pending: ${pending.length}`)
    console.log()
    
    if (pending.length > 0) {
      console.log("Pending migrations:")
      pending.forEach(m => console.log(`  - ${m}`))
    } else {
      console.log("Database is up to date!")
    }
  } finally {
    await pool.end()
  }
}

// ============================================================================
// Run Migrations
// ============================================================================

async function runMigrations(force: boolean = false): Promise<void> {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Database Migrations")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()

  const pool = createPool()
  const db = drizzle(pool)
  const startTime = Date.now()

  try {
    // Check status first
    const { pending } = await getMigrationStatus(pool)
    
    if (pending.length === 0) {
      console.log("✅ No pending migrations. Database is up to date!")
      return
    }

    console.log(`🔄 Running ${pending.length} pending migration(s)...`)
    console.log()

    // Run migrations
    await migrate(db, { 
      migrationsFolder: MIGRATIONS_FOLDER,
    })
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log()
    console.log(`✅ Migrations completed successfully in ${duration}s`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Check for "already exists" errors
    if (errorMessage.includes("already exists")) {
      console.error()
      console.error("❌ Migration conflict: Some database objects already exist.")
      console.error()
      console.error("This usually happens when:")
      console.error("  1. db:push was used instead of migrations")
      console.error("  2. Manual SQL was executed against the database")
      console.error("  3. Migration files were modified after being applied")
      console.error()
      
      if (!force) {
        console.error("Options:")
        console.error("  1. Run with --force to mark existing migrations as applied")
        console.error("  2. Run 'pnpm db:migrate:fix' to auto-fix")
        console.error("  3. Reset the database if this is dev environment")
        process.exit(1)
      }
      
      console.log("⚠️  Force mode enabled - attempting to fix...")
      await fixMigrations(pool)
      
    } else {
      console.error("❌ Migration failed:", error)
      throw error
    }
  } finally {
    await pool.end()
  }
}

// ============================================================================
// Fix Out-of-Sync Migrations (DISABLED - was causing issues)
// ============================================================================

async function fixMigrations(_existingPool?: Pool): Promise<void> {
  // This function was incorrectly marking NEW migrations as applied
  // without actually running them. Now disabled - use db:baseline instead.
  console.log()
  console.log("⚠️  db:repair is disabled - it was marking migrations as applied without running them")
  console.log()
  console.log("  ℹ️  For existing db:push databases, use: pnpm db:baseline")
  console.log("  ℹ️  To check migration status, use: pnpm db:migrate:status")
  console.log()
}

// ============================================================================
// Main CLI
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0] ?? "run"
  const force = args.includes("--force") || args.includes("-f")

  try {
    switch (command) {
      case "run":
        await runMigrations(force)
        break
      case "status":
        await showStatus()
        break
      case "fix":
        await fixMigrations()
        break
      default:
        console.log("Usage:")
        console.log("  pnpm db:migrate:run [--force]  Run pending migrations")
        console.log("  pnpm db:migrate:status         Show migration status")
        console.log("  pnpm db:migrate:fix            Fix out-of-sync state")
        process.exit(1)
    }
    
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

main()




