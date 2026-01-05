/**
 * RBAC Permissions API
 * GET - List all permissions with their module and action details
 * 
 * SECURITY: Requires authentication. Permissions list is needed by RBAC UI
 * but should not be exposed to unauthenticated users.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { permissions, modules, actions } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"

export async function GET() {
  try {
    // SECURITY: Require authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    const allPermissions = await db
      .select({
        id: permissions.id,
        moduleId: permissions.moduleId,
        actionId: permissions.actionId,
        moduleSlug: modules.slug,
        moduleName: modules.name,
        moduleCategory: modules.category,
        moduleIcon: modules.icon,
        moduleSortOrder: modules.sortOrder,
        actionSlug: actions.slug,
        actionName: actions.name,
        actionSortOrder: actions.sortOrder,
      })
      .from(permissions)
      .innerJoin(modules, eq(permissions.moduleId, modules.id))
      .innerJoin(actions, eq(permissions.actionId, actions.id))
      .orderBy(
        asc(modules.sortOrder),
        asc(modules.name),
        asc(actions.sortOrder)
      )

    return NextResponse.json(allPermissions)
  } catch (error) {
    console.error("Error fetching permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    )
  }
}

