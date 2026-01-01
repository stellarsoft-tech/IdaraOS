/**
 * RBAC Permission Sync Script
 * 
 * This script ensures that when new modules are added, the Owner role
 * automatically receives all permissions for those modules.
 * 
 * Run this script:
 * - After adding new modules to DEFAULT_MODULES
 * - As part of deployment/migration process
 * - Manually when needed: pnpm db:sync-rbac
 * 
 * This is idempotent and safe to run multiple times.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq, and } from "drizzle-orm"
import * as schema from "../lib/db/schema"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/idaraos",
})

const db = drizzle(pool, { schema })

// ============ Module Registry ============
// All available modules in the system
// When adding new modules, add them here first

export const MODULE_REGISTRY = [
  // People & HR - Overview & Directory
  { slug: "people.overview", name: "People Overview", description: "View People & HR dashboard", category: "People & HR", icon: "LayoutDashboard", sortOrder: "100", actions: ["view"] },
  { slug: "people.directory", name: "People Directory", description: "View and manage employee records", category: "People & HR", icon: "Users", sortOrder: "101", actions: ["view", "create", "edit", "delete"] },
  { slug: "people.teams", name: "Teams", description: "Manage organizational teams", category: "People & HR", icon: "UsersRound", sortOrder: "102", actions: ["view", "create", "edit", "delete"] },
  { slug: "people.roles", name: "Organizational Roles", description: "Manage organizational roles and hierarchy", category: "People & HR", icon: "Building2", sortOrder: "103", actions: ["view", "create", "edit", "delete"] },
  { slug: "people.workflows", name: "People Workflows", description: "View people-related workflows", category: "People & HR", icon: "Workflow", sortOrder: "104", actions: ["view"] },
  
  // People & HR - Lifecycle (deprecated - now handled via workflows)
  { slug: "people.onboarding", name: "Onboarding", description: "Manage employee onboarding workflows", category: "People & HR", icon: "UserPlus", sortOrder: "105", actions: ["view", "create", "edit", "delete"] },
  { slug: "people.offboarding", name: "Offboarding", description: "Manage employee offboarding workflows", category: "People & HR", icon: "UserMinus", sortOrder: "106", actions: ["view", "create", "edit", "delete"] },
  
  // People & HR - Operations
  { slug: "people.timeoff", name: "Time Off", description: "Manage time off requests and leave", category: "People & HR", icon: "Calendar", sortOrder: "107", actions: ["view", "create", "edit", "delete"] },
  { slug: "people.documents", name: "Documents", description: "Manage employee documents", category: "People & HR", icon: "FileText", sortOrder: "108", actions: ["view", "create", "edit", "delete"] },
  { slug: "people.auditlog", name: "People Audit Log", description: "View audit trail for People & HR module", category: "People & HR", icon: "ScrollText", sortOrder: "109", actions: ["view"] },
  
  // Assets & Equipment
  { slug: "assets.overview", name: "Assets Overview", description: "View assets dashboard", category: "Assets", icon: "LayoutDashboard", sortOrder: "200", actions: ["view"] },
  { slug: "assets.inventory", name: "Asset Inventory", description: "Manage company assets and equipment", category: "Assets", icon: "Package", sortOrder: "201", actions: ["view", "create", "edit", "delete"] },
  { slug: "assets.categories", name: "Asset Categories", description: "Manage asset categories and classification", category: "Assets", icon: "FolderTree", sortOrder: "202", actions: ["view", "create", "edit", "delete"] },
  { slug: "assets.assignments", name: "Asset Assignments", description: "Assign assets to employees", category: "Assets", icon: "PackageCheck", sortOrder: "203", actions: ["view", "create", "edit", "delete"] },
  { slug: "assets.maintenance", name: "Asset Maintenance", description: "Track asset maintenance schedules", category: "Assets", icon: "Wrench", sortOrder: "204", actions: ["view", "create", "edit", "delete"] },
  { slug: "assets.lifecycle", name: "Asset Lifecycle", description: "Manage asset lifecycle and disposal", category: "Assets", icon: "RotateCcw", sortOrder: "205", actions: ["view", "create", "edit", "delete"] },
  { slug: "assets.settings", name: "Asset Settings", description: "Configure asset module settings and sync", category: "Assets", icon: "Settings", sortOrder: "206", actions: ["view", "edit"] },
  
  // Security
  { slug: "security.overview", name: "Security Overview", description: "View security dashboard", category: "Security", icon: "Shield", sortOrder: "300", actions: ["view"] },
  { slug: "security.risks", name: "Risk Register", description: "Manage security risks", category: "Security", icon: "AlertTriangle", sortOrder: "301", actions: ["view", "create", "edit", "delete"] },
  { slug: "security.controls", name: "Controls Library", description: "Manage security controls", category: "Security", icon: "CheckSquare", sortOrder: "302", actions: ["view", "create", "edit", "delete"] },
  { slug: "security.evidence", name: "Evidence Store", description: "Manage compliance evidence", category: "Security", icon: "FileText", sortOrder: "303", actions: ["view", "create", "edit", "delete"] },
  { slug: "security.audits", name: "Audits", description: "Manage security audits", category: "Security", icon: "ClipboardList", sortOrder: "304", actions: ["view", "create", "edit", "delete"] },
  { slug: "security.objectives", name: "Objectives", description: "Manage security objectives", category: "Security", icon: "Target", sortOrder: "305", actions: ["view", "create", "edit", "delete"] },
  { slug: "security.frameworks", name: "Frameworks", description: "Manage compliance frameworks", category: "Security", icon: "Shield", sortOrder: "306", actions: ["view", "create", "edit", "delete"] },
  { slug: "security.soa", name: "Statement of Applicability", description: "Manage SoA for frameworks", category: "Security", icon: "FileCheck", sortOrder: "307", actions: ["view", "create", "edit", "delete"] },
  { slug: "security.settings", name: "Security Settings", description: "Configure security module settings", category: "Security", icon: "Settings", sortOrder: "308", actions: ["view", "edit"] },
  { slug: "security.clauses", name: "ISMS Clauses", description: "Manage ISMS clause compliance tracking", category: "Security", icon: "FileCheck2", sortOrder: "309", actions: ["view", "create", "edit", "delete"] },
  
  // Documentation
  { slug: "docs.overview", name: "Docs Overview", description: "View documentation dashboard", category: "Documentation", icon: "FileText", sortOrder: "500", actions: ["view"] },
  { slug: "docs.documents", name: "Document Library", description: "Manage documents and policies", category: "Documentation", icon: "Files", sortOrder: "501", actions: ["view", "create", "edit", "delete", "print", "read_all"] },
  { slug: "docs.rollouts", name: "Document Rollouts", description: "Manage document rollouts", category: "Documentation", icon: "Users", sortOrder: "502", actions: ["view", "create", "edit", "delete"] },
  { slug: "docs.acknowledgments", name: "Acknowledgments", description: "View document acknowledgments", category: "Documentation", icon: "CheckSquare", sortOrder: "503", actions: ["view"] },
  { slug: "docs.settings", name: "Docs Settings", description: "Configure documentation settings", category: "Documentation", icon: "Settings", sortOrder: "504", actions: ["view", "edit"] },
  
  // Workflows
  { slug: "workflows.overview", name: "Workflows Overview", description: "View workflows dashboard", category: "Workflows", icon: "Workflow", sortOrder: "400", actions: ["view"] },
  { slug: "workflows.templates", name: "Workflow Templates", description: "Manage workflow templates", category: "Workflows", icon: "FileCode2", sortOrder: "401", actions: ["view", "create", "edit", "delete"] },
  { slug: "workflows.instances", name: "Workflow Instances", description: "View and manage running workflows", category: "Workflows", icon: "Play", sortOrder: "402", actions: ["view", "create", "edit", "delete"] },
  { slug: "workflows.tasks", name: "Workflow Tasks", description: "View and complete assigned tasks", category: "Workflows", icon: "CheckSquare", sortOrder: "403", actions: ["view", "edit"] },
  { slug: "workflows.board", name: "Workflow Board", description: "Kanban board view of workflows", category: "Workflows", icon: "Kanban", sortOrder: "404", actions: ["view"] },
  { slug: "workflows.settings", name: "Workflow Settings", description: "Configure workflow module settings", category: "Workflows", icon: "Settings", sortOrder: "405", actions: ["view", "edit"] },
  
  // Settings
  { slug: "settings.organization", name: "Organization Settings", description: "Configure organization profile and preferences", category: "Settings", icon: "Building2", sortOrder: "900", actions: ["view", "edit"] },
  { slug: "settings.users", name: "Users & Access", description: "Manage system users and invitations", category: "Settings", icon: "Users", sortOrder: "901", actions: ["view", "create", "edit", "delete"] },
  { slug: "settings.roles", name: "Roles & Permissions", description: "Configure custom roles and permissions", category: "Settings", icon: "Shield", sortOrder: "902", actions: ["view", "create", "edit", "delete"] },
  { slug: "settings.integrations", name: "Integrations", description: "Configure third-party integrations", category: "Settings", icon: "Plug", sortOrder: "903", actions: ["view", "create", "edit", "delete"] },
  { slug: "settings.auditlog", name: "Audit Log", description: "View system activity and audit trail", category: "Settings", icon: "FileText", sortOrder: "904", actions: ["view"] },
  { slug: "settings.branding", name: "Branding", description: "Customize application appearance", category: "Settings", icon: "Palette", sortOrder: "905", actions: ["view", "edit"] },
  { slug: "settings.apikeys", name: "API Keys", description: "Manage API access tokens", category: "Settings", icon: "Key", sortOrder: "906", actions: ["view", "create", "edit", "delete"] },
] as const

export const ACTION_REGISTRY = [
  { slug: "view", name: "View", description: "View and list records", sortOrder: "1" },
  { slug: "write", name: "Write", description: "Create and edit records", sortOrder: "2" },
  { slug: "create", name: "Create", description: "Create new records", sortOrder: "3" },
  { slug: "edit", name: "Edit", description: "Edit existing records", sortOrder: "4" },
  { slug: "delete", name: "Delete", description: "Delete records", sortOrder: "5" },
  { slug: "print", name: "Print", description: "Print or export documents", sortOrder: "6" },
  { slug: "read_all", name: "Read All", description: "View all records regardless of assignment", sortOrder: "7" },
] as const

/**
 * Syncs RBAC permissions for all organizations.
 * 
 * This function:
 * 1. Creates any missing modules from MODULE_REGISTRY
 * 2. Creates any missing actions from ACTION_REGISTRY
 * 3. Creates all permission combinations (module × action)
 * 4. For each org, ensures Owner role has ALL permissions
 * 5. Logs new permissions added
 */
