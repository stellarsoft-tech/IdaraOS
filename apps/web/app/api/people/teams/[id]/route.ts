/**
 * Team Detail API Routes
 * GET /api/people/teams/[id] - Get team by ID
 * PUT /api/people/teams/[id] - Update team
 * DELETE /api/people/teams/[id] - Delete team
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { teams, persons } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Update team schema
const UpdateTeamSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  description: z.string().max(500, "Description too long").nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  parentTeamId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
})

// Lead info type
interface LeadInfo {
  id: string
  name: string
  email: string
  slug: string
}

// Parent team info type
interface ParentTeamInfo {
  id: string
  name: string
}

// Transform DB record to API response
function toApiResponse(
  record: typeof teams.$inferSelect,
  lead?: LeadInfo | null,
  parentTeam?: ParentTeamInfo | null,
  memberCount?: number,
  childCount?: number
) {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    leadId: record.leadId,
    lead: lead || null,
    parentTeamId: record.parentTeamId,
    parentTeam: parentTeam || null,
    sortOrder: record.sortOrder,
    positionX: record.positionX,
    positionY: record.positionY,
    memberCount: memberCount ?? 0,
    childCount: childCount ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/people/teams/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.teams.view())
    const orgId = session.orgId
    
    const { id } = await params
    
    // Fetch the team
    const [team] = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.id, id),
          eq(teams.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      )
    }
    
    // Get lead info
    let lead: LeadInfo | null = null
    if (team.leadId) {
      const [leadResult] = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
          slug: persons.slug,
        })
        .from(persons)
        .where(eq(persons.id, team.leadId))
        .limit(1)
      
      lead = leadResult || null
    }
    
    // Get parent team info
    let parentTeam: ParentTeamInfo | null = null
    if (team.parentTeamId) {
      const [parentResult] = await db
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .where(eq(teams.id, team.parentTeamId))
        .limit(1)
      
      parentTeam = parentResult || null
    }
    
    // Get member count - match by team name until we have teamId FK
    const [memberCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(persons)
      .where(
        and(
          eq(persons.orgId, orgId),
          eq(persons.teamId, team.id)
        )
      )
    const memberCount = memberCountResult?.count ?? 0
    
    // Get child count
    const [childCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(
        and(
          eq(teams.orgId, orgId),
          eq(teams.parentTeamId, team.id)
        )
      )
    const childCount = childCountResult?.count ?? 0
    
    return NextResponse.json(toApiResponse(team, lead, parentTeam, memberCount, childCount))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Teams API] Error fetching team:", error)
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/people/teams/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.teams.edit())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    
    const { id } = await params
    
    const body = await request.json()
    const data = UpdateTeamSchema.parse(body)
    
    // Fetch existing team
    const [existing] = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.id, id),
          eq(teams.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      )
    }
    
    // Check for circular parent reference
    if (data.parentTeamId && data.parentTeamId === id) {
      return NextResponse.json(
        { error: "A team cannot be its own parent" },
        { status: 400 }
      )
    }
    
    // Check for duplicate name if changing
    if (data.name && data.name !== existing.name) {
      const duplicate = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.orgId, orgId),
            eq(teams.name, data.name)
          )
        )
        .limit(1)
      
      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: "A team with this name already exists" },
          { status: 409 }
        )
      }
    }
    
    // Build update data
    const updateData: Partial<typeof teams.$inferInsert> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) {
      updateData.name = data.name
    }
    if (data.description !== undefined) {
      updateData.description = data.description
    }
    if (data.leadId !== undefined) {
      updateData.leadId = data.leadId
    }
    if (data.parentTeamId !== undefined) {
      updateData.parentTeamId = data.parentTeamId
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
    
    // Update the team
    const [record] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, id))
      .returning()
    
    // Build changes for audit log
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    if (data.name !== undefined && data.name !== existing.name) {
      changes.name = { old: existing.name, new: data.name }
    }
    if (data.description !== undefined && data.description !== existing.description) {
      changes.description = { old: existing.description, new: data.description }
    }
    if (data.leadId !== undefined && data.leadId !== existing.leadId) {
      changes.leadId = { old: existing.leadId, new: data.leadId }
    }
    if (data.parentTeamId !== undefined && data.parentTeamId !== existing.parentTeamId) {
      changes.parentTeamId = { old: existing.parentTeamId, new: data.parentTeamId }
    }
    
    // Audit log the update
    if (Object.keys(changes).length > 0 && auditLog) {
      await auditLog.logUpdate(
        "people.teams",
        "team",
        record.id,
        record.name,
        existing,
        record
      )
    }
    
    // Get lead info
    let lead: LeadInfo | null = null
    if (record.leadId) {
      const [leadResult] = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
          slug: persons.slug,
        })
        .from(persons)
        .where(eq(persons.id, record.leadId))
        .limit(1)
      
      lead = leadResult || null
    }
    
    // Get parent team info
    let parentTeam: ParentTeamInfo | null = null
    if (record.parentTeamId) {
      const [parentResult] = await db
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .where(eq(teams.id, record.parentTeamId))
        .limit(1)
      
      parentTeam = parentResult || null
    }
    
    return NextResponse.json(toApiResponse(record, lead, parentTeam))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Teams API] Error updating team:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/people/teams/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.teams.delete())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    
    const { id } = await params
    
    // Fetch existing team
    const [existing] = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.id, id),
          eq(teams.orgId, orgId)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      )
    }
    
    // Check if team has children
    const [childCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.parentTeamId, id))
    
    if (childCount && childCount.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete team with sub-teams. Delete or reassign sub-teams first." },
        { status: 400 }
      )
    }
    
    // Delete the team
    await db.delete(teams).where(eq(teams.id, id))
    
    // Audit log the deletion
    if (auditLog) {
      await auditLog.logDelete("people.teams", "team", {
        id: existing.id,
        name: existing.name,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Teams API] Error deleting team:", error)
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    )
  }
}

