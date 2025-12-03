/**
 * Users API Routes
 * GET /api/settings/users - List all users
 * POST /api/settings/users - Create/invite a user
 */

import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, userRoleValues, userRoles, roles, persons } from "@/lib/db/schema"
import { z } from "zod"
import { requireOrgId, getAuditLogger } from "@/lib/api/context"

// Create user schema
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(userRoleValues),
  personId: z.string().uuid().optional().nullable(),
  entraId: z.string().optional().nullable(),
})

// Person link info type
interface PersonInfo {
  id: string
  name: string
  slug: string
  role: string
  team: string | null
}

// Transform DB record to API response
function toApiResponse(
  record: typeof users.$inferSelect,
  userRolesData: { roleId: string; roleName: string; roleColor: string | null; source?: string; scimGroupId?: string | null }[],
  personInfo?: PersonInfo | null
) {
  return {
    id: record.id,
    orgId: record.orgId,
    personId: record.personId,
    entraId: record.entraId,
    email: record.email,
    name: record.name,
    avatar: record.avatar,
    role: record.role, // Legacy field
    roles: userRolesData, // Actual assigned roles from RBAC
    status: record.status,
    lastLoginAt: record.lastLoginAt?.toISOString(),
    invitedAt: record.invitedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    // Linked person info
    person: personInfo || null,
    // Flags for UI badges
    hasLinkedPerson: !!record.personId,
    hasEntraLink: !!record.entraId,
    // Sync flags
    hasScimRoles: userRolesData.some(r => r.source === "sync"),
    isScimProvisioned: record.scimProvisioned ?? false,
  }
}

/**
 * GET /api/settings/users
 */
export async function GET(request: NextRequest) {
  try {
    // Get orgId from authenticated session
    const orgId = await requireOrgId(request)
    
    // Get all users for this organization
    const usersData = await db
      .select()
      .from(users)
      .where(eq(users.orgId, orgId))
      .orderBy(asc(users.name))

    // Get all role assignments for these users
    const userIds = usersData.map(u => u.id)
    
    const roleAssignments = userIds.length > 0
      ? await db
          .select({
            userId: userRoles.userId,
            roleId: roles.id,
            roleName: roles.name,
            roleColor: roles.color,
            source: userRoles.source,
            scimGroupId: userRoles.scimGroupId,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
      : []

    // Get linked person info for users that have personId
    const personIds = usersData
      .map(u => u.personId)
      .filter((id): id is string => id !== null)
    
    const personsData = personIds.length > 0
      ? await db
          .select({
            id: persons.id,
            name: persons.name,
            slug: persons.slug,
            role: persons.role,
            team: persons.team,
          })
          .from(persons)
      : []

    // Create lookup maps
    const rolesByUserId = new Map<string, { roleId: string; roleName: string; roleColor: string | null; source: string; scimGroupId: string | null }[]>()
    for (const assignment of roleAssignments) {
      const existing = rolesByUserId.get(assignment.userId) || []
      existing.push({
        roleId: assignment.roleId,
        roleName: assignment.roleName,
        roleColor: assignment.roleColor,
        source: assignment.source,
        scimGroupId: assignment.scimGroupId,
      })
      rolesByUserId.set(assignment.userId, existing)
    }

    const personById = new Map<string, PersonInfo>()
    for (const person of personsData) {
      personById.set(person.id, person)
    }

    // Build response
    const response = usersData.map(user => 
      toApiResponse(
        user, 
        rolesByUserId.get(user.id) || [],
        user.personId ? personById.get(user.personId) : null
      )
    )

    return NextResponse.json(response)
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/users
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate
    const parseResult = CreateUserSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // Get orgId from authenticated session
    const orgId = await requireOrgId(request)

    // Check if email already exists in this organization
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.email, data.email),
        eq(users.orgId, orgId)
      ))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      )
    }

    // Create user
    const [record] = await db
      .insert(users)
      .values({
        orgId,
        email: data.email,
        name: data.name,
        role: data.role,
        personId: data.personId || null,
        entraId: data.entraId || null,
        status: "invited",
        invitedAt: new Date(),
      })
      .returning()

    // Audit log the creation
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("settings.users", "user", {
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role,
        status: record.status,
      })
    }

    return NextResponse.json(toApiResponse(record, []), { status: 201 })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    )
  }
}

