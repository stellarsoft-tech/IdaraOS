/**
 * Organizational Role Detail API Routes
 * GET /api/people/roles/[id] - Get role by ID
 * PUT /api/people/roles/[id] - Update role
 * DELETE /api/people/roles/[id] - Delete role
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, sql, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizationalRoles, organizationalRoleTeams, persons, teams } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Update role schema
const UpdateRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  description: z.string().max(500, "Description too long").nullable().optional(),
  teamId: z.string().uuid().optional(), // Deprecated, use teamIds
  teamIds: z.array(z.string().uuid()).optional(), // All team IDs - replaces existing teams
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
  allTeams?: TeamInfo[],
  holderCount?: number,
  childCount?: number
) {
  // Build teamIds array
  const teamIds = allTeams?.map(t => t.id) ?? (team ? [team.id] : [record.teamId])
  
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    teamId: record.teamId, // Primary team for backwards compatibility
    team: team || null,
    teamIds, // All team IDs
    teams: allTeams ?? (team ? [team] : []), // All teams info
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
    // Authorization check
    const session = await requirePermission(...P.people.roles.view())
    const orgId = session.orgId
    
    const { id } = await params
    
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
    
    // Get primary team info
    let primaryTeam: TeamInfo | null = null
    const [teamResult] = await db
      .select({
        id: teams.id,
        name: teams.name,
      })
      .from(teams)
      .where(eq(teams.id, role.teamId))
      .limit(1)
    
    primaryTeam = teamResult || null
    
    // Get all teams from junction table
    const roleTeamAssociations = await db
      .select({
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(organizationalRoleTeams)
      .innerJoin(teams, eq(organizationalRoleTeams.teamId, teams.id))
      .where(eq(organizationalRoleTeams.roleId, role.id))
    
    // Build all teams array - from junction table, or fallback to primary team
    const allTeams: TeamInfo[] = roleTeamAssociations.length > 0
      ? roleTeamAssociations.map(rt => ({ id: rt.teamId, name: rt.teamName }))
      : (primaryTeam ? [primaryTeam] : [])
    
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
    
    return NextResponse.json(toApiResponse(role, parentRole, primaryTeam, allTeams, holderCount, childCount))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Roles API] Error fetching role:", error)
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
    // Authorization check
    const session = await requirePermission(...P.people.roles.edit())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    
    const { id } = await params
    
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
    
    // Determine all team IDs - prefer teamIds over teamId
    const teamIdsToSet = data.teamIds?.length ? data.teamIds : (data.teamId ? [data.teamId] : null)
    
    // Validate all teams if changing
    if (teamIdsToSet && teamIdsToSet.length > 0) {
      const validTeams = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(inArray(teams.id, teamIdsToSet), eq(teams.orgId, orgId)))
      
      if (validTeams.length !== teamIdsToSet.length) {
        return NextResponse.json(
          { error: "One or more teams not found or do not belong to this organization" },
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
    // Update primary team if teamIds provided
    if (teamIdsToSet && teamIdsToSet.length > 0) {
      updateData.teamId = teamIdsToSet[0] // First team is primary
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
    
    // Update the role and junction table in a transaction
    const [record] = await db.transaction(async (tx) => {
      // Update the role
      const [updatedRole] = await tx
        .update(organizationalRoles)
        .set(updateData)
        .where(eq(organizationalRoles.id, id))
        .returning()
      
      // Update junction table if teams changed
      if (teamIdsToSet && teamIdsToSet.length > 0) {
        // Delete existing team associations
        await tx.delete(organizationalRoleTeams).where(eq(organizationalRoleTeams.roleId, id))
        
        // Insert new team associations
        await tx.insert(organizationalRoleTeams).values(
          teamIdsToSet.map(teamId => ({
            roleId: id,
            teamId,
          }))
        )
      }
      
      return [updatedRole]
    })
    
    // Build changes for audit log
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    if (data.name !== undefined && data.name !== existing.name) {
      changes.name = { old: existing.name, new: data.name }
    }
    if (data.description !== undefined && data.description !== existing.description) {
      changes.description = { old: existing.description, new: data.description }
    }
    if (teamIdsToSet && teamIdsToSet.length > 0) {
      changes.teamIds = { old: existing.teamId, new: teamIdsToSet }
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
    
    // Get primary team info
    let primaryTeam: TeamInfo | null = null
    const [teamResult] = await db
      .select({
        id: teams.id,
        name: teams.name,
      })
      .from(teams)
      .where(eq(teams.id, record.teamId))
      .limit(1)
    
    primaryTeam = teamResult || null
    
    // Get all teams from junction table
    const roleTeamAssociations = await db
      .select({
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(organizationalRoleTeams)
      .innerJoin(teams, eq(organizationalRoleTeams.teamId, teams.id))
      .where(eq(organizationalRoleTeams.roleId, record.id))
    
    // Build all teams array
    const allTeams: TeamInfo[] = roleTeamAssociations.length > 0
      ? roleTeamAssociations.map(rt => ({ id: rt.teamId, name: rt.teamName }))
      : (primaryTeam ? [primaryTeam] : [])
    
    return NextResponse.json(toApiResponse(record, parentRole, primaryTeam, allTeams))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Roles API] Error updating role:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
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
    // Authorization check
    const session = await requirePermission(...P.people.roles.delete())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    
    const { id } = await params
    
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
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Roles API] Error deleting role:", error)
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    )
  }
}

