/**
 * Organizational Roles API Routes
 * GET /api/people/roles - List all organizational roles
 * POST /api/people/roles - Create a role
 * PUT /api/people/roles/bulk - Bulk update positions from designer
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, or, and, asc, sql, isNull, isNotNull, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizationalRoles, organizationalRoleTeams, persons, teams } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Create role schema - at least one team is required
const CreateRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  teamId: z.string().uuid().optional(), // Deprecated, use teamIds
  teamIds: z.array(z.string().uuid()).optional(), // All team IDs
  parentRoleId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
}).refine(
  (data) => data.teamIds?.length || data.teamId,
  { message: "At least one team is required", path: ["teamIds"] }
)

// Bulk update schema for designer
const BulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    positionX: z.number().int().optional(),
    positionY: z.number().int().optional(),
    parentRoleId: z.string().uuid().nullable().optional(),
    teamId: z.string().uuid().optional(), // Deprecated, use teamIds
    teamIds: z.array(z.string().uuid()).optional(), // All team IDs
    level: z.number().int().min(0).optional(),
    sortOrder: z.number().int().optional(),
  })),
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
  // Build teamIds array - primary team first, then additional teams
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

/**
 * GET /api/people/roles
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const parentId = searchParams.get("parentId")
    const teamId = searchParams.get("teamId")
    const topLevelOnly = searchParams.get("topLevelOnly") === "true"
    
    // Authorization check
    const session = await requirePermission(...P.people.roles.view())
    const orgId = session.orgId
    
    // Build query conditions
    const conditions = [eq(organizationalRoles.orgId, orgId)]
    
    if (search) {
      const searchCondition = or(
        ilike(organizationalRoles.name, `%${search}%`),
        ilike(organizationalRoles.description, `%${search}%`)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    if (parentId) {
      conditions.push(eq(organizationalRoles.parentRoleId, parentId))
    } else if (topLevelOnly) {
      conditions.push(isNull(organizationalRoles.parentRoleId))
    }
    
    if (teamId) {
      conditions.push(eq(organizationalRoles.teamId, teamId))
    }
    
    // Execute query
    const results = await db
      .select()
      .from(organizationalRoles)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(organizationalRoles.level), asc(organizationalRoles.sortOrder), asc(organizationalRoles.name))
    
    // Get parent role info
    const parentRoleIds = results.map(r => r.parentRoleId).filter((id): id is string => id !== null)
    const parentRolesMap = new Map<string, ParentRoleInfo>()
    
    if (parentRoleIds.length > 0) {
      const parentRoles = await db
        .select({
          id: organizationalRoles.id,
          name: organizationalRoles.name,
          level: organizationalRoles.level,
        })
        .from(organizationalRoles)
        .where(inArray(organizationalRoles.id, parentRoleIds))
      
      for (const pr of parentRoles) {
        parentRolesMap.set(pr.id, pr)
      }
    }
    
    // Get all team associations from junction table
    const roleIds = results.map(r => r.id)
    const roleTeamsMap = new Map<string, TeamInfo[]>()
    
    if (roleIds.length > 0) {
      // Get team associations from junction table
      const roleTeamAssociations = await db
        .select({
          roleId: organizationalRoleTeams.roleId,
          teamId: teams.id,
          teamName: teams.name,
        })
        .from(organizationalRoleTeams)
        .innerJoin(teams, eq(organizationalRoleTeams.teamId, teams.id))
        .where(inArray(organizationalRoleTeams.roleId, roleIds))
      
      for (const rt of roleTeamAssociations) {
        if (!roleTeamsMap.has(rt.roleId)) {
          roleTeamsMap.set(rt.roleId, [])
        }
        roleTeamsMap.get(rt.roleId)!.push({ id: rt.teamId, name: rt.teamName })
      }
    }
    
    // Get primary team info for all roles (for backwards compatibility)
    const primaryTeamIds = [...new Set(results.map(r => r.teamId))]
    const teamsMap = new Map<string, TeamInfo>()
    
    if (primaryTeamIds.length > 0) {
      const teamsResult = await db
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .where(inArray(teams.id, primaryTeamIds))
      
      for (const t of teamsResult) {
        teamsMap.set(t.id, t)
      }
    }
    
    // Get holder counts using roleId FK on persons
    const holderCountsQuery = await db
      .select({
        roleId: persons.roleId,
        count: sql<number>`count(*)::int`,
      })
      .from(persons)
      .where(and(eq(persons.orgId, orgId), isNotNull(persons.roleId)))
      .groupBy(persons.roleId)
    
    const holderCountsMap = new Map<string, number>()
    for (const hc of holderCountsQuery) {
      if (hc.roleId) {
        holderCountsMap.set(hc.roleId, hc.count)
      }
    }
    
    // Get child counts
    const childCountsQuery = await db
      .select({
        parentRoleId: organizationalRoles.parentRoleId,
        count: sql<number>`count(*)::int`,
      })
      .from(organizationalRoles)
      .where(
        and(
          eq(organizationalRoles.orgId, orgId),
          sql`${organizationalRoles.parentRoleId} IS NOT NULL`
        )
      )
      .groupBy(organizationalRoles.parentRoleId)
    
    const childCountsMap = new Map<string, number>()
    for (const cc of childCountsQuery) {
      if (cc.parentRoleId) {
        childCountsMap.set(cc.parentRoleId, cc.count)
      }
    }
    
    // Transform results
    const response = results.map(role => {
      const parentRole = role.parentRoleId ? parentRolesMap.get(role.parentRoleId) : null
      const primaryTeam = teamsMap.get(role.teamId) || null
      
      // Get all teams for this role - from junction table, or fallback to primary team
      let allTeams = roleTeamsMap.get(role.id)
      if (!allTeams || allTeams.length === 0) {
        // Fallback: if no junction table entries, use primary team
        allTeams = primaryTeam ? [primaryTeam] : []
      }
      
      // Match holder count by roleId FK
      const holderCount = holderCountsMap.get(role.id) ?? 0
      const childCount = childCountsMap.get(role.id) ?? 0
      
      return toApiResponse(role, parentRole, primaryTeam, allTeams, holderCount, childCount)
    })
    
    return NextResponse.json(response)
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Roles API] Error fetching roles:", error)
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/people/roles
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.roles.create())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = CreateRoleSchema.parse(body)
    
    // Determine all team IDs - use teamIds if provided, otherwise use teamId
    const allTeamIds = data.teamIds?.length ? data.teamIds : (data.teamId ? [data.teamId] : [])
    const primaryTeamId = allTeamIds[0] // First team is primary
    
    // Validate all teams belong to org
    const validTeams = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(and(inArray(teams.id, allTeamIds), eq(teams.orgId, orgId)))
    
    if (validTeams.length !== allTeamIds.length) {
      return NextResponse.json(
        { error: "One or more teams not found or do not belong to this organization" },
        { status: 400 }
      )
    }
    
    // Check for duplicate name within org
    const existing = await db
      .select({ id: organizationalRoles.id })
      .from(organizationalRoles)
      .where(
        and(
          eq(organizationalRoles.orgId, orgId),
          eq(organizationalRoles.name, data.name)
        )
      )
      .limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 409 }
      )
    }
    
    // Calculate level based on parent if not provided
    let level = data.level ?? 0
    if (data.parentRoleId && data.level === undefined) {
      const [parentRole] = await db
        .select({ level: organizationalRoles.level })
        .from(organizationalRoles)
        .where(eq(organizationalRoles.id, data.parentRoleId))
        .limit(1)
      
      if (parentRole) {
        level = parentRole.level + 1
      }
    }
    
    // Create the role and junction table entries in a transaction
    const record = await db.transaction(async (tx) => {
      // Create the role with primary team
      const result = await tx
        .insert(organizationalRoles)
        .values({
          orgId,
          name: data.name,
          description: data.description ?? null,
          teamId: primaryTeamId,
          parentRoleId: data.parentRoleId ?? null,
          level,
          sortOrder: data.sortOrder ?? 0,
          positionX: data.positionX ?? 0,
          positionY: data.positionY ?? 0,
        })
        .returning()
      
      const newRole = result[0]
      
      // Insert all team associations into junction table
      if (allTeamIds.length > 0) {
        await tx.insert(organizationalRoleTeams).values(
          allTeamIds.map(teamId => ({
            roleId: newRole.id,
            teamId,
          }))
        )
      }
      
      return newRole
    })
    
    // Audit log the creation
    if (auditLog) {
      await auditLog.logCreate("people.roles", "organizational_role", {
        id: record.id,
        name: record.name,
        description: record.description,
        teamIds: allTeamIds,
        parentRoleId: record.parentRoleId,
        level: record.level,
      })
    }
    
    // Get parent role info if set
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
    
    // Build teams array from validated teams
    const teamsInfo: TeamInfo[] = validTeams.map(t => ({ id: t.id, name: t.name }))
    const primaryTeam = teamsInfo.find(t => t.id === primaryTeamId) || null
    
    return NextResponse.json(toApiResponse(record, parentRole, primaryTeam, teamsInfo, 0, 0), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Roles API] Error creating role:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create role" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/people/roles (bulk update)
 */
