#!/usr/bin/env tsx
/**
 * Baseline Migrations Script
 * 
 * This script is for databases that were created using `db:push` (development mode)
 * before migrations were set up. It:
 * 
 * 1. Creates the "drizzle" schema and "__drizzle_migrations" table if needed
 *    (Drizzle ORM stores migrations in drizzle.__drizzle_migrations by default)
 * 2. Reads all migrations from the drizzle/meta/_journal.json
 * 3. Marks ALL schema migrations as already applied (since db:push created all tables)
 * 4. Runs only the data migration portion
 * 
 * Usage:
 *   pnpm db:baseline
 *   
 * After running this once, you can use `pnpm db:run-migrations` normally.
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
      console.log("ℹ️  No existing tables detected - skipping baseline")
      console.log("   (db:run-migrations will create tables from scratch)")
      return // pool.end() will be called in finally block
    }
    
    console.log("✅ Existing tables detected (from db:push)")
    
    // Create the drizzle schema if it doesn't exist (Drizzle uses this by default)
    await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`)
    
    // Create the drizzle migrations table if it doesn't exist
    // NOTE: Drizzle ORM looks for this table in the "drizzle" schema, not "public"
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `)
    console.log("✅ Migrations tracking table ready (drizzle.__drizzle_migrations)")
    
    // Read all migrations from the journal
    const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json")
    const journalContent = fs.readFileSync(journalPath, "utf-8")
    const journal: Journal = JSON.parse(journalContent)
    
    console.log(`📋 Found ${journal.entries.length} migration(s) in journal`)
    
    // Mark each migration as applied if not already
    for (const entry of journal.entries) {
      const migrationCheck = await pool.query(`
        SELECT * FROM "drizzle"."__drizzle_migrations" 
        WHERE hash = $1
        LIMIT 1
      `, [entry.tag])
      
      if (migrationCheck.rows.length > 0) {
        console.log(`   ✓ ${entry.tag} (already baselined)`)
      } else {
        // Mark migration as applied (since tables exist via db:push)
        await pool.query(`
          INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
          VALUES ($1, $2)
        `, [entry.tag, entry.when])
        console.log(`   ✓ ${entry.tag} (marked as applied)`)
      }
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

