/**
 * RBAC Roles API
 * GET - List all roles for the organization
 * POST - Create a new custom role
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { roles, rolePermissions, userRoles, organizations } from "@/lib/db/schema"
import { eq, asc, sql } from "drizzle-orm"

// Demo org ID - in production, get from session
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

async function ensureOrgExists() {
  const existingOrg = await db.query.organizations.findFirst({
    where: eq(organizations.id, DEMO_ORG_ID),
  })

  if (!existingOrg) {
    await db.insert(organizations).values({
      id: DEMO_ORG_ID,
      name: "Demo Organization",
      slug: "demo-org",
    })
  }
}

export async function GET() {
  try {
    await ensureOrgExists()

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
      .where(eq(roles.orgId, DEMO_ORG_ID))
      .orderBy(asc(roles.isSystem), asc(roles.name))

    return NextResponse.json(allRoles)
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureOrgExists()

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

    // Check for duplicate slug
    const existing = await db.query.roles.findFirst({
      where: eq(roles.slug, slug),
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
        orgId: DEMO_ORG_ID,
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
    console.error("Error creating role:", error)
    return NextResponse.json(
      { error: "Failed to create role" },
      { status: 500 }
    )
  }
}

