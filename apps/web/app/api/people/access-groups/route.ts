/**
 * People Access Groups API Routes
 * GET /api/people/access-groups - List access groups
 * POST /api/people/access-groups - Create access group
 */

import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { accessGroups, accessGroupRoles, accessGroupAssignments, organizationalRoles, persons } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

const AccessGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  businessJustification: z.string().min(1, "Business justification is required").max(1500, "Business justification too long"),
  accessItems: z.array(z.string().min(1).max(120)).optional(),
  isoControls: z.array(z.string().min(1).max(30)).optional(),
  ownerPersonId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  reviewFrequency: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["active", "draft", "retired"]).optional(),
})

interface PersonInfo {
  id: string
  name: string
  email: string
}

interface RoleInfo {
  id: string
  name: string
}

function toApiResponse(
  record: typeof accessGroups.$inferSelect,
  owner: PersonInfo | null,
  roles: RoleInfo[],
  assignmentCount: number
) {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    businessJustification: record.businessJustification,
    accessItems: record.accessItems ?? [],
    isoControls: record.isoControls ?? [],
    ownerPersonId: record.ownerPersonId,
    owner,
    roleIds: roles.map((role) => role.id),
    roles,
    reviewFrequency: record.reviewFrequency,
    riskLevel: record.riskLevel,
    status: record.status,
    assignmentCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function getRoleMap(groupIds: string[]) {
  const roleMap = new Map<string, RoleInfo[]>()
  if (groupIds.length === 0) return roleMap

  const rows = await db
    .select({
      accessGroupId: accessGroupRoles.accessGroupId,
      id: organizationalRoles.id,
      name: organizationalRoles.name,
    })
    .from(accessGroupRoles)
    .innerJoin(organizationalRoles, eq(accessGroupRoles.roleId, organizationalRoles.id))
    .where(inArray(accessGroupRoles.accessGroupId, groupIds))

  for (const row of rows) {
    if (!roleMap.has(row.accessGroupId)) roleMap.set(row.accessGroupId, [])
    roleMap.get(row.accessGroupId)!.push({ id: row.id, name: row.name })
  }

  return roleMap
}

async function validatePerson(orgId: string, personId: string | null | undefined) {
  if (!personId) return null

  const [person] = await db
    .select({ id: persons.id, name: persons.name, email: persons.email })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.orgId, orgId)))
    .limit(1)

  return person ?? null
}

async function validateRoleIds(orgId: string, roleIds: string[]) {
  if (roleIds.length === 0) return true

  const roles = await db
    .select({ id: organizationalRoles.id })
    .from(organizationalRoles)
    .where(and(inArray(organizationalRoles.id, roleIds), eq(organizationalRoles.orgId, orgId)))

  return roles.length === roleIds.length
}

export async function GET() {
  try {
    const session = await requirePermission(...P.people.accessGroups.view())
    const orgId = session.orgId

    const groups = await db
      .select()
      .from(accessGroups)
      .where(eq(accessGroups.orgId, orgId))
      .orderBy(asc(accessGroups.name))

    const groupIds = groups.map((group) => group.id)
    const roleMap = await getRoleMap(groupIds)

    const ownerIds = groups.map((group) => group.ownerPersonId).filter((id): id is string => id !== null)
    const ownerMap = new Map<string, PersonInfo>()
    if (ownerIds.length > 0) {
      const owners = await db
        .select({ id: persons.id, name: persons.name, email: persons.email })
        .from(persons)
        .where(and(inArray(persons.id, ownerIds), eq(persons.orgId, orgId)))

      for (const owner of owners) ownerMap.set(owner.id, owner)
    }

    const assignmentRows = groupIds.length > 0
      ? await db
          .select({
            accessGroupId: accessGroupAssignments.accessGroupId,
            count: sql<number>`count(*)::int`,
          })
          .from(accessGroupAssignments)
          .where(and(inArray(accessGroupAssignments.accessGroupId, groupIds), eq(accessGroupAssignments.orgId, orgId)))
          .groupBy(accessGroupAssignments.accessGroupId)
      : []
    const assignmentCountMap = new Map(assignmentRows.map((row) => [row.accessGroupId, row.count]))

    return NextResponse.json(
      groups.map((group) =>
        toApiResponse(
          group,
          group.ownerPersonId ? ownerMap.get(group.ownerPersonId) ?? null : null,
          roleMap.get(group.id) ?? [],
          assignmentCountMap.get(group.id) ?? 0
        )
      )
    )
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    console.error("[Access Groups API] Error fetching access groups:", error)
    return NextResponse.json({ error: "Failed to fetch access groups" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.people.accessGroups.create())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()

    const body = await request.json()
    const data = AccessGroupSchema.parse(body)
    const roleIds = data.roleIds ?? []

    const owner = await validatePerson(orgId, data.ownerPersonId)
    if (data.ownerPersonId && !owner) {
      return NextResponse.json({ error: "Owner person not found" }, { status: 400 })
    }

    const rolesValid = await validateRoleIds(orgId, roleIds)
    if (!rolesValid) {
      return NextResponse.json({ error: "One or more recommended roles are invalid" }, { status: 400 })
    }

    const existing = await db
      .select({ id: accessGroups.id })
      .from(accessGroups)
      .where(and(eq(accessGroups.orgId, orgId), eq(accessGroups.name, data.name)))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ error: "An access group with this name already exists" }, { status: 409 })
    }

    const record = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(accessGroups)
        .values({
          orgId,
          name: data.name,
          description: data.description ?? null,
          businessJustification: data.businessJustification,
          accessItems: data.accessItems ?? [],
          isoControls: data.isoControls ?? ["A.5.15", "A.5.18"],
          ownerPersonId: data.ownerPersonId ?? null,
          reviewFrequency: data.reviewFrequency ?? "quarterly",
          riskLevel: data.riskLevel ?? "medium",
          status: data.status ?? "active",
        })
        .returning()

      if (roleIds.length > 0) {
        await tx.insert(accessGroupRoles).values(
          roleIds.map((roleId) => ({
            accessGroupId: created.id,
            roleId,
          }))
        )
      }

      return created
    })

    if (auditLog) {
      await auditLog.logCreate("people.access-groups", "access_group", {
        id: record.id,
        name: record.name,
        riskLevel: record.riskLevel,
        roleIds,
      })
    }

    const roleMap = await getRoleMap([record.id])
    return NextResponse.json(toApiResponse(record, owner, roleMap.get(record.id) ?? [], 0), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    console.error("[Access Groups API] Error creating access group:", error)
    return NextResponse.json({ error: "Failed to create access group" }, { status: 500 })
  }
}
