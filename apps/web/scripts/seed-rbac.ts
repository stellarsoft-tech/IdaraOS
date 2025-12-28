/**
 * RBAC Seed Script
 * 
 * Initializes the RBAC system with:
 * - Default modules (application areas)
 * - Default actions (view, create, edit, delete)
 * - Default permissions (all module+action combinations)
 * - Default system roles (Owner, Admin, Manager, Member, Viewer)
 * 
 * Run: pnpm db:seed-rbac
 * 
 * NOTE: Module and action definitions are maintained in sync-rbac-permissions.ts
 * to ensure consistency between seeding and syncing.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq, and } from "drizzle-orm"
import * as schema from "../lib/db/schema"
import { hashPassword } from "../lib/auth/session"
import { MODULE_REGISTRY, ACTION_REGISTRY } from "./sync-rbac-permissions"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/idaraos",
})

const db = drizzle(pool, { schema })

// Fixed demo org ID - must match what APIs expect
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

// Use shared registries (maintained in sync-rbac-permissions.ts)
const DEFAULT_MODULES = MODULE_REGISTRY
const DEFAULT_ACTIONS = ACTION_REGISTRY

// System roles and their permissions
// true = has permission, false or undefined = no permission
const SYSTEM_ROLES: Record<string, {
  name: string
  description: string
  color: string
  permissions: Record<string, Record<string, boolean>>
}> = {
  owner: {
    name: "Owner",
    description: "Full access to all features and settings. Cannot be modified or deleted.",
    color: "red",
    permissions: {
      // Owner gets ALL permissions on ALL modules
      "*": { view: true, create: true, edit: true, delete: true },
    },
  },
  admin: {
    name: "Admin",
    description: "Full access to most features except some owner-only settings.",
    color: "orange",
    permissions: {
      // People & HR - Full access
      "people.overview": { view: true, create: true, edit: true, delete: true },
      "people.directory": { view: true, create: true, edit: true, delete: true },
      "people.teams": { view: true, create: true, edit: true, delete: true },
      "people.roles": { view: true, create: true, edit: true, delete: true },
      "people.workflows": { view: true, create: true, edit: true, delete: true },
      "people.onboarding": { view: true, create: true, edit: true, delete: true },
      "people.offboarding": { view: true, create: true, edit: true, delete: true },
      "people.timeoff": { view: true, create: true, edit: true, delete: true },
      "people.documents": { view: true, create: true, edit: true, delete: true },
      "people.auditlog": { view: true, create: false, edit: false, delete: false },
      // Assets - Full access
      "assets.overview": { view: true, create: true, edit: true, delete: true },
      "assets.inventory": { view: true, create: true, edit: true, delete: true },
      "assets.categories": { view: true, create: true, edit: true, delete: true },
      "assets.assignments": { view: true, create: true, edit: true, delete: true },
      "assets.maintenance": { view: true, create: true, edit: true, delete: true },
      "assets.lifecycle": { view: true, create: true, edit: true, delete: true },
      "assets.settings": { view: true, create: true, edit: true, delete: true },
      // Security - Full access
      "security.overview": { view: true, create: true, edit: true, delete: true },
      "security.risks": { view: true, create: true, edit: true, delete: true },
      "security.controls": { view: true, create: true, edit: true, delete: true },
      // Workflows - Full access
      "workflows.overview": { view: true, create: true, edit: true, delete: true },
      "workflows.templates": { view: true, create: true, edit: true, delete: true },
      "workflows.instances": { view: true, create: true, edit: true, delete: true },
      "workflows.tasks": { view: true, create: true, edit: true, delete: true },
      "workflows.board": { view: true, create: true, edit: true, delete: true },
      "workflows.settings": { view: true, create: true, edit: true, delete: true },
      // Settings - Limited
      "settings.organization": { view: true, create: true, edit: true, delete: false },
      "settings.users": { view: true, create: true, edit: true, delete: true },
      "settings.roles": { view: true, create: true, edit: true, delete: true },
      "settings.integrations": { view: true, create: true, edit: true, delete: true },
      "settings.auditlog": { view: true, create: false, edit: false, delete: false },
      "settings.branding": { view: true, create: true, edit: true, delete: false },
      "settings.apikeys": { view: true, create: true, edit: true, delete: true },
    },
  },
  manager: {
    name: "Manager",
    description: "Can view and edit most records, limited create/delete access.",
    color: "blue",
    permissions: {
      // People & HR - View and manage team
      "people.overview": { view: true, create: false, edit: false, delete: false },
      "people.directory": { view: true, create: false, edit: true, delete: false },
      "people.teams": { view: true, create: false, edit: false, delete: false },
      "people.roles": { view: true, create: false, edit: false, delete: false },
      "people.workflows": { view: true, create: false, edit: true, delete: false },
      "people.onboarding": { view: true, create: true, edit: true, delete: false },
      "people.offboarding": { view: true, create: true, edit: true, delete: false },
      "people.timeoff": { view: true, create: true, edit: true, delete: false },
      "people.documents": { view: true, create: true, edit: true, delete: false },
      "people.auditlog": { view: true, create: false, edit: false, delete: false },
      // Assets - Limited
      "assets.overview": { view: true, create: false, edit: false, delete: false },
      "assets.inventory": { view: true, create: false, edit: true, delete: false },
      "assets.categories": { view: true, create: false, edit: false, delete: false },
      "assets.assignments": { view: true, create: true, edit: true, delete: false },
      "assets.maintenance": { view: true, create: false, edit: false, delete: false },
      "assets.lifecycle": { view: true, create: false, edit: false, delete: false },
      // Security - View only
      "security.overview": { view: true, create: false, edit: false, delete: false },
      "security.risks": { view: true, create: false, edit: false, delete: false },
      // Workflows - View and manage instances/tasks
      "workflows.overview": { view: true, create: false, edit: false, delete: false },
      "workflows.templates": { view: true, create: true, edit: true, delete: false },
      "workflows.instances": { view: true, create: true, edit: true, delete: false },
      "workflows.tasks": { view: true, create: true, edit: true, delete: false },
      "workflows.board": { view: true, create: false, edit: true, delete: false },
      // Settings - View only
      "settings.organization": { view: true, create: false, edit: false, delete: false },
      "settings.users": { view: true, create: false, edit: false, delete: false },
      "settings.roles": { view: true, create: false, edit: false, delete: false },
      "settings.auditlog": { view: true, create: false, edit: false, delete: false },
    },
  },
  member: {
    name: "Member",
    description: "Standard employee access - view most records, limited editing.",
    color: "green",
    permissions: {
      // People & HR - View directory, manage own time off
      "people.overview": { view: true, create: false, edit: false, delete: false },
      "people.directory": { view: true, create: false, edit: false, delete: false },
      "people.timeoff": { view: true, create: true, edit: false, delete: false }, // Can request time off
      "people.documents": { view: true, create: false, edit: false, delete: false },
      // Assets - View only
      "assets.overview": { view: true, create: false, edit: false, delete: false },
      "assets.inventory": { view: true, create: false, edit: false, delete: false },
      "assets.categories": { view: true, create: false, edit: false, delete: false },
      "assets.assignments": { view: true, create: false, edit: false, delete: false },
      // Workflows - View and complete own tasks
      "workflows.overview": { view: true, create: false, edit: false, delete: false },
      "workflows.tasks": { view: true, create: false, edit: true, delete: false }, // Can complete assigned tasks
      "workflows.board": { view: true, create: false, edit: false, delete: false },
      // Settings - View org only
      "settings.organization": { view: true, create: false, edit: false, delete: false },
    },
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access to allowed areas.",
    color: "gray",
    permissions: {
      "people.overview": { view: true, create: false, edit: false, delete: false },
      "people.directory": { view: true, create: false, edit: false, delete: false },
      "settings.organization": { view: true, create: false, edit: false, delete: false },
    },
  },
}

async function seedRBAC() {
  console.log("🔐 Seeding RBAC system...")

  // Get or create the demo org with fixed ID
  let org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, DEMO_ORG_ID),
  })
  
  if (!org) {
    console.log("  Creating demo organization...")
    const [newOrg] = await db.insert(schema.organizations).values({
      id: DEMO_ORG_ID,
      name: "Demo Organization",
      slug: "demo-org",
    }).returning()
    org = newOrg
  }

  console.log(`  Using organization: ${org.name} (${org.id})`)

  // 1. Seed Actions
  console.log("\n📋 Seeding actions...")
  const actionMap: Record<string, string> = {}
  
  for (const action of DEFAULT_ACTIONS) {
    const existing = await db.query.actions.findFirst({
      where: eq(schema.actions.slug, action.slug),
    })
    
    if (existing) {
      actionMap[action.slug] = existing.id
      console.log(`  ✓ Action exists: ${action.name}`)
    } else {
      const [created] = await db.insert(schema.actions).values(action).returning()
      actionMap[action.slug] = created.id
      console.log(`  + Created action: ${action.name}`)
    }
  }

  // 2. Seed Modules
  console.log("\n📦 Seeding modules...")
  const moduleMap: Record<string, string> = {}
  
  for (const mod of DEFAULT_MODULES) {
    const existing = await db.query.modules.findFirst({
      where: eq(schema.modules.slug, mod.slug),
    })
    
    if (existing) {
      moduleMap[mod.slug] = existing.id
      console.log(`  ✓ Module exists: ${mod.name}`)
    } else {
      const [created] = await db.insert(schema.modules).values(mod).returning()
      moduleMap[mod.slug] = created.id
      console.log(`  + Created module: ${mod.name}`)
    }
  }

  // 3. Seed Permissions (all module+action combinations)
  console.log("\n🔑 Seeding permissions...")
  const permissionMap: Record<string, string> = {} // "module.action" -> permission id
  
  for (const modSlug of Object.keys(moduleMap)) {
    for (const actSlug of Object.keys(actionMap)) {
      const key = `${modSlug}:${actSlug}`
      
      const existing = await db.query.permissions.findFirst({
        where: and(
          eq(schema.permissions.moduleId, moduleMap[modSlug]),
          eq(schema.permissions.actionId, actionMap[actSlug])
        ),
      })
      
      if (existing) {
        permissionMap[key] = existing.id
      } else {
        const [created] = await db.insert(schema.permissions).values({
          moduleId: moduleMap[modSlug],
          actionId: actionMap[actSlug],
        }).returning()
        permissionMap[key] = created.id
      }
    }
  }
  console.log(`  ✓ ${Object.keys(permissionMap).length} permissions configured`)

  // 4. Seed Roles and Role Permissions
  console.log("\n👤 Seeding roles...")
  
  for (const [roleSlug, roleData] of Object.entries(SYSTEM_ROLES)) {
    // Check if role exists
    let role = await db.query.roles.findFirst({
      where: and(
        eq(schema.roles.orgId, org.id),
        eq(schema.roles.slug, roleSlug)
      ),
    })
    
    if (!role) {
      const [created] = await db.insert(schema.roles).values({
        orgId: org.id,
        slug: roleSlug,
        name: roleData.name,
        description: roleData.description,
        color: roleData.color,
        isSystem: true,
        isDefault: roleSlug === "member", // Member is default for new users
      }).returning()
      role = created
      console.log(`  + Created role: ${roleData.name}`)
    } else {
      console.log(`  ✓ Role exists: ${roleData.name}`)
    }

    // Clear existing role permissions for this role (to handle updates)
    await db.delete(schema.rolePermissions).where(
      eq(schema.rolePermissions.roleId, role.id)
    )

    // Add role permissions
    const rolePermsToInsert: { roleId: string; permissionId: string }[] = []

    // Handle wildcard (*) - gives all permissions
    if (roleData.permissions["*"]) {
      const wildcardPerms = roleData.permissions["*"]
      for (const modSlug of Object.keys(moduleMap)) {
        for (const actSlug of Object.keys(actionMap)) {
          if (wildcardPerms[actSlug]) {
            const key = `${modSlug}:${actSlug}`
            if (permissionMap[key]) {
              rolePermsToInsert.push({
                roleId: role.id,
                permissionId: permissionMap[key],
              })
            }
          }
        }
      }
    } else {
      // Handle specific module permissions
      for (const [modSlug, actions] of Object.entries(roleData.permissions)) {
        for (const [actSlug, hasPermission] of Object.entries(actions)) {
          if (hasPermission) {
            const key = `${modSlug}:${actSlug}`
            if (permissionMap[key]) {
              rolePermsToInsert.push({
                roleId: role.id,
                permissionId: permissionMap[key],
              })
            }
          }
        }
      }
    }

    if (rolePermsToInsert.length > 0) {
      await db.insert(schema.rolePermissions).values(rolePermsToInsert)
      console.log(`    → Assigned ${rolePermsToInsert.length} permissions`)
    }
  }

  // 5. Create admin user and assign Owner role
  console.log("\n👤 Creating admin user...")
  
  let adminUser = await db.query.users.findFirst({
    where: eq(schema.users.email, "admin@example.com"),
  })

  if (!adminUser) {
    // Create admin user
    const passwordHash = await hashPassword("Admin123!")
    const [created] = await db.insert(schema.users).values({
      orgId: org.id,
      email: "admin@example.com",
      name: "Demo Admin",
      role: "Owner",
      status: "active",
      passwordHash,
      invitedAt: new Date(),
    }).returning()
    adminUser = created
    console.log(`  + Created admin user: admin@example.com`)
  } else {
    // Update password to ensure it's set correctly
    const passwordHash = await hashPassword("Admin123!")
    await db
      .update(schema.users)
      .set({
        passwordHash,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.email, "admin@example.com"))
    console.log(`  ✓ Admin user exists: admin@example.com (password updated)`)
  }

  // Assign Owner RBAC role
    const ownerRole = await db.query.roles.findFirst({
      where: and(
        eq(schema.roles.orgId, org.id),
        eq(schema.roles.slug, "owner")
      ),
    })

  if (ownerRole && adminUser) {
      // Check if already assigned
      const existingAssignment = await db.query.userRoles.findFirst({
        where: and(
          eq(schema.userRoles.userId, adminUser.id),
          eq(schema.userRoles.roleId, ownerRole.id)
        ),
      })

      if (!existingAssignment) {
        await db.insert(schema.userRoles).values({
          userId: adminUser.id,
          roleId: ownerRole.id,
        })
      console.log(`  + Assigned Owner RBAC role to admin@example.com`)
      } else {
      console.log(`  ✓ admin@example.com already has Owner RBAC role`)
    }
  }

  console.log("\n✅ RBAC seeding complete!")
  console.log("\n📋 Admin credentials:")
  console.log("  Email: admin@example.com")
  console.log("  Password: Admin123!")
  console.log("  Role: Owner (full access)")
}

seedRBAC()
  .catch(console.error)
  .finally(() => pool.end())

