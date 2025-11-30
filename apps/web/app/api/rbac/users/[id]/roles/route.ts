/**
 * User Roles API
 * GET - Get roles assigned to a user
 * PUT - Update user's role assignments
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userRoles, roles, users } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth/session"

// Demo org ID - in production, get from session
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Get user's roles
    const userRolesList = await db
      .select({
        roleId: roles.id,
        roleSlug: roles.slug,
        roleName: roles.name,
        roleColor: roles.color,
        roleDescription: roles.description,
        isSystem: roles.isSystem,
        assignedAt: userRoles.assignedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, id))
      .orderBy(asc(roles.name))

    return NextResponse.json(userRolesList)
  } catch (error) {
    console.error("Error fetching user roles:", error)
    return NextResponse.json(
      { error: "Failed to fetch user roles" },
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
    const body = await request.json()
    const { roleIds } = body

    if (!Array.isArray(roleIds)) {
      return NextResponse.json(
        { error: "roleIds must be an array" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Get current user for audit
    const currentUser = await getSessionUser()

    // Validate that all role IDs exist and belong to the org
    if (roleIds.length > 0) {
      for (const roleId of roleIds) {
        const role = await db.query.roles.findFirst({
          where: and(
            eq(roles.id, roleId),
            eq(roles.orgId, DEMO_ORG_ID)
          ),
        })
        if (!role) {
          return NextResponse.json(
            { error: `Role ${roleId} not found` },
            { status: 400 }
          )
        }
      }
    }

    // Clear existing role assignments
    await db.delete(userRoles).where(eq(userRoles.userId, id))

    // Assign new roles
    if (roleIds.length > 0) {
      await db.insert(userRoles).values(
        roleIds.map((roleId: string) => ({
          userId: id,
          roleId,
          assignedBy: currentUser?.id || null,
        }))
      )
    }

    // Return updated roles
    const updatedRoles = await db
      .select({
        roleId: roles.id,
        roleSlug: roles.slug,
        roleName: roles.name,
        roleColor: roles.color,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, id))

    return NextResponse.json(updatedRoles)
  } catch (error) {
    console.error("Error updating user roles:", error)
    return NextResponse.json(
      { error: "Failed to update user roles" },
      { status: 500 }
    )
  }
}

