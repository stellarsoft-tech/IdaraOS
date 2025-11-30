/**
 * RBAC Roles API
 * GET - List all roles for the organization
 * POST - Create a new custom role
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { roles, rolePermissions, userRoles, organizations } from "@/lib/db/schema"
import { eq, asc, sql } from "drizzle-orm"
import { requireOrgId } from "@/lib/api/context"

export async function GET(request: NextRequest) {
  try {
    // Get orgId from authenticated session
    const orgId = await requireOrgId(request)

    // Get roles with permission and user counts
    const allRoles = await db
      .select({
        id: roles.id,
        slug: roles.slug,
        name: roles.name,
        description: roles.description,
        color: roles.color,
        isSystem: roles.isSystem,
        isDefault: roles.isDefault,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
        permissionCount: sql<number>`(
          SELECT COUNT(*) FROM rbac_role_permissions 
          WHERE role_id = ${roles.id}
        )::int`,
        userCount: sql<number>`(
          SELECT COUNT(*) FROM rbac_user_roles 
          WHERE role_id = ${roles.id}
        )::int`,
      })
      .from(roles)
      .where(eq(roles.orgId, orgId))
      .orderBy(asc(roles.isSystem), asc(roles.name))

    return NextResponse.json(allRoles)
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching roles:", error)
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get orgId from authenticated session
    const orgId = await requireOrgId(request)

    const body = await request.json()
    const { name, description, color, permissionIds } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      )
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    // Check for duplicate slug in this organization
    const existing = await db.query.roles.findFirst({
      where: and(
        eq(roles.slug, slug),
        eq(roles.orgId, orgId)
      ),
    })

    if (existing) {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 400 }
      )
    }

    // Create the role
    const [newRole] = await db
      .insert(roles)
      .values({
        orgId,
        slug,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "gray",
        isSystem: false,
        isDefault: false,
      })
      .returning()

    // If permissions provided, assign them
    if (permissionIds && Array.isArray(permissionIds) && permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permissionId: string) => ({
          roleId: newRole.id,
          permissionId,
        }))
      )
    }

    return NextResponse.json(newRole, { status: 201 })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error creating role:", error)
    return NextResponse.json(
      { error: "Failed to create role" },
      { status: 500 }
    )
  }
}

