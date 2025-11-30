/**
 * RBAC Permissions API
 * GET - List all permissions with their module and action details
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { permissions, modules, actions } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"

export async function GET() {
  try {
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

