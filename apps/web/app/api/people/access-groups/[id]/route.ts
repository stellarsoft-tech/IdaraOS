/**
 * People Access Group Detail API Routes
 * GET /api/people/access-groups/[id] - Get access group
 * PUT /api/people/access-groups/[id] - Update access group
 * DELETE /api/people/access-groups/[id] - Delete access group
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { accessGroups, accessGroupRoles, accessGroupAssignments, organizationalRoles, persons } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

const UpdateAccessGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").nullable().optional(),
  businessJustification: z.string().min(1, "Business justification is required").max(1500, "Business justification too long").optional(),
  accessItems: z.array(z.string().min(1).max(120)).optional(),
  isoControls: z.array(z.string().min(1).max(30)).optional(),
  ownerPersonId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  reviewFrequency: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["active", "draft", "retired"]).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

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

async function getGroupContext(id: string, orgId: string) {
  const [group] = await db
    .select()
    .from(accessGroups)
    .where(and(eq(accessGroups.id, id), eq(accessGroups.orgId, orgId)))
    .limit(1)

  if (!group) return null

  const roles = await db
    .select({ id: organizationalRoles.id, name: organizationalRoles.name })
    .from(accessGroupRoles)
    .innerJoin(organizationalRoles, eq(accessGroupRoles.roleId, organizationalRoles.id))
    .where(eq(accessGroupRoles.accessGroupId, group.id))

  const owner = group.ownerPersonId
    ? await db
        .select({ id: persons.id, name: persons.name, email: persons.email })
        .from(persons)
        .where(and(eq(persons.id, group.ownerPersonId), eq(persons.orgId, orgId)))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null

  const [assignmentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accessGroupAssignments)
    .where(and(eq(accessGroupAssignments.accessGroupId, group.id), eq(accessGroupAssignments.orgId, orgId)))

  return {
    group,
    roles,
    owner,
    assignmentCount: assignmentCount?.count ?? 0,
  }
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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.people.accessGroups.view())
    const orgId = session.orgId
    const { id } = await params

    const context = await getGroupContext(id, orgId)
    if (!context) return NextResponse.json({ error: "Access group not found" }, { status: 404 })

    return NextResponse.json(toApiResponse(context.group, context.owner, context.roles, context.assignmentCount))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    console.error("[Access Groups API] Error fetching access group:", error)
    return NextResponse.json({ error: "Failed to fetch access group" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.people.accessGroups.edit())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    const { id } = await params

    const context = await getGroupContext(id, orgId)
    if (!context) return NextResponse.json({ error: "Access group not found" }, { status: 404 })

    const body = await request.json()
    const data = UpdateAccessGroupSchema.parse(body)

    const owner = data.ownerPersonId !== undefined
      ? await validatePerson(orgId, data.ownerPersonId)
      : context.owner
    if (data.ownerPersonId && !owner) {
      return NextResponse.json({ error: "Owner person not found" }, { status: 400 })
    }

    if (data.roleIds) {
      const rolesValid = await validateRoleIds(orgId, data.roleIds)
      if (!rolesValid) {
        return NextResponse.json({ error: "One or more recommended roles are invalid" }, { status: 400 })
      }
    }

    if (data.name && data.name !== context.group.name) {
      const duplicate = await db
        .select({ id: accessGroups.id })
        .from(accessGroups)
        .where(and(eq(accessGroups.orgId, orgId), eq(accessGroups.name, data.name)))
        .limit(1)

      if (duplicate.length > 0) {
        return NextResponse.json({ error: "An access group with this name already exists" }, { status: 409 })
      }
    }

    const [record] = await db.transaction(async (tx) => {
      const updateData: Partial<typeof accessGroups.$inferInsert> = {
        updatedAt: new Date(),
      }

      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description
      if (data.businessJustification !== undefined) updateData.businessJustification = data.businessJustification
      if (data.accessItems !== undefined) updateData.accessItems = data.accessItems
      if (data.isoControls !== undefined) updateData.isoControls = data.isoControls
      if (data.ownerPersonId !== undefined) updateData.ownerPersonId = data.ownerPersonId
      if (data.reviewFrequency !== undefined) updateData.reviewFrequency = data.reviewFrequency
      if (data.riskLevel !== undefined) updateData.riskLevel = data.riskLevel
      if (data.status !== undefined) updateData.status = data.status

      const [updated] = await tx
        .update(accessGroups)
        .set(updateData)
        .where(eq(accessGroups.id, id))
        .returning()

      if (data.roleIds) {
        await tx.delete(accessGroupRoles).where(eq(accessGroupRoles.accessGroupId, id))
        if (data.roleIds.length > 0) {
          await tx.insert(accessGroupRoles).values(
            data.roleIds.map((roleId) => ({
              accessGroupId: id,
              roleId,
            }))
          )
        }
      }

      return [updated]
    })

    if (auditLog) {
      await auditLog.logUpdate("people.access-groups", "access_group", record.id, record.name, context.group, record)
    }

    const updatedContext = await getGroupContext(record.id, orgId)
    return NextResponse.json(
      toApiResponse(record, owner ?? null, updatedContext?.roles ?? [], updatedContext?.assignmentCount ?? 0)
    )
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    console.error("[Access Groups API] Error updating access group:", error)
    return NextResponse.json({ error: "Failed to update access group" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.people.accessGroups.delete())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    const { id } = await params

    const context = await getGroupContext(id, orgId)
    if (!context) return NextResponse.json({ error: "Access group not found" }, { status: 404 })

    if (context.assignmentCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete an access group with active register assignments. Revoke assignments first." },
        { status: 400 }
      )
    }

    await db.delete(accessGroups).where(eq(accessGroups.id, id))

    if (auditLog) {
      await auditLog.logDelete("people.access-groups", "access_group", {
        id: context.group.id,
        name: context.group.name,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    console.error("[Access Groups API] Error deleting access group:", error)
    return NextResponse.json({ error: "Failed to delete access group" }, { status: 500 })
  }
}
