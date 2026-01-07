/**
 * Teams API Routes
 * GET /api/people/teams - List all teams
 * POST /api/people/teams - Create a team
 * PUT /api/people/teams - Bulk update teams (positions)
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, or, and, asc, sql, isNull, isNotNull, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { teams, persons } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Create team schema
const CreateTeamSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  leadId: z.string().uuid().nullable().optional(),
  parentTeamId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
})

// Bulk update schema for designer
const BulkUpdateTeamsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    positionX: z.number().int().optional(),
    positionY: z.number().int().optional(),
    parentTeamId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })),
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

/**
 * GET /api/people/teams
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const parentId = searchParams.get("parentId")
    const topLevelOnly = searchParams.get("topLevelOnly") === "true"
    
    // Authorization check
    const session = await requirePermission(...P.people.teams.view())
    const orgId = session.orgId
    
    // Build query conditions
    const conditions = [eq(teams.orgId, orgId)]
    
    if (search) {
      const searchCondition = or(
        ilike(teams.name, `%${search}%`),
        ilike(teams.description, `%${search}%`)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    if (parentId) {
      conditions.push(eq(teams.parentTeamId, parentId))
    } else if (topLevelOnly) {
      conditions.push(isNull(teams.parentTeamId))
    }
    
    // Execute query
    const results = await db
      .select()
      .from(teams)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(teams.sortOrder), asc(teams.name))
    
    // Get all team IDs
    const teamIds = results.map(t => t.id)
    
    // Get lead info for all teams
    const leadIds = results.map(t => t.leadId).filter((id): id is string => id !== null)
    const leadsMap = new Map<string, LeadInfo>()
    
    if (leadIds.length > 0) {
      const leads = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
          slug: persons.slug,
        })
        .from(persons)
        .where(inArray(persons.id, leadIds))
      
      for (const lead of leads) {
        leadsMap.set(lead.id, lead)
      }
    }
    
    // Get parent team info
    const parentTeamIds = results.map(t => t.parentTeamId).filter((id): id is string => id !== null)
    const parentTeamsMap = new Map<string, ParentTeamInfo>()
    
    if (parentTeamIds.length > 0) {
      const parentTeams = await db
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .where(inArray(teams.id, parentTeamIds))
      
      for (const pt of parentTeams) {
        parentTeamsMap.set(pt.id, pt)
      }
    }
    
    // Get member counts using teamId FK on persons
    const memberCountsQuery = await db
      .select({
        teamId: persons.teamId,
        count: sql<number>`count(*)::int`,
      })
      .from(persons)
      .where(and(eq(persons.orgId, orgId), isNotNull(persons.teamId)))
      .groupBy(persons.teamId)
    
    const memberCountsMap = new Map<string, number>()
    for (const mc of memberCountsQuery) {
      if (mc.teamId) {
        memberCountsMap.set(mc.teamId, mc.count)
      }
    }
    
    // Get child counts
    const childCountsQuery = await db
      .select({
        parentTeamId: teams.parentTeamId,
        count: sql<number>`count(*)::int`,
      })
      .from(teams)
      .where(
        and(
          eq(teams.orgId, orgId),
          sql`${teams.parentTeamId} IS NOT NULL`
        )
      )
      .groupBy(teams.parentTeamId)
    
    const childCountsMap = new Map<string, number>()
    for (const cc of childCountsQuery) {
      if (cc.parentTeamId) {
        childCountsMap.set(cc.parentTeamId, cc.count)
      }
    }
    
    // Transform results
    const response = results.map(team => {
      const lead = team.leadId ? leadsMap.get(team.leadId) : null
      const parentTeam = team.parentTeamId ? parentTeamsMap.get(team.parentTeamId) : null
      // Match member count by teamId FK
      const memberCount = memberCountsMap.get(team.id) ?? 0
      const childCount = childCountsMap.get(team.id) ?? 0
      
      return toApiResponse(team, lead, parentTeam, memberCount, childCount)
    })
    
    return NextResponse.json(response)
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Teams API] Error fetching teams:", error)
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/people/teams
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.teams.create())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = CreateTeamSchema.parse(body)
    
    // Check for duplicate name within org
    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(
          eq(teams.orgId, orgId),
          eq(teams.name, data.name)
        )
      )
      .limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A team with this name already exists" },
        { status: 409 }
      )
    }
    
    // Create the team
    const result = await db
      .insert(teams)
      .values({
        orgId,
        name: data.name,
        description: data.description ?? null,
        leadId: data.leadId ?? null,
        parentTeamId: data.parentTeamId ?? null,
        sortOrder: data.sortOrder ?? 0,
        positionX: data.positionX ?? 0,
        positionY: data.positionY ?? 0,
      })
      .returning()
    
    const record = result[0]
    
    // Audit log the creation
    if (auditLog) {
      await auditLog.logCreate("people.teams", "team", {
        id: record.id,
        name: record.name,
        description: record.description,
        leadId: record.leadId,
        parentTeamId: record.parentTeamId,
      })
    }
    
    // Get lead info if set
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
    
    // Get parent team info if set
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
    
    return NextResponse.json(toApiResponse(record, lead, parentTeam, 0, 0), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Teams API] Error creating team:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/people/teams
 * Bulk update teams (for chart designer)
 */
export async function PUT(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.teams.edit())
    const orgId = session.orgId
    
    const body = await request.json()
    const data = BulkUpdateTeamsSchema.parse(body)
    
    if (data.updates.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0 })
    }
    
    // Update each team
    let updatedCount = 0
    for (const update of data.updates) {
      // Verify team belongs to org
      const [existing] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.id, update.id),
            eq(teams.orgId, orgId)
          )
        )
        .limit(1)
      
      if (!existing) {
        continue // Skip teams that don't exist or don't belong to org
      }
      
      // Build update data
      const updateData: Partial<typeof teams.$inferInsert> = {
        updatedAt: new Date(),
      }
      
      if (update.positionX !== undefined) {
        updateData.positionX = update.positionX
      }
      if (update.positionY !== undefined) {
        updateData.positionY = update.positionY
      }
      if (update.parentTeamId !== undefined) {
        updateData.parentTeamId = update.parentTeamId
      }
      if (update.sortOrder !== undefined) {
        updateData.sortOrder = update.sortOrder
      }
      
      // Update the team
      await db
        .update(teams)
        .set(updateData)
        .where(eq(teams.id, update.id))
      
      updatedCount++
    }
    
    return NextResponse.json({ success: true, updatedCount })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Teams API] Error bulk updating teams:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to bulk update teams" },
      { status: 500 }
    )
  }
}
