#!/usr/bin/env tsx
/**
 * Migration Status Check Script
 * 
 * This script checks for schema drift between your Drizzle schema definitions
 * and the generated migration files. It helps ensure migrations are properly
 * generated before deployment.
 * 
 * Similar to Entity Framework's migration validation.
 * 
 * Usage:
 *   pnpm db:check    # Check if migrations are up to date
 *   pnpm db:status   # Show current migration status
 * 
 * Exit codes:
 *   0 - All migrations are up to date
 *   1 - Schema changes detected that need migration generation
 *   2 - Error occurred
 */

import { execSync } from "child_process"
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

interface MigrationStatus {
  hasSchemaChanges: boolean
  pendingMigrations: string[]
  appliedMigrations: string[]
  journalMigrations: string[]
  databaseConnected: boolean
  error?: string
}

async function checkMigrationStatus(): Promise<MigrationStatus> {
  const status: MigrationStatus = {
    hasSchemaChanges: false,
    pendingMigrations: [],
    appliedMigrations: [],
    journalMigrations: [],
    databaseConnected: false,
  }

  // 1. Check for uncommitted schema changes using drizzle-kit
  console.log("🔍 Checking for schema changes...")
  try {
    // Run drizzle-kit generate in dry-run mode to check for changes
    // This creates a temp folder and checks what would be generated
    const tempDir = path.join(process.cwd(), ".drizzle-check-temp")
    
    // Clean up temp dir if it exists
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
    
    try {
      // Run generate to a temp directory
      execSync(`npx drizzle-kit generate --out="${tempDir}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
      
      // Check if any new migration files were created
      const tempMeta = path.join(tempDir, "meta", "_journal.json")
      if (fs.existsSync(tempMeta)) {
        const tempJournal: Journal = JSON.parse(fs.readFileSync(tempMeta, "utf-8"))
        
        // Read current journal
        const currentJournalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json")
        if (fs.existsSync(currentJournalPath)) {
          const currentJournal: Journal = JSON.parse(fs.readFileSync(currentJournalPath, "utf-8"))
          
          // If temp has more entries, there are uncommitted changes
          if (tempJournal.entries.length > currentJournal.entries.length) {
            status.hasSchemaChanges = true
          }
        } else if (tempJournal.entries.length > 0) {
          status.hasSchemaChanges = true
        }
      }
    } catch (error) {
      // If generate fails with "No schema changes", that's good
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes("No schema changes")) {
        // Check for actual SQL files in temp
        if (fs.existsSync(tempDir)) {
          const sqlFiles = fs.readdirSync(tempDir).filter(f => f.endsWith(".sql"))
          status.hasSchemaChanges = sqlFiles.length > 0
        }
      }
    } finally {
      // Clean up temp dir
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true })
      }
    }
  } catch (error) {
    console.log("   ⚠️  Could not check for schema changes")
  }

  // 2. Read journal to get all defined migrations
  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json")
  if (fs.existsSync(journalPath)) {
    const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"))
    status.journalMigrations = journal.entries.map(e => e.tag)
  }

  // 3. Check database for applied migrations
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" 
        ? { rejectUnauthorized: false } 
        : undefined,
      connectionTimeoutMillis: 5000,
    })

    try {
      // Check if migrations table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'drizzle' 
          AND table_name = '__drizzle_migrations'
        ) as exists
      `)

      if (tableCheck.rows[0].exists) {
        const result = await pool.query(`
          SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at
        `)
        status.appliedMigrations = result.rows.map(r => r.hash)
      }

      status.databaseConnected = true

      // Calculate pending migrations
      status.pendingMigrations = status.journalMigrations.filter(
        m => !status.appliedMigrations.includes(m)
      )

    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error)
    } finally {
      await pool.end()
    }
  }

  return status
}

async function main() {
  const args = process.argv.slice(2)
  const isCheck = args.includes("--check") || args.includes("-c")
  const isVerbose = args.includes("--verbose") || args.includes("-v")

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Migration Status")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()

  const status = await checkMigrationStatus()

  // Display results
  console.log("📋 Migration Journal:")
  console.log(`   Total migrations defined: ${status.journalMigrations.length}`)
  if (isVerbose && status.journalMigrations.length > 0) {
    status.journalMigrations.forEach(m => console.log(`     - ${m}`))
  }
  console.log()

  if (status.databaseConnected) {
    console.log("🗄️  Database Status:")
    console.log(`   Applied migrations: ${status.appliedMigrations.length}`)
    console.log(`   Pending migrations: ${status.pendingMigrations.length}`)
    
    if (status.pendingMigrations.length > 0) {
      console.log()
      console.log("   ⚠️  Pending migrations to apply:")
      status.pendingMigrations.forEach(m => console.log(`     - ${m}`))
    }
  } else {
    console.log("🗄️  Database: Not connected")
    if (status.error) {
      console.log(`   Error: ${status.error}`)
    }
  }
  console.log()

  // Schema changes check
  if (status.hasSchemaChanges) {
    console.log("⚠️  SCHEMA DRIFT DETECTED")
    console.log("   Your schema definitions have changes that are not in migrations.")
    console.log()
    console.log("   To fix this, run:")
    console.log("     pnpm db:generate")
    console.log()
    console.log("   This will generate a new migration file for your schema changes.")
    console.log()
    
    if (isCheck) {
      process.exit(1)
    }
  } else {
    console.log("✅ Schema is up to date with migrations")
  }

  if (status.pendingMigrations.length > 0) {
    console.log()
    console.log("⚠️  PENDING MIGRATIONS")
    console.log("   There are migrations that haven't been applied to the database.")
    console.log()
    console.log("   To apply them, run:")
    console.log("     pnpm db:run-migrations")
    console.log()
    
    if (isCheck) {
      process.exit(1)
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  if (isCheck && !status.hasSchemaChanges && status.pendingMigrations.length === 0) {
    console.log("✅ All migrations are up to date!")
    process.exit(0)
  }
}

main().catch(error => {
  console.error("Error:", error)
  process.exit(2)
})
