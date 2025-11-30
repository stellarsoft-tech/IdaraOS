/**
 * User Roles API
 * GET - Get roles assigned to a user
 * PUT - Update user's role assignments
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userRoles, roles, users, integrations } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth/session"
import { requireOrgId } from "@/lib/api/context"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)

    // Check if user exists in this organization
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, id),
        eq(users.orgId, orgId)
      ),
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
        source: userRoles.source,
        scimGroupId: userRoles.scimGroupId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, id))
      .orderBy(asc(roles.name))

    return NextResponse.json(userRolesList)
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
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
    const orgId = await requireOrgId(request)
    const body = await request.json()
    const { roleIds } = body

    if (!Array.isArray(roleIds)) {
      return NextResponse.json(
        { error: "roleIds must be an array" },
        { status: 400 }
      )
    }

    // Check if user exists in this organization
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, id),
        eq(users.orgId, orgId)
      ),
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Get current user for audit
    const currentUser = await getSessionUser()

    // Check if user has SCIM-assigned roles
    const existingRoles = await db
      .select({
        roleId: userRoles.roleId,
        source: userRoles.source,
        scimGroupId: userRoles.scimGroupId,
      })
      .from(userRoles)
      .where(eq(userRoles.userId, id))

    const scimAssignedRoles = existingRoles.filter(r => r.source === "scim")
    
    // Check if bidirectional sync is enabled (only if there are SCIM roles to consider)
    let bidirectionalSyncEnabled = false
    if (scimAssignedRoles.length > 0) {
      const entraConfig = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.orgId, orgId),
          eq(integrations.provider, "entra")
        ),
      })
      bidirectionalSyncEnabled = entraConfig?.scimBidirectionalSync || false
    }

    // If there are SCIM-assigned roles and bidirectional sync is disabled,
    // we should only modify manual roles
    if (scimAssignedRoles.length > 0 && !bidirectionalSyncEnabled) {
      // Preserve SCIM-assigned role IDs
      const scimRoleIds = scimAssignedRoles.map(r => r.roleId)
      
      // Check if user is trying to modify SCIM-assigned roles
      const newRoleIdSet = new Set(roleIds)
      const removingScimRoles = scimRoleIds.some(id => !newRoleIdSet.has(id))
      
      if (removingScimRoles) {
        return NextResponse.json(
          { error: "Cannot modify SCIM-assigned roles when bidirectional sync is disabled" },
          { status: 403 }
        )
      }
    }

    // Validate that all role IDs exist and belong to the org
    if (roleIds.length > 0) {
      for (const roleId of roleIds) {
        const role = await db.query.roles.findFirst({
          where: and(
            eq(roles.id, roleId),
            eq(roles.orgId, orgId)
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

    // Clear only manual role assignments (preserve SCIM-assigned roles)
    await db.delete(userRoles).where(
      and(
        eq(userRoles.userId, id),
        eq(userRoles.source, "manual")
      )
    )

    // Determine which roles to add as manual (exclude SCIM-assigned)
    const scimRoleIdSet = new Set(scimAssignedRoles.map(r => r.roleId))
    const manualRoleIds = roleIds.filter((roleId: string) => !scimRoleIdSet.has(roleId))

    // Assign new manual roles
    if (manualRoleIds.length > 0) {
      await db.insert(userRoles).values(
        manualRoleIds.map((roleId: string) => ({
          userId: id,
          roleId,
          assignedBy: currentUser?.id || null,
          source: "manual" as const,
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
        source: userRoles.source,
        scimGroupId: userRoles.scimGroupId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, id))

    return NextResponse.json(updatedRoles)
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error updating user roles:", error)
    return NextResponse.json(
      { error: "Failed to update user roles" },
      { status: 500 }
    )
  }
}

