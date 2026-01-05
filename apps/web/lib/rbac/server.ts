/**
 * Server-Side RBAC Permission Checker
 * 
 * This module provides database-driven permission checking for API routes.
 * It queries the RBAC tables to verify if a user has a specific permission
 * through their assigned roles.
 * 
 * The permission chain is:
 * User -> UserRoles -> Roles -> RolePermissions -> Permissions -> (Module + Action)
 */

import { db } from "@/lib/db"
import { 
  userRoles, 
  rolePermissions, 
  permissions, 
  modules, 
  actions 
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * Check if a user has a specific permission (database query)
 * 
 * Uses JOINs across the RBAC tables to verify the permission chain:
 * userRoles -> rolePermissions -> permissions -> modules/actions
 * 
 * @param userId - The user's ID
 * @param moduleSlug - The module slug (e.g., "people.person", "assets.inventory")
 * @param actionSlug - The action slug (e.g., "view", "create", "edit", "delete")
 * @returns true if the user has the permission, false otherwise
 * 
 * @example
 * const canEditPerson = await checkUserPermission(userId, "people.person", "edit")
 */
export async function checkUserPermission(
  userId: string,
  moduleSlug: string,
  actionSlug: string
): Promise<boolean> {
  const result = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .innerJoin(modules, eq(permissions.moduleId, modules.id))
    .innerJoin(actions, eq(permissions.actionId, actions.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(modules.slug, moduleSlug),
        eq(actions.slug, actionSlug)
      )
    )
    .limit(1)

  return result.length > 0
}

/**
 * Get all permissions for a user as a permission map
 * 
 * Returns a map of { moduleSlug: { actionSlug: true } } for all permissions
 * the user has through their roles.
 * 
 * @param userId - The user's ID
 * @returns Permission map object
 * 
 * @example
 * const permMap = await getUserPermissionMap(userId)
 * // { "people.person": { "view": true, "edit": true }, ... }
 */
export async function getUserPermissionMap(
  userId: string
): Promise<Record<string, Record<string, boolean>>> {
  const perms = await db
    .select({
      moduleSlug: modules.slug,
      actionSlug: actions.slug,
    })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .innerJoin(modules, eq(permissions.moduleId, modules.id))
    .innerJoin(actions, eq(permissions.actionId, actions.id))
    .where(eq(userRoles.userId, userId))

  const permissionMap: Record<string, Record<string, boolean>> = {}
  
  for (const perm of perms) {
    if (!permissionMap[perm.moduleSlug]) {
      permissionMap[perm.moduleSlug] = {}
    }
    permissionMap[perm.moduleSlug][perm.actionSlug] = true
  }

  return permissionMap
}

/**
 * Check if a user has any of the specified permissions
 * 
 * @param userId - The user's ID
 * @param moduleSlug - The module slug
 * @param actionSlugs - Array of action slugs to check
 * @returns true if the user has at least one of the permissions
 */
export async function checkUserHasAnyPermission(
  userId: string,
  moduleSlug: string,
  actionSlugs: string[]
): Promise<boolean> {
  for (const actionSlug of actionSlugs) {
    if (await checkUserPermission(userId, moduleSlug, actionSlug)) {
      return true
    }
  }
  return false
}

/**
 * Check if a user has all of the specified permissions
 * 
 * @param userId - The user's ID
 * @param moduleSlug - The module slug
 * @param actionSlugs - Array of action slugs to check
 * @returns true if the user has all of the permissions
 */
export async function checkUserHasAllPermissions(
  userId: string,
  moduleSlug: string,
  actionSlugs: string[]
): Promise<boolean> {
  for (const actionSlug of actionSlugs) {
    if (!(await checkUserPermission(userId, moduleSlug, actionSlug))) {
      return false
    }
  }
  return true
}
