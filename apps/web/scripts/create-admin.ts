/**
 * Create admin user script
 * Run: pnpm tsx scripts/create-admin.ts
 */

import { db } from "../lib/db/index"
import { users, organizations } from "../lib/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "../lib/auth/session"

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

async function createAdmin() {
  try {
    // Ensure org exists
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, DEMO_ORG_ID))
      .limit(1)

    if (!existingOrg) {
      await db.insert(organizations).values({
        id: DEMO_ORG_ID,
        name: "My Organization",
        slug: "my-org",
        timezone: "UTC",
        dateFormat: "YYYY-MM-DD",
        currency: "USD",
      })
      console.log("✓ Created organization")
    }

    // Check if admin user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@example.com"))
      .limit(1)

    if (existingUser) {
      // Update password if user exists
      const passwordHash = hashPassword("Admin123!")
      await db
        .update(users)
        .set({
          passwordHash,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(users.email, "admin@example.com"))
      console.log("✓ Updated admin@example.com password")
    } else {
      // Create admin user
      const passwordHash = hashPassword("Admin123!")
      await db.insert(users).values({
        orgId: DEMO_ORG_ID,
        email: "admin@example.com",
        name: "Demo Admin",
        role: "Owner",
        status: "active",
        passwordHash,
        invitedAt: new Date(),
      })
      console.log("✓ Created admin@example.com user")
    }

    console.log("\nLogin credentials:")
    console.log("Email: admin@example.com")
    console.log("Password: Admin123!")
    console.log("\nYou can now login at http://localhost:3001/login")
  } catch (error) {
    console.error("Error creating admin:", error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

createAdmin()

