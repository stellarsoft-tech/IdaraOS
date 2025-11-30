/**
 * Assign Owner role to admin user
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq, and } from "drizzle-orm"
import * as schema from "../lib/db/schema"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/idaraos",
})

const db = drizzle(pool, { schema })

async function assignOwnerRole() {
  console.log("🔐 Assigning Owner role to admin user...")

  // Find admin user
  const adminUser = await db.query.users.findFirst({
    where: eq(schema.users.email, "admin@example.com"),
  })

  if (!adminUser) {
    console.log("❌ Admin user not found. Run db:create-admin first.")
    process.exit(1)
  }

  console.log(`  Found admin user: ${adminUser.email} (${adminUser.id})`)

  // Find owner role
  const ownerRole = await db.query.roles.findFirst({
    where: eq(schema.roles.slug, "owner"),
  })

  if (!ownerRole) {
    console.log("❌ Owner role not found. Run db:seed-rbac first.")
    process.exit(1)
  }

  console.log(`  Found Owner role: ${ownerRole.name} (${ownerRole.id})`)

  // Check if already assigned
  const existingAssignment = await db.query.userRoles.findFirst({
    where: and(
      eq(schema.userRoles.userId, adminUser.id),
      eq(schema.userRoles.roleId, ownerRole.id)
    ),
  })

  if (existingAssignment) {
    console.log("✓ Admin already has Owner role assigned")
  } else {
    await db.insert(schema.userRoles).values({
      userId: adminUser.id,
      roleId: ownerRole.id,
    })
    console.log("✓ Assigned Owner role to admin@example.com")
  }

  pool.end()
}

assignOwnerRole().catch(console.error)

