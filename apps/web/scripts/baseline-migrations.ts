#!/usr/bin/env tsx
/**
 * Baseline Migrations Script (Smart Version)
 * 
 * This script is for databases that were created using `db:push` (development mode)
 * before migrations were set up. It:
 * 
 * 1. Creates the "drizzle" schema and "__drizzle_migrations" table if needed
 * 2. Reads all migrations from the drizzle/meta/_journal.json
 * 3. For each migration, checks if its schema changes already exist in the database
 * 4. Only marks migrations as applied if their changes are already present
 * 5. Leaves new migrations to be run by db:run-migrations
 * 
 * This is smarter than the old baseline that marked everything as applied!
 * 
 * Usage:
 *   pnpm db:baseline
 *   
 * After running this, use `pnpm db:run-migrations` to apply any pending migrations.
 */

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

/**
 * Check if a specific column exists in a table
 */
async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name = $2
    ) as exists
  `, [table, column])
  return result.rows[0].exists
}

/**
 * Check if a specific table exists
 */
async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    ) as exists
  `, [table])
  return result.rows[0].exists
}

/**
 * Migration verification rules
 * Maps migration tags to checks that verify if the migration was applied
 */
interface MigrationCheck {
  tag: string
  verify: (pool: Pool) => Promise<boolean>
}

const migrationChecks: MigrationCheck[] = [
  {
    // Initial schema - check if core_organizations exists
    tag: "0000_cheerful_dust",
    verify: async (pool) => tableExists(pool, "core_organizations"),
  },
  {
    // People settings - check if people_settings table exists
    tag: "0001_add_people_settings",
    verify: async (pool) => tableExists(pool, "people_settings"),
  },
  {
    // People sync fields - check if source column exists on people_persons
    tag: "0002_furry_smasher",
    verify: async (pool) => columnExists(pool, "people_persons", "source"),
  },
  {
    // Entra fields - check if entra_created_at column exists on people_persons
    tag: "0003_add_people_entra_fields",
    verify: async (pool) => columnExists(pool, "people_persons", "entra_created_at"),
  },
  {
    // Audit logs - check if audit_logs table exists
    tag: "0004_add_audit_logs",
    verify: async (pool) => tableExists(pool, "audit_logs"),
  },
]

/**
 * Get verification function for a migration, or default to checking if tables exist
 */
function getVerificationForMigration(tag: string): ((pool: Pool) => Promise<boolean>) | null {
  const check = migrationChecks.find(c => c.tag === tag)
  return check?.verify ?? null
}

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
    // Check if any tables exist (meaning db:push was used at some point)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'core_organizations'
      ) as exists
    `)
    
    const tablesExist = tableCheck.rows[0].exists
    
    if (!tablesExist) {
      console.log("ℹ️  No existing tables detected - skipping baseline")
      console.log("   (db:run-migrations will create tables from scratch)")
      return
    }
    
    console.log("✅ Existing tables detected (from db:push)")
    
    // Create the drizzle schema if it doesn't exist
    await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`)
    
    // Create the drizzle migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `)
    console.log("✅ Migrations tracking table ready (drizzle.__drizzle_migrations)")
    console.log()
    
    // Read all migrations from the journal
    const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json")
    const journalContent = fs.readFileSync(journalPath, "utf-8")
    const journal: Journal = JSON.parse(journalContent)
    
    console.log(`📋 Found ${journal.entries.length} migration(s) in journal`)
    console.log()
    
    let baselinedCount = 0
    let skippedCount = 0
    let alreadyBaselinedCount = 0
    
    // Process each migration
    for (const entry of journal.entries) {
      // Check if already in migrations table
      const migrationCheck = await pool.query(`
        SELECT * FROM "drizzle"."__drizzle_migrations" 
        WHERE hash = $1
        LIMIT 1
      `, [entry.tag])
      
      if (migrationCheck.rows.length > 0) {
        console.log(`   ✓ ${entry.tag} (already tracked)`)
        alreadyBaselinedCount++
        continue
      }
      
      // Get verification function for this migration
      const verify = getVerificationForMigration(entry.tag)
      
      if (verify) {
        // Check if migration's changes exist in the database
        const changesExist = await verify(pool)
        
        if (changesExist) {
          // Mark migration as applied since changes already exist
          await pool.query(`
            INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
            VALUES ($1, $2)
          `, [entry.tag, entry.when])
          console.log(`   ✓ ${entry.tag} (baselined - changes already exist)`)
          baselinedCount++
        } else {
          // Don't baseline - let migration runner apply it
          console.log(`   ○ ${entry.tag} (pending - changes not in database)`)
          skippedCount++
        }
      } else {
        // No verification rule - be conservative and don't baseline
        console.log(`   ⚠ ${entry.tag} (no verification rule - will be run)`)
        skippedCount++
      }
    }
    
    console.log()
    console.log("📊 Summary:")
    console.log(`   Already tracked: ${alreadyBaselinedCount}`)
    console.log(`   Newly baselined: ${baselinedCount}`)
    console.log(`   Pending (will run): ${skippedCount}`)
    
    // Run the data migration (scim → sync) if applicable
    console.log()
    console.log("🔄 Running data migration: scim → sync...")
    
    try {
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
    } catch (_error) {
      // Column might not exist yet, that's fine
      console.log("ℹ️  Data migration skipped (table may not have source column yet)")
    }
    
    console.log()
    if (skippedCount > 0) {
      console.log("⚠️  There are pending migrations that need to be applied.")
      console.log("   Run: pnpm db:run-migrations")
    } else {
      console.log("✅ Baseline complete! All migrations are tracked.")
    }
    
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
