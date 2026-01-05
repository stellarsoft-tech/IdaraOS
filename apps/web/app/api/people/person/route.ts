/**
 * People API Routes
 * GET /api/people/person - List all people
 * POST /api/people/person - Create a person
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, or, and, inArray, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { persons, users, organizationalRoles, teams } from "@/lib/db/schema"
import { CreatePersonSchema } from "@/lib/generated/people/person/types"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { processWorkflowEvent } from "@/lib/workflows/processor"
import { P } from "@/lib/rbac/resources"

// Generate slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
}

// Linked user info type
interface LinkedUserInfo {
  id: string
  name: string
  email: string
  status: string
  hasEntraLink: boolean
}

// Manager info type
interface ManagerInfo {
  id: string
  name: string
  email: string
  slug: string
}

// Sync info type
interface SyncInfo {
  source: "manual" | "sync"
  entraId: string | null
  entraGroupId: string | null
  entraGroupName: string | null
  lastSyncedAt: string | null
  syncEnabled: boolean
}

// Transform DB record to API response
// Organizational role info type
interface OrgRoleInfo {
  id: string
  name: string
  level: number
}

// Team info type (for display)
interface TeamDisplayInfo {
  id: string
  name: string
}

function toApiResponse(
  record: typeof persons.$inferSelect,
  linkedUser?: LinkedUserInfo | null,
  manager?: ManagerInfo | null,
  orgRole?: OrgRoleInfo | null,
  teamInfo?: TeamDisplayInfo | null
) {
  // Determine if person has Entra link (either through linked user or direct sync)
  const hasEntraLink = !!record.entraId || linkedUser?.hasEntraLink || false
  
  // Build sync info
  const syncInfo: SyncInfo = {
    source: record.source as "manual" | "sync",
    entraId: record.entraId ?? null,
    entraGroupId: record.entraGroupId ?? null,
    entraGroupName: record.entraGroupName ?? null,
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    syncEnabled: record.syncEnabled ?? false,
  }
  
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    email: record.email,
    // Role name from linked organizational role
    role: orgRole?.name ?? null,
    roleId: record.roleId ?? null,
    orgRole: orgRole || null, // Full org role info
    // Team name from linked team
    team: teamInfo?.name ?? null,
    teamId: record.teamId ?? null,
    teamInfo: teamInfo || null, // Full team info
    managerId: record.managerId,
    manager: manager || null,
    status: record.status,
    startDate: record.startDate,
    endDate: record.endDate,
    phone: record.phone ?? undefined,
    location: record.location ?? undefined,
    avatar: record.avatar ?? undefined,
    bio: record.bio ?? undefined,
    assignedAssets: 0, // TODO: Compute from assets table
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    // Entra fields
    entraCreatedAt: record.entraCreatedAt?.toISOString() ?? null,
    hireDate: record.hireDate ?? null,
    lastSignInAt: record.lastSignInAt?.toISOString() ?? null,
    lastPasswordChangeAt: record.lastPasswordChangeAt?.toISOString() ?? null,
    // Linked user info
    linkedUser: linkedUser || null,
    hasLinkedUser: !!linkedUser,
    hasEntraLink,
    // Sync tracking
    ...syncInfo,
  }
}

/**
 * GET /api/people/person
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const team = searchParams.get("team")
    
    // Authorization check
    const session = await requirePermission(...P.people.directory.view())
    const orgId = session.orgId
    
    // Build query - always filter by organization
    const conditions = [eq(persons.orgId, orgId)]
    
    if (search) {
      const searchCondition = or(
        ilike(persons.name, `%${search}%`),
        ilike(persons.email, `%${search}%`)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    if (status) {
      const statuses = status.split(",")
      conditions.push(inArray(persons.status, statuses as any))
    }
    
    // Team filtering removed - use teamId instead if needed
    
    // Execute query with conditions (orgId AND other filters)
    const results = await db
      .select()
      .from(persons)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(persons.name))
    
    // Get linked users for all people
    const personIds = results.map(p => p.id)
    
    const linkedUsers = personIds.length > 0
      ? await db
          .select({
            id: users.id,
            personId: users.personId,
            name: users.name,
            email: users.email,
            status: users.status,
            entraId: users.entraId,
          })
          .from(users)
          .where(inArray(users.personId, personIds))
      : []

    // Create lookup map for linked users
    const userByPersonId = new Map<string, LinkedUserInfo>()
    for (const user of linkedUsers) {
      if (user.personId) {
        userByPersonId.set(user.personId, {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          hasEntraLink: !!user.entraId,
        })
      }
    }
    
    // Create lookup map for managers (persons by ID)
    const managerById = new Map<string, ManagerInfo>()
    for (const person of results) {
      managerById.set(person.id, {
        id: person.id,
        name: person.name,
        email: person.email,
        slug: person.slug,
      })
    }
    
    // Fetch organizational roles for all people with roleId
    const roleIds = [...new Set(results.map(p => p.roleId).filter((id): id is string => !!id))]
    const orgRoleById = new Map<string, OrgRoleInfo>()
    
    if (roleIds.length > 0) {
      const roles = await db
        .select({
          id: organizationalRoles.id,
          name: organizationalRoles.name,
          level: organizationalRoles.level,
        })
        .from(organizationalRoles)
        .where(inArray(organizationalRoles.id, roleIds))
      
      for (const role of roles) {
        orgRoleById.set(role.id, role)
      }
    }
    
    // Fetch teams for all people with teamId
    const teamIds = [...new Set(results.map(p => p.teamId).filter((id): id is string => !!id))]
    const teamById = new Map<string, TeamDisplayInfo>()
    
    if (teamIds.length > 0) {
      const teamResults = await db
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .where(inArray(teams.id, teamIds))
      
      for (const t of teamResults) {
        teamById.set(t.id, t)
      }
    }
    
    return NextResponse.json(
      results.map(person => {
        const manager = person.managerId ? managerById.get(person.managerId) : null
        const orgRole = person.roleId ? orgRoleById.get(person.roleId) : null
        const teamInfo = person.teamId ? teamById.get(person.teamId) : null
        return toApiResponse(person, userByPersonId.get(person.id), manager, orgRole, teamInfo)
      })
    )
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error fetching people:", error)
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/people/person
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.people.directory.create())
    const orgId = session.orgId
    
    const body = await request.json()
    
    // Validate
    const parseResult = CreatePersonSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    const slug = slugify(data.name)
    
    // Check duplicate email
    const existing = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.email, data.email))
      .limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A person with this email already exists" },
        { status: 409 }
      )
    }
    
    // Look up role name from roleId (for response and Entra sync)
    let roleName: string | null = null
    if (data.roleId) {
      const [role] = await db
        .select({ name: organizationalRoles.name })
        .from(organizationalRoles)
        .where(eq(organizationalRoles.id, data.roleId))
        .limit(1)
      roleName = role?.name ?? null
    }
    
    // Look up team name from teamId (for response and Entra sync)
    let teamName: string | null = null
    if (data.teamId) {
      const [team] = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, data.teamId))
        .limit(1)
      teamName = team?.name ?? null
    }
    
    // Insert with status from request or default to "onboarding"
    const status = data.status ?? "onboarding"
    const result = await db
      .insert(persons)
      .values({
        orgId,
        slug,
        name: data.name,
        email: data.email,
        roleId: data.roleId ?? null,
        teamId: data.teamId ?? null,
        startDate: data.startDate,
        hireDate: data.hireDate ?? null,
        phone: data.phone ?? null,
        location: data.location ?? null,
        status,
      })
      .returning()
    const record = result[0]
    
    // Audit log the creation
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("people.directory", "person", {
        id: record.id,
        name: record.name,
        email: record.email,
        roleId: record.roleId,
        roleName: roleName,
        teamId: record.teamId,
        teamName: teamName,
        startDate: record.startDate,
        hireDate: record.hireDate,
        phone: record.phone,
        location: record.location,
        status: record.status,
      })
    }
    
    // Trigger workflow via central processor
    try {
      // Use session from the authorization check
      const triggeredByUserId = session.userId
      
      const workflowResult = await processWorkflowEvent({
        type: "person.created",
        personId: record.id,
        personName: record.name,
        status: record.status,
        orgId: record.orgId,
        triggeredByUserId,
      })
      
      if (workflowResult.workflowsTriggered.length > 0) {
        console.log(`[People API] Triggered ${workflowResult.workflowsTriggered.length} workflow(s) for new person ${record.email}`)
      }
    } catch (workflowError) {
      console.error("[People API] Error triggering workflow:", workflowError)
      // Don't fail the request, just log the error
    }
    
    // Build orgRole and teamInfo for response
    const orgRole: OrgRoleInfo | null = data.roleId && roleName 
      ? { id: data.roleId, name: roleName, level: 0 } 
      : null
    const teamInfo: TeamDisplayInfo | null = data.teamId && teamName 
      ? { id: data.teamId, name: teamName } 
      : null
    
    return NextResponse.json(toApiResponse(record, null, null, orgRole, teamInfo), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error creating person:", error)
    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    )
  }
}
