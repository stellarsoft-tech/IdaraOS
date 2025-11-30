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
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq, and } from "drizzle-orm"
import * as schema from "../lib/db/schema"
import { hashPassword } from "../lib/auth/session"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/idaraos",
})

const db = drizzle(pool, { schema })

// Fixed demo org ID - must match what APIs expect
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

// ============ Default Data ============

const DEFAULT_MODULES = [
  // People & HR - Overview & Directory
  { slug: "people.overview", name: "People Overview", description: "View People & HR dashboard", category: "People & HR", icon: "LayoutDashboard", sortOrder: "100" },
  { slug: "people.directory", name: "People Directory", description: "View and manage employee records", category: "People & HR", icon: "Users", sortOrder: "101" },
  { slug: "people.roles", name: "Roles & Teams", description: "Manage organizational roles and teams", category: "People & HR", icon: "UsersRound", sortOrder: "102" },
  
  // People & HR - Lifecycle
  { slug: "people.onboarding", name: "Onboarding", description: "Manage employee onboarding workflows", category: "People & HR", icon: "UserPlus", sortOrder: "103" },
  { slug: "people.offboarding", name: "Offboarding", description: "Manage employee offboarding workflows", category: "People & HR", icon: "UserMinus", sortOrder: "104" },
  
  // People & HR - Operations
  { slug: "people.timeoff", name: "Time Off", description: "Manage time off requests and leave", category: "People & HR", icon: "Calendar", sortOrder: "105" },
  { slug: "people.documents", name: "Documents", description: "Manage employee documents", category: "People & HR", icon: "FileText", sortOrder: "106" },
  
  // Assets & Equipment
  { slug: "assets.overview", name: "Assets Overview", description: "View assets dashboard", category: "Assets", icon: "LayoutDashboard", sortOrder: "200" },
  { slug: "assets.inventory", name: "Asset Inventory", description: "Manage company assets and equipment", category: "Assets", icon: "Package", sortOrder: "201" },
  { slug: "assets.assignments", name: "Asset Assignments", description: "Assign assets to employees", category: "Assets", icon: "PackageCheck", sortOrder: "202" },
  { slug: "assets.maintenance", name: "Asset Maintenance", description: "Track asset maintenance schedules", category: "Assets", icon: "Wrench", sortOrder: "203" },
  { slug: "assets.disposal", name: "Asset Disposal", description: "Manage asset disposal and retirement", category: "Assets", icon: "Trash2", sortOrder: "204" },
  
  // Security
  { slug: "security.overview", name: "Security Overview", description: "View security dashboard", category: "Security", icon: "Shield", sortOrder: "300" },
  { slug: "security.risks", name: "Risk Register", description: "Manage security risks", category: "Security", icon: "AlertTriangle", sortOrder: "301" },
  { slug: "security.controls", name: "Controls Library", description: "Manage security controls", category: "Security", icon: "CheckSquare", sortOrder: "302" },
  
  // Settings
  { slug: "settings.organization", name: "Organization Settings", description: "Configure organization profile and preferences", category: "Settings", icon: "Building2", sortOrder: "900" },
  { slug: "settings.users", name: "Users & Access", description: "Manage system users and invitations", category: "Settings", icon: "Users", sortOrder: "901" },
  { slug: "settings.roles", name: "Roles & Permissions", description: "Configure custom roles and permissions", category: "Settings", icon: "Shield", sortOrder: "902" },
  { slug: "settings.integrations", name: "Integrations", description: "Configure third-party integrations", category: "Settings", icon: "Plug", sortOrder: "903" },
  { slug: "settings.auditlog", name: "Audit Log", description: "View system activity and audit trail", category: "Settings", icon: "FileText", sortOrder: "904" },
  { slug: "settings.branding", name: "Branding", description: "Customize application appearance", category: "Settings", icon: "Palette", sortOrder: "905" },
  { slug: "settings.apikeys", name: "API Keys", description: "Manage API access tokens", category: "Settings", icon: "Key", sortOrder: "906" },
]

const DEFAULT_ACTIONS = [
  { slug: "view", name: "View", description: "View and list records", sortOrder: "1" },
  { slug: "create", name: "Create", description: "Create new records", sortOrder: "2" },
  { slug: "edit", name: "Edit", description: "Edit existing records", sortOrder: "3" },
  { slug: "delete", name: "Delete", description: "Delete records", sortOrder: "4" },
]

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
      "people.roles": { view: true, create: true, edit: true, delete: true },
      "people.onboarding": { view: true, create: true, edit: true, delete: true },
      "people.offboarding": { view: true, create: true, edit: true, delete: true },
      "people.timeoff": { view: true, create: true, edit: true, delete: true },
      "people.documents": { view: true, create: true, edit: true, delete: true },
      // Assets - Full access
      "assets.overview": { view: true, create: true, edit: true, delete: true },
      "assets.inventory": { view: true, create: true, edit: true, delete: true },
      "assets.assignments": { view: true, create: true, edit: true, delete: true },
      "assets.maintenance": { view: true, create: true, edit: true, delete: true },
      "assets.disposal": { view: true, create: true, edit: true, delete: true },
      // Security - Full access
      "security.overview": { view: true, create: true, edit: true, delete: true },
      "security.risks": { view: true, create: true, edit: true, delete: true },
      "security.controls": { view: true, create: true, edit: true, delete: true },
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
      "people.roles": { view: true, create: false, edit: true, delete: false },
      "people.onboarding": { view: true, create: true, edit: true, delete: false },
      "people.offboarding": { view: true, create: true, edit: true, delete: false },
      "people.timeoff": { view: true, create: true, edit: true, delete: false },
      "people.documents": { view: true, create: true, edit: true, delete: false },
      // Assets - Limited
      "assets.overview": { view: true, create: false, edit: false, delete: false },
      "assets.inventory": { view: true, create: false, edit: true, delete: false },
      "assets.assignments": { view: true, create: true, edit: true, delete: false },
      // Security - View only
      "security.overview": { view: true, create: false, edit: false, delete: false },
      "security.risks": { view: true, create: false, edit: false, delete: false },
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
      "assets.assignments": { view: true, create: false, edit: false, delete: false },
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
    const passwordHash = hashPassword("Admin123!")
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
    const passwordHash = hashPassword("Admin123!")
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

