#!/usr/bin/env tsx
/**
 * Repair Migrations Script
 * 
 * This script fixes incorrectly baselined migrations. It:
 * 
 * 1. Checks each tracked migration against the database
 * 2. If a migration is marked as applied but its changes don't exist:
 *    - Removes the incorrect tracking entry
 *    - Allows db:run-migrations to apply it properly
 * 
 * Use this when:
 * - The baseline script incorrectly marked migrations as applied
 * - You see "column does not exist" errors for columns that should have been added
 * 
 * Usage:
 *   pnpm db:repair
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
 * Migration verification rules - same as baseline script
 */
interface MigrationCheck {
  tag: string
  description: string
  verify: (pool: Pool) => Promise<boolean>
}

const migrationChecks: MigrationCheck[] = [
  {
    tag: "0000_cheerful_dust",
    description: "Initial schema (core_organizations table)",
    verify: async (pool) => tableExists(pool, "core_organizations"),
  },
  {
    tag: "0001_add_people_settings",
    description: "People settings table",
    verify: async (pool) => tableExists(pool, "people_settings"),
  },
  {
    tag: "0002_furry_smasher",
    description: "People sync fields (source column)",
    verify: async (pool) => columnExists(pool, "people_persons", "source"),
  },
  {
    tag: "0003_add_people_entra_fields",
    description: "Entra fields (entra_created_at, hire_date, etc.)",
    verify: async (pool) => columnExists(pool, "people_persons", "entra_created_at"),
  },
]

async function repairMigrations() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Migration Repair Tool")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : undefined,
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
      console.log("ℹ️  No migrations tracking table found - nothing to repair")
      return
    }
    
    // Get all tracked migrations
    const trackedResult = await pool.query(`
      SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
    `)
    const tracked = trackedResult.rows.map(r => r.hash)
    
    console.log(`📋 Found ${tracked.length} tracked migration(s) in database`)
    console.log()
    
    let repairedCount = 0
    let validCount = 0
    
    // Check each tracked migration
    for (const hash of tracked) {
      const check = migrationChecks.find(c => c.tag === hash)
      
      if (!check) {
        console.log(`   ? ${hash} (no verification rule - assuming valid)`)
        validCount++
        continue
      }
      
      const changesExist = await check.verify(pool)
      
      if (changesExist) {
        console.log(`   ✓ ${hash} (valid - ${check.description})`)
        validCount++
      } else {
        console.log(`   ✗ ${hash} (INVALID - changes not in database!)`)
        console.log(`     → Removing incorrect tracking entry...`)
        
        await pool.query(`
          DELETE FROM drizzle.__drizzle_migrations WHERE hash = $1
        `, [hash])
        
        console.log(`     → Removed. Migration will be applied on next run.`)
        repairedCount++
      }
    }
    
    console.log()
    console.log("📊 Summary:")
    console.log(`   Valid migrations: ${validCount}`)
    console.log(`   Repaired (removed): ${repairedCount}`)
    
    if (repairedCount > 0) {
      console.log()
      console.log("⚠️  Some migrations were incorrectly tracked and have been removed.")
      console.log("   Run `pnpm db:run-migrations` to apply them properly.")
    } else {
      console.log()
      console.log("✅ All tracked migrations are valid!")
    }
    
  } catch (error) {
    console.error("❌ Repair failed:", error)
    throw error
  } finally {
    await pool.end()
  }
}

repairMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
