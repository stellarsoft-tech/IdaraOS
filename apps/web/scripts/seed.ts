/**
 * Database Seed Script
 * Run: pnpm db:seed
 * 
 * Creates demo data for development/testing.
 * This is OPTIONAL - production instances start with empty tables.
 * 
 * IMPORTANT: This script is IDEMPOTENT - safe to run multiple times.
 * It will NOT delete existing data, only insert demo data if it doesn't exist.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq } from "drizzle-orm"
import { persons } from "../lib/db/schema/people"
import { organizationalLevels } from "../lib/db/schema/org-levels"

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/idaraos"

async function seed() {
  console.log("🌱 Starting database seed...")
  
  const pool = new Pool({ connectionString: DATABASE_URL })
  const db = drizzle(pool)
  
  // Demo organization ID - in production, this comes from auth
  const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"
  
  // Demo users with generic data
  const demoUsers = [
    {
      orgId: DEMO_ORG_ID,
      slug: "john-doe",
      name: "John Doe",
      email: "john@example.com",
      role: "CEO",
      team: "Executive",
      status: "active" as const,
      startDate: "2020-01-15",
      location: "New York",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "jane-smith",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "CTO",
      team: "Engineering",
      status: "active" as const,
      startDate: "2020-02-01",
      location: "San Francisco",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "bob-wilson",
      name: "Bob Wilson",
      email: "bob@example.com",
      role: "Security Lead",
      team: "Security",
      status: "active" as const,
      startDate: "2021-03-10",
      location: "Austin",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "alice-johnson",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "HR Manager",
      team: "People",
      status: "active" as const,
      startDate: "2021-06-15",
      location: "Chicago",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "new-employee",
      name: "New Employee",
      email: "new@example.com",
      role: "Software Engineer",
      team: "Engineering",
      status: "onboarding" as const,
      startDate: "2024-11-01",
      location: "Remote",
    },
  ]
  
  try {
    // Check if demo data already exists - use john@example.com as sentinel
    console.log("  Checking for existing seed data...")
    const existingDemo = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.email, "john@example.com"))
      .limit(1)
    
    const skipUsers = existingDemo.length > 0
    if (skipUsers) {
      console.log("✅ Demo users already exist. Skipping user creation.")
    }
    
    // Insert demo users (only if they don't exist)
    if (!skipUsers) {
      console.log("  Inserting demo users...")
      let insertedCount = 0
      
      for (const user of demoUsers) {
        // Check if this specific user already exists
        const exists = await db
          .select({ id: persons.id })
          .from(persons)
          .where(eq(persons.email, user.email))
          .limit(1)
        
        if (exists.length === 0) {
          await db.insert(persons).values(user)
          insertedCount++
        }
      }
      
      console.log(`✅ Users seed complete! Created ${insertedCount} demo users.`)
      if (insertedCount > 0) {
        console.log("\n  Demo users created:")
        console.log("  - john@example.com (CEO)")
        console.log("  - jane@example.com (CTO)")
        console.log("  - bob@example.com (Security Lead)")
        console.log("  - alice@example.com (HR Manager)")
        console.log("  - new@example.com (New Employee)")
      }
    }
    
    // Seed organizational levels
    console.log("\n  Checking for existing organizational levels...")
    const existingLevels = await db
      .select({ id: organizationalLevels.id })
      .from(organizationalLevels)
      .where(eq(organizationalLevels.orgId, DEMO_ORG_ID))
      .limit(1)
    
    if (existingLevels.length > 0) {
      console.log("✅ Organizational levels already exist. Skipping.")
    } else {
      console.log("  Inserting default organizational levels...")
      
      const defaultLevels = [
        {
          orgId: DEMO_ORG_ID,
          code: "L0",
          name: "Executive",
          description: "C-suite and executive leadership",
          sortOrder: 0,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L1",
          name: "Director",
          description: "Department and division heads",
          sortOrder: 1,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L2",
          name: "Manager",
          description: "Team managers and supervisors",
          sortOrder: 2,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L3",
          name: "Senior",
          description: "Senior individual contributors",
          sortOrder: 3,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L4",
          name: "Staff",
          description: "Standard individual contributors",
          sortOrder: 4,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L5",
          name: "Entry",
          description: "Entry-level positions",
          sortOrder: 5,
        },
      ]
      
      await db.insert(organizationalLevels).values(defaultLevels)
      
      console.log("✅ Organizational levels created:")
      for (const level of defaultLevels) {
        console.log(`  - ${level.code}: ${level.name}`)
      }
    }
    
    console.log("\n✅ All seed complete!")
  } catch (error) {
    console.error("❌ Seed failed:", error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()