async function syncRBACPermissions() {
  console.log("🔐 Syncing RBAC permissions...")
  console.log(`   Checking ${MODULE_REGISTRY.length} modules and ${ACTION_REGISTRY.length} actions...\n`)

  // Track what's new
  const newModules: string[] = []
  const newActions: string[] = []
  const newPermissions: string[] = []

  // 1. Sync Actions
  console.log("📋 Syncing actions...")
  const actionMap: Record<string, string> = {}
  
  for (const action of ACTION_REGISTRY) {
    const existing = await db.query.actions.findFirst({
      where: eq(schema.actions.slug, action.slug),
    })
    
    if (existing) {
      actionMap[action.slug] = existing.id
    } else {
      const [created] = await db.insert(schema.actions).values({
        slug: action.slug,
        name: action.name,
        description: action.description,
        sortOrder: action.sortOrder,
      }).returning()
      actionMap[action.slug] = created.id
      newActions.push(action.name)
      console.log(`  + Created action: ${action.name}`)
    }
  }

  // 2. Sync Modules
  console.log("\n📦 Syncing modules...")
  const moduleMap: Record<string, string> = {}
  
  for (const mod of MODULE_REGISTRY) {
    const existing = await db.query.modules.findFirst({
      where: eq(schema.modules.slug, mod.slug),
    })
    
    if (existing) {
      moduleMap[mod.slug] = existing.id
    } else {
      const [created] = await db.insert(schema.modules).values({
        slug: mod.slug,
        name: mod.name,
        description: mod.description,
        category: mod.category,
        icon: mod.icon,
        sortOrder: mod.sortOrder,
      }).returning()
      moduleMap[mod.slug] = created.id
      newModules.push(mod.name)
      console.log(`  + Created module: ${mod.name}`)
    }
  }

  // 3. Sync Permissions (only for actions defined per module)
  console.log("\n🔑 Syncing permissions...")
  const permissionMap: Record<string, string> = {} // "module:action" -> permission id
  const validPermissionIds: Set<string> = new Set()
  
  for (const mod of MODULE_REGISTRY) {
    // Only create permissions for the actions defined in this module
    for (const actSlug of mod.actions) {
      const key = `${mod.slug}:${actSlug}`
      
      const existing = await db.query.permissions.findFirst({
        where: and(
          eq(schema.permissions.moduleId, moduleMap[mod.slug]),
          eq(schema.permissions.actionId, actionMap[actSlug])
        ),
      })
      
      if (existing) {
        permissionMap[key] = existing.id
        validPermissionIds.add(existing.id)
      } else {
        const [created] = await db.insert(schema.permissions).values({
          moduleId: moduleMap[mod.slug],
          actionId: actionMap[actSlug],
        }).returning()
        permissionMap[key] = created.id
        validPermissionIds.add(created.id)
        newPermissions.push(key)
      }
    }
  }
  
  if (newPermissions.length > 0) {
    console.log(`  + Created ${newPermissions.length} new permission combinations`)
  } else {
    console.log(`  ✓ All ${Object.keys(permissionMap).length} permissions exist`)
  }

  // 3b. Clean up stale permissions (permissions that no longer match module actions)
  console.log("\n🧹 Cleaning up stale permissions...")
  const allExistingPermissions = await db.query.permissions.findMany()
  const stalePermissionIds = allExistingPermissions
    .filter((p) => !validPermissionIds.has(p.id))
    .map((p) => p.id)

  if (stalePermissionIds.length > 0) {
    // First, remove role_permissions referencing stale permissions
    for (const permId of stalePermissionIds) {
      await db.delete(schema.rolePermissions).where(
        eq(schema.rolePermissions.permissionId, permId)
      )
    }
    // Then delete the stale permissions
    for (const permId of stalePermissionIds) {
      await db.delete(schema.permissions).where(
        eq(schema.permissions.id, permId)
      )
    }
    console.log(`  - Removed ${stalePermissionIds.length} stale permissions`)
  } else {
    console.log(`  ✓ No stale permissions found`)
  }

  // 4. Update Owner role for ALL organizations
  console.log("\n👑 Syncing Owner role permissions across all organizations...")
  
  const orgs = await db.query.organizations.findMany()
  
  for (const org of orgs) {
    // Find Owner role for this org
    const ownerRole = await db.query.roles.findFirst({
      where: and(
        eq(schema.roles.orgId, org.id),
        eq(schema.roles.slug, "owner")
      ),
    })

    if (!ownerRole) {
      // Create Owner role if it doesn't exist
      const [created] = await db.insert(schema.roles).values({
        orgId: org.id,
        slug: "owner",
        name: "Owner",
        description: "Full access to all features and settings. Cannot be modified or deleted.",
        color: "red",
        isSystem: true,
        isDefault: false,
      }).returning()
      console.log(`  + Created Owner role for org: ${org.name}`)
      await assignAllPermissionsToRole(created.id, permissionMap, org.name)
    } else {
      // Check and add missing permissions to Owner role
      await syncOwnerRolePermissions(ownerRole.id, permissionMap, org.name)
    }
  }

  // 5. Summary
  console.log("\n" + "=".repeat(50))
  console.log("✅ RBAC sync complete!")
  
  if (newModules.length > 0 || newActions.length > 0 || newPermissions.length > 0) {
    console.log("\n📊 Changes made:")
    if (newModules.length > 0) {
      console.log(`   • New modules: ${newModules.join(", ")}`)
    }
    if (newActions.length > 0) {
      console.log(`   • New actions: ${newActions.join(", ")}`)
    }
    if (newPermissions.length > 0) {
      console.log(`   • New permissions: ${newPermissions.length} combinations`)
    }
  } else {
    console.log("\n   No changes needed - all permissions up to date.")
  }
}

