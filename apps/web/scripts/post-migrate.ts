#!/usr/bin/env tsx
/**
 * Post-Migration Hook & Data Migration Runner
 * 
 * This script runs automatically after database schema migrations.
 * It handles:
 * 1. RBAC permission syncing (ensures Owner has all new module permissions)
 * 2. Data migrations that need to run after schema changes
 * 3. One-time data transformations
 * 
 * Data Migration Pattern:
 * - Each data migration has a unique ID
 * - Migrations are tracked in the `data_migrations` table
 * - Each migration runs only once, even if this script runs multiple times
 * - Migrations are idempotent (safe to run multiple times if needed)
 * 
 * Adding a new data migration:
 * 1. Add a new entry to DATA_MIGRATIONS array below
 * 2. Implement the migration function
 * 3. Run pnpm db:post-migrate
 * 
 * Run: pnpm db:post-migrate (also called automatically during deployment)
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { sql, eq } from "drizzle-orm"
import fs from "fs"
import path from "path"
import { syncRBACPermissions } from "./sync-rbac-permissions"
import { documents } from "../lib/db/schema/docs"

// ============================================================================
// Types
// ============================================================================

interface DataMigration {
  id: string
  description: string
  run: (db: ReturnType<typeof drizzle>, pool: Pool) => Promise<void>
}

// ============================================================================
// Data Migrations Registry
// ============================================================================
// Add new data migrations here. Each migration runs once.
// Migrations are executed in array order.

const DATA_MIGRATIONS: DataMigration[] = [
  // Example migration (already completed for most databases):
  {
    id: "2024-01-01_scim_to_sync",
    description: "Rename 'scim' source values to 'sync'",
    run: async (db) => {
      // Update people_persons source from 'scim' to 'sync'
      await db.execute(sql`
        UPDATE people_persons 
        SET source = 'sync' 
        WHERE source = 'scim'
      `)
      
      // Update rbac_user_roles source from 'scim' to 'sync'
      await db.execute(sql`
        UPDATE rbac_user_roles 
        SET source = 'sync' 
        WHERE source = 'scim'
      `)
    },
  },
  
  // Add new data migrations below this line:
  
  {
    id: "2026-01-20_populate_org_role_teams_junction",
    description: "Populate people_organizational_role_teams junction table from existing teamId values",
    run: async (db) => {
      // Insert existing team associations from the teamId column into the junction table
      // Uses ON CONFLICT DO NOTHING to make it idempotent (safe to run multiple times)
      const result = await db.execute(sql`
        INSERT INTO people_organizational_role_teams (role_id, team_id, created_at)
        SELECT 
          por.id as role_id,
          por.team_id as team_id,
          COALESCE(por.created_at, NOW()) as created_at
        FROM people_organizational_roles por
        WHERE por.team_id IS NOT NULL
        ON CONFLICT (role_id, team_id) DO NOTHING
      `)
      
      console.log(`            Populated junction table with existing team associations`)
    },
  },

  {
    id: "2026-04-07_backfill_docs_content_from_mdx",
    description: "Backfill docs_documents.content from content/docs/*.mdx files",
    run: async (db) => {
      const contentDir = path.join(process.cwd(), "content/docs")

      let mdxFiles: string[] = []
      try {
        const allFiles = fs.readdirSync(contentDir)
        mdxFiles = allFiles.filter((f) => f.endsWith(".mdx"))
      } catch {
        console.log(`            No content/docs directory found — skipping (expected in production)`)
        return
      }

      if (mdxFiles.length === 0) {
        console.log(`            No .mdx files found — nothing to backfill`)
        return
      }

      let migrated = 0
      let skipped = 0

      for (const file of mdxFiles) {
        const slug = file.replace(".mdx", "")
        const filePath = path.join(contentDir, file)

        const [doc] = await db
          .select({ id: documents.id, content: documents.content })
          .from(documents)
          .where(eq(documents.slug, slug))
          .limit(1)

        if (!doc) {
          continue
        }

        if (doc.content) {
          skipped++
          continue
        }

        const content = fs.readFileSync(filePath, "utf-8")
        await db
          .update(documents)
          .set({ content })
          .where(eq(documents.id, doc.id))
        migrated++
      }

      console.log(`            Backfilled ${migrated} document(s), skipped ${skipped} (already had content)`)
    },
  },
]

// ============================================================================
// Data Migration Runner
// ============================================================================

async function ensureDataMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_migrations (
      id TEXT PRIMARY KEY,
      description TEXT,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      success BOOLEAN NOT NULL DEFAULT true,
      error TEXT
    )
  `)
}

async function getAppliedDataMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query(`
    SELECT id FROM data_migrations WHERE success = true
  `)
  return new Set(result.rows.map(r => r.id))
}

async function recordDataMigration(
  pool: Pool, 
  id: string, 
  description: string,
  success: boolean,
  error?: string
): Promise<void> {
  await pool.query(`
    INSERT INTO data_migrations (id, description, success, error, executed_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE SET
      success = $3,
      error = $4,
      executed_at = NOW()
  `, [id, description, success, error || null])
}

async function runDataMigrations(db: ReturnType<typeof drizzle>, pool: Pool): Promise<void> {
  console.log("📦 Running data migrations...")
  console.log()
  
  await ensureDataMigrationsTable(pool)
  const applied = await getAppliedDataMigrations(pool)
  
  const pending = DATA_MIGRATIONS.filter(m => !applied.has(m.id))
  
  if (pending.length === 0) {
    console.log("   ✓ No pending data migrations")
    return
  }
  
  console.log(`   Found ${pending.length} pending data migration(s)`)
  console.log()
  
  for (const migration of pending) {
    console.log(`   Running: ${migration.id}`)
    console.log(`            ${migration.description}`)
    
    try {
      await migration.run(db, pool)
      await recordDataMigration(pool, migration.id, migration.description, true)
      console.log(`   ✅ Completed: ${migration.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await recordDataMigration(pool, migration.id, migration.description, false, errorMessage)
      console.error(`   ❌ Failed: ${migration.id}`)
      console.error(`      Error: ${errorMessage}`)
      
      // Don't stop on data migration failure - log and continue
      // This prevents blocking deployments for non-critical data fixes
      console.log(`   ⚠️  Continuing with remaining migrations...`)
    }
    console.log()
  }
}

// ============================================================================
// Main
// ============================================================================

async function postMigrate() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Post-Migration Tasks")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()
  
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.warn("⚠️  DATABASE_URL not set, skipping post-migration tasks")
    return
  }
  
  // Check if SSL should be disabled (for local Docker dev)
  const disableSsl = process.env.DB_SSL === "false" || databaseUrl.includes("localhost") || databaseUrl.includes("db:5432")
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: disableSsl ? false : (process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : undefined),
  })
  
  const db = drizzle(pool)
  
  try {
    // 1. Run data migrations
    await runDataMigrations(db, pool)
    console.log()
    
    // 2. Sync RBAC permissions (ensures Owner has all new module permissions)
    console.log("🔐 Syncing RBAC permissions...")
    await syncRBACPermissions()
    console.log()
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("✅ Post-migration tasks complete!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
  } finally {
    await pool.end()
  }
}

postMigrate()
  .catch((error) => {
    console.error("❌ Post-migration failed:", error)
    process.exit(1)
  })