export async function PUT(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.roles.create())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = BulkUpdateSchema.parse(body)
    
    // Validate all IDs belong to this org
    const roleIds = data.updates.map(u => u.id)
    const existingRoles = await db
      .select({ id: organizationalRoles.id })
      .from(organizationalRoles)
      .where(
        and(
          eq(organizationalRoles.orgId, orgId),
          inArray(organizationalRoles.id, roleIds)
        )
      )
    
    const existingIds = new Set(existingRoles.map(r => r.id))
    const invalidIds = roleIds.filter(id => !existingIds.has(id))
    
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Some role IDs are invalid or not found", invalidIds },
        { status: 400 }
      )
    }
    
    // Update each role in a transaction to ensure consistency
    await db.transaction(async (tx) => {
      for (const update of data.updates) {
        const updateData: Partial<typeof organizationalRoles.$inferInsert> = {
          updatedAt: new Date(),
        }
        
        if (update.positionX !== undefined) {
          updateData.positionX = update.positionX
        }
        if (update.positionY !== undefined) {
          updateData.positionY = update.positionY
        }
        if (update.parentRoleId !== undefined) {
          updateData.parentRoleId = update.parentRoleId
        }
        if (update.level !== undefined) {
          updateData.level = update.level
        }
        if (update.sortOrder !== undefined) {
          updateData.sortOrder = update.sortOrder
        }
        
        // Handle team updates - prefer teamIds over teamId
        const teamIdsToSet = update.teamIds?.length ? update.teamIds : (update.teamId ? [update.teamId] : null)
        
        if (teamIdsToSet && teamIdsToSet.length > 0) {
          // Update primary team
          updateData.teamId = teamIdsToSet[0]
          
          // Update junction table - delete existing and insert new
          await tx.delete(organizationalRoleTeams).where(eq(organizationalRoleTeams.roleId, update.id))
          await tx.insert(organizationalRoleTeams).values(
            teamIdsToSet.map(teamId => ({
              roleId: update.id,
              teamId,
            }))
          )
        }
        
        await tx
          .update(organizationalRoles)
          .set(updateData)
          .where(eq(organizationalRoles.id, update.id))
      }
    })
    
    // Audit log the bulk update
    if (auditLog) {
      await auditLog.log({
        module: "people.roles",
        action: "update",
        entityType: "organizational_roles_bulk",
        entityId: "bulk",
        entityName: `${data.updates.length} roles updated`,
        description: `Bulk updated ${data.updates.length} roles`,
        metadata: { roleIds, updateCount: data.updates.length },
      })
    }
    
    return NextResponse.json({ success: true, updatedCount: data.updates.length })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("[Roles API] Error bulk updating roles:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to bulk update roles" },
      { status: 500 }
    )
  }
}