/**
 * Assigns ALL permissions to a role (used for new Owner roles)
 */
async function assignAllPermissionsToRole(
  roleId: string, 
  permissionMap: Record<string, string>,
  orgName: string
) {
  const rolePermsToInsert = Object.values(permissionMap).map(permissionId => ({
    roleId,
    permissionId,
  }))

  if (rolePermsToInsert.length > 0) {
    await db.insert(schema.rolePermissions).values(rolePermsToInsert)
    console.log(`  → Assigned ${rolePermsToInsert.length} permissions to Owner role (${orgName})`)
  }
}

/**
 * Syncs Owner role permissions - adds any missing permissions
 */
async function syncOwnerRolePermissions(
  roleId: string,
  permissionMap: Record<string, string>,
  orgName: string
) {
  // Get existing role permissions
  const existingPerms = await db.query.rolePermissions.findMany({
    where: eq(schema.rolePermissions.roleId, roleId),
  })
  
  const existingPermIds = new Set(existingPerms.map(p => p.permissionId))
  const allPermIds = Object.values(permissionMap)
  
  // Find missing permissions
  const missingPerms = allPermIds.filter(id => !existingPermIds.has(id))
  
  if (missingPerms.length > 0) {
    const rolePermsToInsert = missingPerms.map(permissionId => ({
      roleId,
      permissionId,
    }))
    
    await db.insert(schema.rolePermissions).values(rolePermsToInsert)
    console.log(`  + Added ${missingPerms.length} missing permissions to Owner role (${orgName})`)
  } else {
    console.log(`  ✓ Owner role has all permissions (${orgName})`)
  }
}

// Run if called directly
if (require.main === module) {
  syncRBACPermissions()
    .catch(console.error)
    .finally(() => pool.end())
}

export { syncRBACPermissions }

