/**
 * RBAC Single Role API
 * GET - Get role details with permissions
 * PUT - Update role
 * DELETE - Delete role (non-system only)
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { roles, rolePermissions, permissions, modules, actions } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { requireOrgId } from "@/lib/api/context"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)

    // Get role
    const role = await db.query.roles.findFirst({
      where: and(
        eq(roles.id, id),
        eq(roles.orgId, orgId)
      ),
    })

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }

    // Get role permissions with details
    const rolePerms = await db
      .select({
        permissionId: rolePermissions.permissionId,
        moduleSlug: modules.slug,
        moduleName: modules.name,
        moduleCategory: modules.category,
        actionSlug: actions.slug,
        actionName: actions.name,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .innerJoin(modules, eq(permissions.moduleId, modules.id))
      .innerJoin(actions, eq(permissions.actionId, actions.id))
      .where(eq(rolePermissions.roleId, id))
      .orderBy(asc(modules.sortOrder), asc(actions.sortOrder))

    return NextResponse.json({
      ...role,
      permissions: rolePerms,
    })
  } catch (error) {
    console.error("Error fetching role:", error)
    return NextResponse.json(
      { error: "Failed to fetch role" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    const body = await request.json()
    const { name, description, color, permissionIds } = body

    // Get existing role
    const role = await db.query.roles.findFirst({
      where: and(
        eq(roles.id, id),
        eq(roles.orgId, orgId)
      ),
    })

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }

    // System roles can only have permissions updated, not name/description
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (!role.isSystem) {
      if (name?.trim()) {
        updateData.name = name.trim()
        updateData.slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      }
      if (description !== undefined) {
        updateData.description = description?.trim() || null
      }
      if (color) {
        updateData.color = color
      }
    }

    // Update role
    const [updatedRole] = await db
      .update(roles)
      .set(updateData)
      .where(eq(roles.id, id))
      .returning()

    // Update permissions if provided (even for system roles)
    if (permissionIds !== undefined && Array.isArray(permissionIds)) {
      // Clear existing permissions
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id))

      // Add new permissions
      if (permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          permissionIds.map((permissionId: string) => ({
            roleId: id,
            permissionId,
          }))
        )
      }
    }

    return NextResponse.json(updatedRole)
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error updating role:", error)
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)

    // Get role
    const role = await db.query.roles.findFirst({
      where: and(
        eq(roles.id, id),
        eq(roles.orgId, orgId)
      ),
    })

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }

    if (role.isSystem) {
      return NextResponse.json(
        { error: "System roles cannot be deleted" },
        { status: 400 }
      )
    }

    // Delete role (cascade will handle role_permissions and user_roles)
    await db.delete(roles).where(eq(roles.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error deleting role:", error)
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    )
  }
}

