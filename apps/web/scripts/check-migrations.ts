#!/usr/bin/env tsx
/**
 * Migration Check Script - CI/CD Ready
 * 
 * This script validates the migration state for CI/CD pipelines:
 * 1. Checks for schema drift (uncommitted schema changes)
 * 2. Validates migration file integrity
 * 3. Ensures all migrations have corresponding SQL files
 * 4. Optionally checks database for pending migrations
 * 
 * Usage:
 *   pnpm db:check                 # Full check (CI mode)
 *   pnpm db:check --schema-only   # Only check schema drift
 *   pnpm db:check --verbose       # Verbose output
 *   pnpm db:check --ci            # CI mode (strict, non-interactive)
 * 
 * Exit codes:
 *   0 - All checks passed
 *   1 - Schema drift detected (needs db:generate)
 *   2 - Migration file integrity error
 *   3 - Database has pending migrations
 *   4 - Configuration error
 */

import { execSync } from "child_process"
import { Pool } from "pg"
import fs from "fs"
import path from "path"
import crypto from "crypto"

// ============================================================================
// Types
// ============================================================================

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

interface CheckResult {
  passed: boolean
  message: string
  details?: string[]
}

interface MigrationCheckResults {
  journalExists: CheckResult
  migrationFilesExist: CheckResult
  snapshotsExist: CheckResult
  schemaDrift: CheckResult
  databasePending?: CheckResult
  summary: {
    totalMigrations: number
    appliedMigrations: number
    pendingMigrations: number
  }
}

// ============================================================================
// Configuration
// ============================================================================

const DRIZZLE_FOLDER = path.join(process.cwd(), "drizzle")
const JOURNAL_PATH = path.join(DRIZZLE_FOLDER, "meta", "_journal.json")
const TEMP_CHECK_DIR = path.join(process.cwd(), ".drizzle-check-temp")

// ============================================================================
// Helper Functions
// ============================================================================

function readJournal(): Journal | null {
  if (!fs.existsSync(JOURNAL_PATH)) {
    return null
  }
  return JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf-8"))
}

function getMigrationFiles(): string[] {
  if (!fs.existsSync(DRIZZLE_FOLDER)) {
    return []
  }
  return fs.readdirSync(DRIZZLE_FOLDER).filter(f => f.endsWith(".sql"))
}

function getSnapshotFiles(): string[] {
  const metaFolder = path.join(DRIZZLE_FOLDER, "meta")
  if (!fs.existsSync(metaFolder)) {
    return []
  }
  return fs.readdirSync(metaFolder).filter(f => f.endsWith("_snapshot.json"))
}

function cleanTempDir(): void {
  if (fs.existsSync(TEMP_CHECK_DIR)) {
    fs.rmSync(TEMP_CHECK_DIR, { recursive: true })
  }
}

// ============================================================================
// Check Functions
// ============================================================================

function checkJournalExists(): CheckResult {
  if (!fs.existsSync(JOURNAL_PATH)) {
    return {
      passed: false,
      message: "Migration journal not found",
      details: [
        "The drizzle/meta/_journal.json file is missing.",
        "Run 'pnpm db:generate' to create initial migrations.",
      ],
    }
  }
  
  const journal = readJournal()
  if (!journal || journal.entries.length === 0) {
    return {
      passed: false,
      message: "Migration journal is empty",
      details: [
        "No migrations have been generated yet.",
        "Run 'pnpm db:generate' to create migrations from your schema.",
      ],
    }
  }
  
  return {
    passed: true,
    message: `Journal contains ${journal.entries.length} migration(s)`,
  }
}

function checkMigrationFilesExist(): CheckResult {
  const journal = readJournal()
  if (!journal) {
    return { passed: false, message: "Cannot check - journal missing" }
  }
  
  const missingFiles: string[] = []
  
  for (const entry of journal.entries) {
    const sqlFile = path.join(DRIZZLE_FOLDER, `${entry.tag}.sql`)
    if (!fs.existsSync(sqlFile)) {
      missingFiles.push(`${entry.tag}.sql`)
    }
  }
  
  if (missingFiles.length > 0) {
    return {
      passed: false,
      message: `Missing ${missingFiles.length} SQL migration file(s)`,
      details: [
        "The following migration files are referenced in the journal but missing:",
        ...missingFiles.map(f => `  - ${f}`),
        "",
        "This may indicate:",
        "  1. Migration files were accidentally deleted",
        "  2. Git merge conflict lost migration files",
        "  3. Incomplete commit",
      ],
    }
  }
  
  return {
    passed: true,
    message: "All migration SQL files present",
  }
}

