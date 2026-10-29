/**
 * Seed Security Training starter courses
 *
 * Installs the starter course library (phishing, passwords, social engineering, ...)
 * for the demo organization. Idempotent: already-installed courses are skipped.
 *
 * Run with: pnpm db:seed-training
 * Add --refresh-lessons to overwrite installed starter lessons with the current library version
 * (for example after regenerating narration audio).
 * In production, admins install courses from Security > Training Courses > Starter Courses.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq } from "drizzle-orm"
import * as schema from "../lib/db/schema"
import { installTrainingLibrary } from "../lib/security/training-install"

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

async function seedSecurityTraining() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })

  try {
    console.log("🎓 Seeding security training courses...")

    const org = await db.query.organizations.findFirst({
      where: eq(schema.organizations.id, DEMO_ORG_ID),
      columns: { id: true },
    })
    if (!org) {
      console.log("  ⚠️  Demo organization not found. Run db:seed-rbac first. Skipping.")
      return
    }

    const refreshLessons = process.argv.includes("--refresh-lessons")
    const result = await installTrainingLibrary(db, DEMO_ORG_ID, null, undefined, { refreshLessons })
    for (const course of result.installed) {
      console.log(`  + Installed course: ${course.title}`)
    }
    for (const key of result.lessonsAdded) {
      console.log(`  ~ ${refreshLessons ? "Refreshed" : "Added"} lesson for existing course: ${key}`)
    }
    if (result.skipped.length > 0) {
      console.log(`  ✓ ${result.skipped.length} course(s) already installed`)
    }
    console.log("✅ Security training courses ready")
  } finally {
    await pool.end()
  }
}

seedSecurityTraining().catch((error) => {
  console.error("❌ Failed to seed security training:", error)
  process.exit(1)
})
