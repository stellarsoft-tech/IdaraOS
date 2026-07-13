/**
 * People Access Register Detail API Routes
 * PUT /api/people/access-register/[id] - Update review state
 * DELETE /api/people/access-register/[id] - Revoke access group assignment
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { accessGroupAssignments, accessGroups, organizationalRoles, persons, teams, users } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

const UpdateAssignmentSchema = z.object({
  accessGroupId: z.string().uuid().optional(),
  reviewDueAt: z.string().datetime().nullable().optional(),
  lastReviewedAt: z.string().datetime().nullable().optional(),
  reviewStatus: z.enum(["not_reviewed", "approved", "changes_required", "revoked"]).optional(),
  notes: z.string().max(1000, "Notes too long").nullable().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

interface AssignmentRow {
  assignment: typeof accessGroupAssignments.$inferSelect
  group: typeof accessGroups.$inferSelect
  user: typeof users.$inferSelect
  person: typeof persons.$inferSelect | null
  role: { id: string; name: string } | null
  team: { id: string; name: string } | null
  grantedBy: { id: string; name: string; email: string } | null
}

function toApiResponse(row: AssignmentRow) {
  return {
    id: row.assignment.id,
    accessGroupId: row.assignment.accessGroupId,
    userId: row.assignment.userId,
    personId: row.assignment.personId,
    grantedByPersonId: row.assignment.grantedByPersonId,
    accessGroup: {
      id: row.group.id,
      name: row.group.name,
      riskLevel: row.group.riskLevel,
      reviewFrequency: row.group.reviewFrequency,
      isoControls: row.group.isoControls ?? [],
      status: row.group.status,
    },
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
      status: row.user.status,
    },
    person: row.person ? {
      id: row.person.id,
      name: row.person.name,
      email: row.person.email,
      status: row.person.status,
      role: row.role,
      team: row.team,
    } : null,
    grantedBy: row.grantedBy,
    grantedAt: row.assignment.grantedAt.toISOString(),
    reviewDueAt: row.assignment.reviewDueAt?.toISOString() ?? null,
    lastReviewedAt: row.assignment.lastReviewedAt?.toISOString() ?? null,
    reviewStatus: row.assignment.reviewStatus,
    notes: row.assignment.notes ?? undefined,
    createdAt: row.assignment.createdAt.toISOString(),
    updatedAt: row.assignment.updatedAt.toISOString(),
  }
}

async function getAssignmentRow(id: string, orgId: string): Promise<AssignmentRow | null> {
  const [row] = await db
    .select({
      assignment: accessGroupAssignments,
      group: accessGroups,
      user: users,
      person: persons,
      role: {
        id: organizationalRoles.id,
        name: organizationalRoles.name,
      },
      team: {
        id: teams.id,
        name: teams.name,
      },
    })
    .from(accessGroupAssignments)
    .innerJoin(accessGroups, eq(accessGroupAssignments.accessGroupId, accessGroups.id))
    .innerJoin(users, eq(accessGroupAssignments.userId, users.id))
    .leftJoin(persons, eq(accessGroupAssignments.personId, persons.id))
    .leftJoin(organizationalRoles, eq(persons.roleId, organizationalRoles.id))
    .leftJoin(teams, eq(persons.teamId, teams.id))
    .where(and(eq(accessGroupAssignments.id, id), eq(accessGroupAssignments.orgId, orgId)))
    .limit(1)

  if (!row) return null

  const grantorId = row.assignment.grantedByPersonId
  const grantedBy = grantorId
    ? await db
        .select({ id: persons.id, name: persons.name, email: persons.email })
        .from(persons)
        .where(and(inArray(persons.id, [grantorId]), eq(persons.orgId, orgId)))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null

  return {
    ...row,
    grantedBy,
  } as AssignmentRow
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.people.accessRegister.edit())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    const { id } = await params

    const existing = await getAssignmentRow(id, orgId)
    if (!existing) return NextResponse.json({ error: "Access register entry not found" }, { status: 404 })

    const body = await request.json()
    const data = UpdateAssignmentSchema.parse(body)

    if (data.accessGroupId !== undefined && data.accessGroupId !== existing.assignment.accessGroupId) {
      const [group] = await db
        .select({ id: accessGroups.id })
        .from(accessGroups)
        .where(and(eq(accessGroups.id, data.accessGroupId), eq(accessGroups.orgId, orgId)))
        .limit(1)

      if (!group) {
        return NextResponse.json({ error: "Access group not found" }, { status: 400 })
      }

      const [duplicate] = await db
        .select({ id: accessGroupAssignments.id })
        .from(accessGroupAssignments)
        .where(
          and(
            eq(accessGroupAssignments.orgId, orgId),
            eq(accessGroupAssignments.accessGroupId, data.accessGroupId),
            eq(accessGroupAssignments.userId, existing.assignment.userId)
          )
        )
        .limit(1)

      if (duplicate) {
        return NextResponse.json({ error: "This user already has this access group" }, { status: 409 })
      }
    }

    const updateData: Partial<typeof accessGroupAssignments.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (data.accessGroupId !== undefined) updateData.accessGroupId = data.accessGroupId
    if (data.reviewDueAt !== undefined) updateData.reviewDueAt = data.reviewDueAt ? new Date(data.reviewDueAt) : null
    if (data.lastReviewedAt !== undefined) updateData.lastReviewedAt = data.lastReviewedAt ? new Date(data.lastReviewedAt) : null
    if (data.reviewStatus !== undefined) updateData.reviewStatus = data.reviewStatus
    if (data.notes !== undefined) updateData.notes = data.notes

    const [record] = await db
      .update(accessGroupAssignments)
      .set(updateData)
      .where(eq(accessGroupAssignments.id, id))
      .returning()

    if (auditLog) {
      await auditLog.logUpdate(
        "people.access-register",
        "access_group_assignment",
        record.id,
        `${existing.user.name} - ${existing.group.name}`,
        existing.assignment,
        record
      )
    }

    const updated = await getAssignmentRow(id, orgId)
    if (!updated) return NextResponse.json({ error: "Updated entry not found" }, { status: 500 })

    return NextResponse.json(toApiResponse(updated))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    console.error("[Access Register API] Error updating access register entry:", error)
    return NextResponse.json({ error: "Failed to update access register entry" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.people.accessRegister.delete())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()
    const { id } = await params

    const existing = await getAssignmentRow(id, orgId)
    if (!existing) return NextResponse.json({ error: "Access register entry not found" }, { status: 404 })

    await db.delete(accessGroupAssignments).where(eq(accessGroupAssignments.id, id))

    if (auditLog) {
      await auditLog.logDelete("people.access-register", "access_group_assignment", {
        id: existing.assignment.id,
        accessGroup: existing.group.name,
        user: existing.user.name,
        person: existing.person?.name ?? null,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    console.error("[Access Register API] Error revoking access group:", error)
    return NextResponse.json({ error: "Failed to revoke access group" }, { status: 500 })
  }
}
