/**
 * Create admin user script
 * Run: pnpm tsx scripts/create-admin.ts
 * 
 * Creates an admin user with the Owner RBAC role (highest privileges)
 */

import { db } from "../lib/db/index"
import { users, organizations, roles, userRoles } from "../lib/db/schema"
import { eq, and } from "drizzle-orm"
import { hashPassword } from "../lib/auth/session"

// Fixed demo org ID - must match what APIs and seed-rbac expect
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

async function createAdmin() {
  try {
    // Get or create the demo org with fixed ID
    let org = await db.query.organizations.findFirst({
      where: eq(organizations.id, DEMO_ORG_ID),
    })
    
    if (!org) {
      // Create a default org if none exists
      const result = await db.insert(organizations).values({
        id: DEMO_ORG_ID,
        name: "Demo Organization",
        slug: "demo-org",
        timezone: "UTC",
        dateFormat: "YYYY-MM-DD",
        currency: "USD",
      }).returning()
      org = result[0]
      console.log("✓ Created organization")
    } else {
      console.log(`✓ Using organization: ${org.name}`)
    }

    // Check if admin user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, "admin@example.com"),
    })

    let adminUser
    if (existingUser) {
      // Update password if user exists
      const passwordHash = hashPassword("Admin123!")
      const result = await db
        .update(users)
        .set({
          passwordHash,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(users.email, "admin@example.com"))
        .returning()
      adminUser = result[0]
      console.log("✓ Updated admin@example.com password")
    } else {
      // Create admin user
      const passwordHash = hashPassword("Admin123!")
      const result = await db.insert(users).values({
        orgId: org.id,
        email: "admin@example.com",
        name: "Demo Admin",
        role: "Owner",
        status: "active",
        passwordHash,
        invitedAt: new Date(),
      }).returning()
      adminUser = result[0]
      console.log("✓ Created admin@example.com user")
    }

    // Assign Owner RBAC role
    const ownerRole = await db.query.roles.findFirst({
      where: and(
        eq(roles.orgId, org.id),
        eq(roles.slug, "owner")
      ),
    })

    if (ownerRole && adminUser) {
      // Check if role already assigned
      const existingAssignment = await db.query.userRoles.findFirst({
        where: and(
          eq(userRoles.userId, adminUser.id),
          eq(userRoles.roleId, ownerRole.id)
        ),
      })

      if (!existingAssignment) {
        await db.insert(userRoles).values({
          userId: adminUser.id,
          roleId: ownerRole.id,
        })
        console.log("✓ Assigned Owner RBAC role to admin user")
      } else {
        console.log("✓ Admin user already has Owner role")
      }
    } else if (!ownerRole) {
      console.log("⚠ Owner role not found - run db:seed-rbac first")
    }

    console.log("\n==========================================")
    console.log("Login credentials:")
    console.log("  Email: admin@example.com")
    console.log("  Password: Admin123!")
    console.log("  Role: Owner (full access)")
    console.log("==========================================")
    console.log("\nYou can now login at http://localhost:3000/login")
  } catch (error) {
    console.error("Error creating admin:", error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

createAdmin()