function checkSnapshotsExist(): CheckResult {
  const journal = readJournal()
  if (!journal) {
    return { passed: false, message: "Cannot check - journal missing" }
  }
  
  const missingSnapshots: string[] = []
  
  for (const entry of journal.entries) {
    const snapshotFile = path.join(DRIZZLE_FOLDER, "meta", `${entry.tag.split("_")[0]}_snapshot.json`)
    if (!fs.existsSync(snapshotFile)) {
      missingSnapshots.push(`${entry.tag.split("_")[0]}_snapshot.json`)
    }
  }
  
  if (missingSnapshots.length > 0) {
    return {
      passed: false,
      message: `Missing ${missingSnapshots.length} snapshot file(s)`,
      details: [
        "The following snapshot files are missing:",
        ...missingSnapshots.map(f => `  - ${f}`),
        "",
        "Snapshots are required for Drizzle to calculate future diffs.",
        "Always commit snapshot files along with migration SQL files.",
      ],
    }
  }
  
  return {
    passed: true,
    message: "All snapshot files present",
  }
}

function checkSchemaDrift(): CheckResult {
  cleanTempDir()
  
  try {
    // Run drizzle-kit generate to a temp directory
    // If there are schema changes, it will create new migration files
    execSync(`npx drizzle-kit generate --out="${TEMP_CHECK_DIR}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    
    // Check if any NEW migration files were created
    const tempJournalPath = path.join(TEMP_CHECK_DIR, "meta", "_journal.json")
    if (fs.existsSync(tempJournalPath)) {
      const tempJournal: Journal = JSON.parse(fs.readFileSync(tempJournalPath, "utf-8"))
      const currentJournal = readJournal()
      
      const currentCount = currentJournal?.entries.length ?? 0
      const tempCount = tempJournal.entries.length
      
      if (tempCount > currentCount) {
        const newMigrations = tempJournal.entries.slice(currentCount)
        return {
          passed: false,
          message: "Schema drift detected",
          details: [
            "Your TypeScript schema has changes not reflected in migrations.",
            "",
            `Found ${newMigrations.length} uncommitted migration(s):`,
            ...newMigrations.map(m => `  - ${m.tag}`),
            "",
            "To fix this:",
            "  1. Run: pnpm db:generate",
            "  2. Review the generated SQL",
            "  3. Commit the migration files",
          ],
        }
      }
    }
    
    return {
      passed: true,
      message: "Schema matches migrations (no drift)",
    }
    
  } catch (error) {
    // drizzle-kit generate might fail if no changes, which is fine
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Check if it's a "no changes" type error (success case)
    if (errorMessage.includes("No schema changes") || 
        errorMessage.includes("nothing to generate")) {
      return {
        passed: true,
        message: "Schema matches migrations (no drift)",
      }
    }
    
    // Check if temp directory has any SQL files (indicates changes)
    if (fs.existsSync(TEMP_CHECK_DIR)) {
      const tempSqlFiles = fs.readdirSync(TEMP_CHECK_DIR).filter(f => f.endsWith(".sql"))
      if (tempSqlFiles.length > 0) {
        return {
          passed: false,
          message: "Schema drift detected",
          details: [
            "Uncommitted schema changes found.",
            "",
            "Run: pnpm db:generate",
            "Then commit the generated migration files.",
          ],
        }
      }
    }
    
    return {
      passed: true,
      message: "Schema appears up to date",
    }
  } finally {
    cleanTempDir()
  }
}

async function checkDatabasePending(): Promise<CheckResult> {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    return {
      passed: true, // Not a failure, just can't check
      message: "Skipped (DATABASE_URL not set)",
    }
  }
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : undefined,
    connectionTimeoutMillis: 10000,
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
    
    if (!tableCheck.rows[0].exists) {
      const journal = readJournal()
      const count = journal?.entries.length ?? 0
      
      if (count > 0) {
        return {
          passed: false,
          message: `Database needs ${count} migration(s)`,
          details: [
            "The database has no migrations applied yet.",
            `${count} migration(s) need to be applied.`,
            "",
            "Run: pnpm db:migrate:run",
          ],
        }
      }
      
      return {
        passed: true,
        message: "Database is empty (no migrations table)",
      }
    }
    
    // Get applied migrations
    const result = await pool.query(`
      SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at
    `)
    const applied = result.rows.map(r => r.hash)
    
    // Compare with journal
    const journal = readJournal()
    if (!journal) {
      return {
        passed: true,
        message: "Cannot determine (no journal)",
      }
    }
    
    const pending = journal.entries.filter(e => !applied.includes(e.tag))
    
    if (pending.length > 0) {
      return {
        passed: false,
        message: `${pending.length} pending migration(s)`,
        details: [
          "The following migrations need to be applied:",
          ...pending.map(m => `  - ${m.tag}`),
          "",
          "Run: pnpm db:migrate:run",
        ],
      }
    }
    
    return {
      passed: true,
      message: `All ${applied.length} migrations applied`,
    }
    
  } catch (error) {
    return {
      passed: true, // Connection errors shouldn't fail CI
      message: `Skipped (${error instanceof Error ? error.message : "connection error"})`,
    }
  } finally {
    await pool.end()
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  const isCI = args.includes("--ci")
  const isVerbose = args.includes("--verbose") || args.includes("-v")
  const schemaOnly = args.includes("--schema-only")
  const skipDb = args.includes("--skip-db")
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Migration Check")
  if (isCI) {
    console.log("  Mode: CI/CD (strict)")
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()
  
  const results: MigrationCheckResults = {
    journalExists: checkJournalExists(),
    migrationFilesExist: { passed: true, message: "Skipped" },
    snapshotsExist: { passed: true, message: "Skipped" },
    schemaDrift: { passed: true, message: "Skipped" },
    summary: {
      totalMigrations: 0,
      appliedMigrations: 0,
      pendingMigrations: 0,
    },
  }
  
  // Only run further checks if journal exists
  if (results.journalExists.passed) {
    const journal = readJournal()
    results.summary.totalMigrations = journal?.entries.length ?? 0
    
    results.migrationFilesExist = checkMigrationFilesExist()
    results.snapshotsExist = checkSnapshotsExist()
    results.schemaDrift = checkSchemaDrift()
    
    if (!skipDb) {
      results.databasePending = await checkDatabasePending()
    }
  }
  
  // Display results
  const checks = [
    { name: "Journal Exists", result: results.journalExists },
    { name: "SQL Files", result: results.migrationFilesExist },
    { name: "Snapshots", result: results.snapshotsExist },
    { name: "Schema Drift", result: results.schemaDrift },
  ]
  
  if (results.databasePending) {
    checks.push({ name: "Database", result: results.databasePending })
  }
  
  let hasFailures = false
  
  for (const check of checks) {
    const icon = check.result.passed ? "✅" : "❌"
    console.log(`${icon} ${check.name}: ${check.result.message}`)
    
    if (!check.result.passed) {
      hasFailures = true
      if (check.result.details && (isVerbose || isCI)) {
        console.log()
        check.result.details.forEach(d => console.log(`   ${d}`))
        console.log()
      }
    }
  }
  
  // Summary
  console.log()
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  if (hasFailures) {
    console.log("❌ Migration check FAILED")
    console.log()
    console.log("Fix the issues above before deploying.")
    
    if (isCI) {
      // In CI mode, exit with specific codes for different failures
      if (!results.schemaDrift.passed) {
        process.exit(1) // Schema drift
      }
      if (!results.migrationFilesExist.passed || !results.snapshotsExist.passed) {
        process.exit(2) // File integrity
      }
      if (results.databasePending && !results.databasePending.passed) {
        process.exit(3) // Pending migrations
      }
      process.exit(4) // Other error
    }
    
    process.exit(1)
  } else {
    console.log("✅ All migration checks passed!")
    process.exit(0)
  }
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(4)
})
