/**
 * Organizational Role Detail API Routes
 * GET /api/people/roles/[id] - Get role by ID
 * PUT /api/people/roles/[id] - Update role
 * DELETE /api/people/roles/[id] - Delete role
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizationalRoles, persons, teams } from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
import { z } from "zod"

// Update role schema
const UpdateRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  description: z.string().max(500, "Description too long").nullable().optional(),
  teamId: z.string().uuid().optional(),
  parentRoleId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
})

// Parent role info type
interface ParentRoleInfo {
  id: string
  name: string
  level: number
}

// Team info type
interface TeamInfo {
  id: string
  name: string
}

// Transform DB record to API response
function toApiResponse(
  record: typeof organizationalRoles.$inferSelect,
  parentRole?: ParentRoleInfo | null,
  team?: TeamInfo | null,
  holderCount?: number,
  childCount?: number
) {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    teamId: record.teamId,
    team: team || null,
    parentRoleId: record.parentRoleId,
    parentRole: parentRole || null,
    level: record.level,
    sortOrder: record.sortOrder,
    positionX: record.positionX,
    positionY: record.positionY,
    holderCount: holderCount ?? 0,
    childCount: childCount ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/people/roles/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    
    // Fetch the role
    const [role] = await db
      .select()
      .from(organizationalRoles)
      .where(
        and(
          eq(organizationalRoles.id, id),
          eq(organizationalRoles.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }
    
    // Get parent role info
    let parentRole: ParentRoleInfo | null = null
    if (role.parentRoleId) {
      const [parentResult] = await db
        .select({
          id: organizationalRoles.id,
          name: organizationalRoles.name,
          level: organizationalRoles.level,
        })
        .from(organizationalRoles)
        .where(eq(organizationalRoles.id, role.parentRoleId))
        .limit(1)
      
      parentRole = parentResult || null
    }
    
    // Get team info
    let team: TeamInfo | null = null
    const [teamResult] = await db
      .select({
        id: teams.id,
        name: teams.name,
      })
      .from(teams)
      .where(eq(teams.id, role.teamId))
      .limit(1)
    
    team = teamResult || null
    
    // Get holder count - match by role name until we have roleId FK
    const [holderCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(persons)
      .where(
        and(
          eq(persons.orgId, orgId),
          eq(persons.roleId, role.id)
        )
      )
    const holderCount = holderCountResult?.count ?? 0
    
    // Get child count
    const [childCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationalRoles)
      .where(
        and(
          eq(organizationalRoles.orgId, orgId),
          eq(organizationalRoles.parentRoleId, role.id)
        )
      )
    const childCount = childCountResult?.count ?? 0
    
    return NextResponse.json(toApiResponse(role, parentRole, team, holderCount, childCount))
  } catch (error) {
    console.error("[Roles API] Error fetching role:", error)
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Failed to fetch role" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/people/roles/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    const session = await requireSession()
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = UpdateRoleSchema.parse(body)
    
    // Fetch existing role
    const [existing] = await db
      .select()
      .from(organizationalRoles)
      .where(
        and(
          eq(organizationalRoles.id, id),
          eq(organizationalRoles.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }
    
    // Check for circular parent reference
    if (data.parentRoleId && data.parentRoleId === id) {
      return NextResponse.json(
        { error: "A role cannot be its own parent" },
        { status: 400 }
      )
    }
    
    // Check for duplicate name if changing
    if (data.name && data.name !== existing.name) {
      const duplicate = await db
        .select({ id: organizationalRoles.id })
        .from(organizationalRoles)
        .where(
          and(
            eq(organizationalRoles.orgId, orgId),
            eq(organizationalRoles.name, data.name)
          )
        )
        .limit(1)
      
      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: "A role with this name already exists" },
          { status: 409 }
        )
      }
    }
    
    // Validate team if changing
    if (data.teamId && data.teamId !== existing.teamId) {
      const [teamExists] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, data.teamId), eq(teams.orgId, orgId)))
        .limit(1)
      
      if (!teamExists) {
        return NextResponse.json(
          { error: "Team not found or does not belong to this organization" },
          { status: 400 }
        )
      }
    }
    
    // Build update data
    const updateData: Partial<typeof organizationalRoles.$inferInsert> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) {
      updateData.name = data.name
    }
    if (data.description !== undefined) {
      updateData.description = data.description
    }
    if (data.teamId !== undefined) {
      updateData.teamId = data.teamId
    }
    if (data.parentRoleId !== undefined) {
      updateData.parentRoleId = data.parentRoleId
    }
    if (data.level !== undefined) {
      updateData.level = data.level
    }
    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder
    }
    if (data.positionX !== undefined) {
      updateData.positionX = data.positionX
    }
    if (data.positionY !== undefined) {
      updateData.positionY = data.positionY
    }
    
    // Update the role
    const [record] = await db
      .update(organizationalRoles)
      .set(updateData)
      .where(eq(organizationalRoles.id, id))
      .returning()
    
    // Build changes for audit log
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    if (data.name !== undefined && data.name !== existing.name) {
      changes.name = { old: existing.name, new: data.name }
    }
    if (data.description !== undefined && data.description !== existing.description) {
      changes.description = { old: existing.description, new: data.description }
    }
    if (data.teamId !== undefined && data.teamId !== existing.teamId) {
      changes.teamId = { old: existing.teamId, new: data.teamId }
    }
    if (data.parentRoleId !== undefined && data.parentRoleId !== existing.parentRoleId) {
      changes.parentRoleId = { old: existing.parentRoleId, new: data.parentRoleId }
    }
    if (data.level !== undefined && data.level !== existing.level) {
      changes.level = { old: existing.level, new: data.level }
    }
    
    // Audit log the update
    if (Object.keys(changes).length > 0 && auditLog) {
      await auditLog.logUpdate(
        "people.roles",
        "organizational_role",
        record.id,
        record.name,
        existing,
        record
      )
    }
    
    // Get parent role info
    let parentRole: ParentRoleInfo | null = null
    if (record.parentRoleId) {
      const [parentResult] = await db
        .select({
          id: organizationalRoles.id,
          name: organizationalRoles.name,
          level: organizationalRoles.level,
        })
        .from(organizationalRoles)
        .where(eq(organizationalRoles.id, record.parentRoleId))
        .limit(1)
      
      parentRole = parentResult || null
    }
    
    // Get team info
    let team: TeamInfo | null = null
    const [teamResult] = await db
      .select({
        id: teams.id,
        name: teams.name,
      })
      .from(teams)
      .where(eq(teams.id, record.teamId))
      .limit(1)
    
    team = teamResult || null
    
    return NextResponse.json(toApiResponse(record, parentRole, team))
  } catch (error) {
    console.error("[Roles API] Error updating role:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/people/roles/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    const session = await requireSession()
    const auditLog = await getAuditLogger()
    
    // Fetch existing role
    const [existing] = await db
      .select()
      .from(organizationalRoles)
      .where(
        and(
          eq(organizationalRoles.id, id),
          eq(organizationalRoles.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }
    
    // Check if role has children
    const [childCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationalRoles)
      .where(eq(organizationalRoles.parentRoleId, id))
    
    if (childCount && childCount.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete role with sub-roles. Delete or reassign sub-roles first." },
        { status: 400 }
      )
    }
    
    // Delete the role
    await db.delete(organizationalRoles).where(eq(organizationalRoles.id, id))
    
    // Audit log the deletion
    if (auditLog) {
      await auditLog.logDelete("people.roles", "organizational_role", {
        id: existing.id,
        name: existing.name,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Roles API] Error deleting role:", error)
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    )
  }
}

