/**
 * Organizational Roles API Routes
 * GET /api/people/roles - List all organizational roles
 * POST /api/people/roles - Create a role
 * PUT /api/people/roles/bulk - Bulk update positions from designer
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, or, and, asc, sql, isNull, isNotNull, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { organizationalRoles, persons, teams } from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
import { z } from "zod"

// Create role schema - teamId is required
const CreateRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  teamId: z.string().uuid("Team is required"),
  parentRoleId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
})

// Bulk update schema for designer
const BulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    positionX: z.number().int().optional(),
    positionY: z.number().int().optional(),
    parentRoleId: z.string().uuid().nullable().optional(),
    teamId: z.string().uuid().optional(),
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
    
    // Get orgId from authenticated session
    const orgId = await requireOrgId(request)
    
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
    
    // Get team info for all roles
    const teamIds = [...new Set(results.map(r => r.teamId))]
    const teamsMap = new Map<string, TeamInfo>()
    
    if (teamIds.length > 0) {
      const teamsResult = await db
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .where(inArray(teams.id, teamIds))
      
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
      const team = teamsMap.get(role.teamId) || null
      // Match holder count by roleId FK
      const holderCount = holderCountsMap.get(role.id) ?? 0
      const childCount = childCountsMap.get(role.id) ?? 0
      
      return toApiResponse(role, parentRole, team, holderCount, childCount)
    })
    
    return NextResponse.json(response)
  } catch (error) {
    console.error("[Roles API] Error fetching roles:", error)
    if ((error as Error).message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
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
    const orgId = await requireOrgId(request)
    const session = await requireSession()
    const auditLog = await getAuditLogger()
    
    const body = await request.json()
    const data = CreateRoleSchema.parse(body)
    
    // Validate team belongs to org
    const [teamExists] = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(and(eq(teams.id, data.teamId), eq(teams.orgId, orgId)))
      .limit(1)
    
    if (!teamExists) {
      return NextResponse.json(
        { error: "Team not found or does not belong to this organization" },
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
    
    // Create the role
    const result = await db
      .insert(organizationalRoles)
      .values({
        orgId,
        name: data.name,
        description: data.description ?? null,
        teamId: data.teamId,
        parentRoleId: data.parentRoleId ?? null,
        level,
        sortOrder: data.sortOrder ?? 0,
        positionX: data.positionX ?? 0,
        positionY: data.positionY ?? 0,
      })
      .returning()
    
    const record = result[0]
    
    // Audit log the creation
    if (auditLog) {
      await auditLog.logCreate("people.roles", "organizational_role", {
        id: record.id,
        name: record.name,
        description: record.description,
        teamId: record.teamId,
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
    
    // Team info is already available from validation
    const team: TeamInfo = { id: teamExists.id, name: teamExists.name }
    
    return NextResponse.json(toApiResponse(record, parentRole, team, 0, 0), { status: 201 })
  } catch (error) {
    console.error("[Roles API] Error creating role:", error)
    
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
    const orgId = await requireOrgId(request)
    const session = await requireSession()
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
    
    // Update each role
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
      if (update.teamId !== undefined) {
        updateData.teamId = update.teamId
      }
      if (update.level !== undefined) {
        updateData.level = update.level
      }
      if (update.sortOrder !== undefined) {
        updateData.sortOrder = update.sortOrder
      }
      
      await db
        .update(organizationalRoles)
        .set(updateData)
        .where(eq(organizationalRoles.id, update.id))
    }
    
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
    console.error("[Roles API] Error bulk updating roles:", error)
    
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
      { error: "Failed to bulk update roles" },
      { status: 500 }
    )
  }
}

