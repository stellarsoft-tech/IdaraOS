/**
 * User Permissions API
 * GET - Get all permissions for the current user (from their roles)
 * 
 * This endpoint is used by the RBAC context to determine what
 * the current user can access.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { 
  userRoles, 
  rolePermissions, 
  permissions, 
  modules, 
  actions
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth/session"

export async function GET(request: NextRequest) {
  try {
    // Get current user from session
    const sessionUser = await getSessionUser()
    
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user's roles
    const userRolesList = await db
      .select({
        roleId: userRoles.roleId,
      })
      .from(userRoles)
      .where(eq(userRoles.userId, sessionUser.id))

    const roleIds = userRolesList.map(ur => ur.roleId)

    if (roleIds.length === 0) {
      // User has no roles assigned
      return NextResponse.json({
        roles: [],
        permissions: [],
        permissionMap: {},
      })
    }

    // For multiple roles, we need to get all permissions
    // Build permission map: { "module.slug": { "action": true } }
    const permissionMap: Record<string, Record<string, boolean>> = {}
    
    for (const roleId of roleIds) {
      const perms = await db
        .select({
          moduleSlug: modules.slug,
          actionSlug: actions.slug,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .innerJoin(modules, eq(permissions.moduleId, modules.id))
        .innerJoin(actions, eq(permissions.actionId, actions.id))
        .where(eq(rolePermissions.roleId, roleId))

      for (const perm of perms) {
        if (!permissionMap[perm.moduleSlug]) {
          permissionMap[perm.moduleSlug] = {}
        }
        permissionMap[perm.moduleSlug][perm.actionSlug] = true
      }
    }

    return NextResponse.json({
      roleIds,
      permissionMap,
    })
  } catch (error) {
    console.error("Error fetching user permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch user permissions" },
      { status: 500 }
    )
  }
}

