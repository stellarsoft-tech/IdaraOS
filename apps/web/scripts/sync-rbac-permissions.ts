/**
 * RBAC Permission Sync Script
 * 
 * This script ensures that when new modules are added, the Owner role
 * automatically receives all permissions for those modules.
 * 
 * Run this script:
 * - After adding new modules to MODULE_REGISTRY
 * - As part of deployment/migration process
 * - Manually when needed: pnpm db:sync-rbac
 * 
 * This is idempotent and safe to run multiple times.
 * 
 * IMPORTANT: Module and action slugs are defined in lib/rbac/resources.ts
 * which is the single source of truth. This script uses those constants.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq, and } from "drizzle-orm"
import * as schema from "../lib/db/schema"
import { MODULES, ACTIONS, type ModuleSlug, type ActionSlug } from "../lib/rbac/resources"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/idaraos",
})

const db = drizzle(pool, { schema })

// ============ Module Registry ============
// All available modules in the system
// When adding new modules, add them to lib/rbac/resources.ts FIRST,
// then add the entry here using the MODULES.* constant.

type ModuleRegistryEntry = {
  slug: ModuleSlug
  name: string
  description: string
  category: string
  icon: string
  sortOrder: string
  actions: readonly ActionSlug[]
}

export const MODULE_REGISTRY: readonly ModuleRegistryEntry[] = [
  // People & HR
  { slug: MODULES.PEOPLE_OVERVIEW, name: "Overview", description: "View People & HR dashboard", category: "People & HR", icon: "LayoutDashboard", sortOrder: "100", actions: [ACTIONS.VIEW] },
  { slug: MODULES.PEOPLE_DIRECTORY, name: "Directory", description: "View and manage employee records", category: "People & HR", icon: "Users", sortOrder: "101", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.PEOPLE_TEAMS, name: "Teams", description: "Manage organizational teams", category: "People & HR", icon: "UsersRound", sortOrder: "102", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.PEOPLE_ROLES, name: "Roles", description: "Manage organizational roles and hierarchy", category: "People & HR", icon: "Building2", sortOrder: "103", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.PEOPLE_WORKFLOWS, name: "Workflows", description: "View people-related workflows", category: "People & HR", icon: "Workflow", sortOrder: "104", actions: [ACTIONS.VIEW] },
  { slug: MODULES.PEOPLE_SETTINGS, name: "Settings", description: "Configure People & HR module settings", category: "People & HR", icon: "Settings", sortOrder: "105", actions: [ACTIONS.VIEW, ACTIONS.EDIT] },
  { slug: MODULES.PEOPLE_AUDITLOG, name: "Audit Log", description: "View audit trail for People & HR module", category: "People & HR", icon: "ScrollText", sortOrder: "106", actions: [ACTIONS.VIEW] },
  
  // Assets
  { slug: MODULES.ASSETS_OVERVIEW, name: "Overview", description: "View assets dashboard", category: "Assets", icon: "LayoutDashboard", sortOrder: "200", actions: [ACTIONS.VIEW] },
  { slug: MODULES.ASSETS_INVENTORY, name: "Inventory", description: "Manage company assets and equipment", category: "Assets", icon: "Package", sortOrder: "201", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.ASSETS_CATEGORIES, name: "Categories", description: "Manage asset categories and classification", category: "Assets", icon: "FolderTree", sortOrder: "202", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.ASSETS_ASSIGNMENTS, name: "Assignments", description: "Assign assets to employees", category: "Assets", icon: "PackageCheck", sortOrder: "203", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.ASSETS_MAINTENANCE, name: "Maintenance", description: "Track asset maintenance schedules", category: "Assets", icon: "Wrench", sortOrder: "204", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.ASSETS_LIFECYCLE, name: "Lifecycle", description: "Manage asset lifecycle and disposal", category: "Assets", icon: "RotateCcw", sortOrder: "205", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.ASSETS_SETTINGS, name: "Settings", description: "Configure asset module settings and sync", category: "Assets", icon: "Settings", sortOrder: "206", actions: [ACTIONS.VIEW, ACTIONS.EDIT] },
  { slug: MODULES.ASSETS_AUDITLOG, name: "Audit Log", description: "View audit trail for Assets module", category: "Assets", icon: "ScrollText", sortOrder: "207", actions: [ACTIONS.VIEW] },
  
  // Security
  { slug: MODULES.SECURITY_OVERVIEW, name: "Overview", description: "View security dashboard", category: "Security", icon: "Shield", sortOrder: "300", actions: [ACTIONS.VIEW] },
  { slug: MODULES.SECURITY_RISKS, name: "Risk Register", description: "Manage security risks", category: "Security", icon: "AlertTriangle", sortOrder: "301", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_CONTROLS, name: "Controls Library", description: "Manage security controls", category: "Security", icon: "CheckSquare", sortOrder: "302", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_EVIDENCE, name: "Evidence Store", description: "Manage compliance evidence", category: "Security", icon: "FileText", sortOrder: "303", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_AUDITS, name: "Audits", description: "Manage security audits", category: "Security", icon: "ClipboardList", sortOrder: "304", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_OBJECTIVES, name: "Objectives", description: "Manage security objectives", category: "Security", icon: "Target", sortOrder: "305", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_FRAMEWORKS, name: "Frameworks", description: "Manage compliance frameworks", category: "Security", icon: "Shield", sortOrder: "306", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_SOA, name: "Statement of Applicability", description: "Manage SoA for frameworks", category: "Security", icon: "FileCheck", sortOrder: "307", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_CLAUSES, name: "ISMS Clauses", description: "Manage ISMS clause compliance tracking", category: "Security", icon: "FileCheck2", sortOrder: "308", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SECURITY_AUDITLOG, name: "Audit Log", description: "View audit trail for Security module", category: "Security", icon: "ScrollText", sortOrder: "309", actions: [ACTIONS.VIEW] },
  
  // Documentation
  { slug: MODULES.DOCS_OVERVIEW, name: "Overview", description: "View documentation dashboard", category: "Documentation", icon: "FileText", sortOrder: "500", actions: [ACTIONS.VIEW] },
  { slug: MODULES.DOCS_DOCUMENTS, name: "Document Library", description: "Manage documents and policies", category: "Documentation", icon: "Files", sortOrder: "501", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE, ACTIONS.PRINT, ACTIONS.READ_ALL] },
  { slug: MODULES.DOCS_ROLLOUTS, name: "Rollouts", description: "Manage document rollouts", category: "Documentation", icon: "Users", sortOrder: "502", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.DOCS_ACKNOWLEDGMENTS, name: "Acknowledgments", description: "View document acknowledgments", category: "Documentation", icon: "CheckSquare", sortOrder: "503", actions: [ACTIONS.VIEW] },
  { slug: MODULES.DOCS_SETTINGS, name: "Settings", description: "Configure documentation settings", category: "Documentation", icon: "Settings", sortOrder: "504", actions: [ACTIONS.VIEW, ACTIONS.EDIT] },
  { slug: MODULES.DOCS_AUDITLOG, name: "Audit Log", description: "View audit trail for Documentation module", category: "Documentation", icon: "ScrollText", sortOrder: "505", actions: [ACTIONS.VIEW] },
  
  // Workflows
  { slug: MODULES.WORKFLOWS_OVERVIEW, name: "Overview", description: "View workflows dashboard", category: "Workflows", icon: "Workflow", sortOrder: "400", actions: [ACTIONS.VIEW] },
  { slug: MODULES.WORKFLOWS_TEMPLATES, name: "Templates", description: "Manage workflow templates", category: "Workflows", icon: "FileCode2", sortOrder: "401", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.WORKFLOWS_INSTANCES, name: "Active Workflows", description: "View and manage running workflows", category: "Workflows", icon: "Play", sortOrder: "402", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.WORKFLOWS_TASKS, name: "My Tasks", description: "View and complete assigned tasks", category: "Workflows", icon: "CheckSquare", sortOrder: "403", actions: [ACTIONS.VIEW, ACTIONS.EDIT] },
  { slug: MODULES.WORKFLOWS_BOARD, name: "Board View", description: "Kanban board view of workflows", category: "Workflows", icon: "Kanban", sortOrder: "404", actions: [ACTIONS.VIEW] },
  { slug: MODULES.WORKFLOWS_SETTINGS, name: "Settings", description: "Configure workflow module settings", category: "Workflows", icon: "Settings", sortOrder: "405", actions: [ACTIONS.VIEW, ACTIONS.EDIT] },
  { slug: MODULES.WORKFLOWS_AUDITLOG, name: "Audit Log", description: "View audit trail for Workflows module", category: "Workflows", icon: "ScrollText", sortOrder: "406", actions: [ACTIONS.VIEW] },
  
  // Filing
  { slug: MODULES.FILING_OVERVIEW, name: "Overview", description: "View filing dashboard and storage stats", category: "Filing", icon: "FolderArchive", sortOrder: "450", actions: [ACTIONS.VIEW] },
  { slug: MODULES.FILING_FILES, name: "Files", description: "Browse and manage all files", category: "Filing", icon: "Files", sortOrder: "451", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.FILING_CATEGORIES, name: "Categories", description: "Manage file categories and storage configuration", category: "Filing", icon: "FolderTree", sortOrder: "452", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.FILING_AUDITLOG, name: "Audit Log", description: "View audit trail for Filing module", category: "Filing", icon: "ScrollText", sortOrder: "453", actions: [ACTIONS.VIEW] },
  
  // Settings
  { slug: MODULES.SETTINGS_ORGANIZATION, name: "Organization", description: "Configure organization profile and preferences", category: "Settings", icon: "Building2", sortOrder: "900", actions: [ACTIONS.VIEW, ACTIONS.EDIT] },
  { slug: MODULES.SETTINGS_USERS, name: "Users & Access", description: "Manage system users and invitations", category: "Settings", icon: "Users", sortOrder: "901", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SETTINGS_ROLES, name: "Roles & Permissions", description: "Configure custom roles and permissions", category: "Settings", icon: "Shield", sortOrder: "902", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SETTINGS_INTEGRATIONS, name: "Integrations", description: "Configure third-party integrations", category: "Settings", icon: "Plug", sortOrder: "903", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
  { slug: MODULES.SETTINGS_AUDITLOG, name: "Audit Log", description: "View system activity and audit trail", category: "Settings", icon: "FileText", sortOrder: "904", actions: [ACTIONS.VIEW] },
  { slug: MODULES.SETTINGS_BRANDING, name: "Branding", description: "Customize application appearance", category: "Settings", icon: "Palette", sortOrder: "905", actions: [ACTIONS.VIEW, ACTIONS.EDIT] },
  { slug: MODULES.SETTINGS_APIKEYS, name: "API Keys", description: "Manage API access tokens", category: "Settings", icon: "Key", sortOrder: "906", actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE] },
]

type ActionRegistryEntry = {
  slug: ActionSlug | "write" // Keep "write" for legacy support
  name: string
  description: string
  sortOrder: string
}

export const ACTION_REGISTRY: readonly ActionRegistryEntry[] = [
  { slug: ACTIONS.VIEW, name: "View", description: "View and list records", sortOrder: "1" },
  { slug: "write", name: "Write", description: "Create and edit records (legacy)", sortOrder: "2" },
  { slug: ACTIONS.CREATE, name: "Create", description: "Create new records", sortOrder: "3" },
  { slug: ACTIONS.EDIT, name: "Edit", description: "Edit existing records", sortOrder: "4" },
  { slug: ACTIONS.DELETE, name: "Delete", description: "Delete records", sortOrder: "5" },
  { slug: ACTIONS.PRINT, name: "Print", description: "Print or export documents", sortOrder: "6" },
  { slug: ACTIONS.READ_ALL, name: "Read All", description: "View all records regardless of assignment", sortOrder: "7" },
]

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

  // 2. Sync Modules (create or update)
  console.log("\n📦 Syncing modules...")
  const moduleMap: Record<string, string> = {}
  const updatedModules: string[] = []
  
  for (const mod of MODULE_REGISTRY) {
    const existing = await db.query.modules.findFirst({
      where: eq(schema.modules.slug, mod.slug),
    })
    
    if (existing) {
      moduleMap[mod.slug] = existing.id
      // Update if name, description, or other properties changed
      if (existing.name !== mod.name || existing.description !== mod.description || 
          existing.category !== mod.category || existing.icon !== mod.icon || 
          existing.sortOrder !== mod.sortOrder) {
        await db.update(schema.modules)
          .set({
            name: mod.name,
            description: mod.description,
            category: mod.category,
            icon: mod.icon,
            sortOrder: mod.sortOrder,
          })
          .where(eq(schema.modules.id, existing.id))
        updatedModules.push(mod.name)
        console.log(`  ~ Updated module: ${mod.name}`)
      }
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

  // 3c. Clean up obsolete modules (modules no longer in registry)
  console.log("\n🧹 Cleaning up obsolete modules...")
  const registrySlugs = new Set<string>(MODULE_REGISTRY.map((m) => m.slug))
  const allExistingModules = await db.query.modules.findMany()
  const obsoleteModules = allExistingModules.filter((m) => !registrySlugs.has(m.slug))

  if (obsoleteModules.length > 0) {
    for (const mod of obsoleteModules) {
      // Delete any remaining permissions for this module (should be empty after 3b)
      await db.delete(schema.permissions).where(
        eq(schema.permissions.moduleId, mod.id)
      )
      // Delete the module
      await db.delete(schema.modules).where(
        eq(schema.modules.id, mod.id)
      )
      console.log(`  - Removed obsolete module: ${mod.name} (${mod.slug})`)
    }
  } else {
    console.log(`  ✓ No obsolete modules found`)
  }

  // 4. Update Owner role for ALL organizations
  console.log("\n👑 Syncing Owner role permissions across all organizations...")
  
  // Only select the columns we need to avoid schema mismatch issues during migrations
  const orgs = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
  
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
  
  if (newModules.length > 0 || updatedModules.length > 0 || newActions.length > 0 || newPermissions.length > 0) {
    console.log("\n📊 Changes made:")
    if (newModules.length > 0) {
      console.log(`   • New modules: ${newModules.join(", ")}`)
    }
    if (updatedModules.length > 0) {
      console.log(`   • Updated modules: ${updatedModules.join(", ")}`)
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

