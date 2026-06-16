/**
 * People Access Register API Routes
 * GET /api/people/access-register - List access assignments
 * POST /api/people/access-register - Assign access group to user
 */

import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { accessGroupAssignments, accessGroups, organizationalRoles, persons, teams, users } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

const CreateAssignmentSchema = z.object({
  accessGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  grantedByPersonId: z.string().uuid().nullable().optional(),
  reviewDueAt: z.string().datetime().nullable().optional(),
  reviewStatus: z.enum(["not_reviewed", "approved", "changes_required", "revoked"]).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
})

interface AssignmentRow {
  assignment: typeof accessGroupAssignments.$inferSelect
  group: typeof accessGroups.$inferSelect
  user: typeof users.$inferSelect
  person: typeof persons.$inferSelect | null
  role: { id: string; name: string } | null
  team: { id: string; name: string } | null
  grantedBy: { id: string; name: string; email: string } | null
}

interface RawAssignmentRow {
  assignment: typeof accessGroupAssignments.$inferSelect
  group: typeof accessGroups.$inferSelect
  user: typeof users.$inferSelect
  person: typeof persons.$inferSelect | null
  role: { id: string; name: string } | null
  team: { id: string; name: string } | null
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

async function getAssignmentRows(orgId: string) {
  const rows = await db
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
    .where(eq(accessGroupAssignments.orgId, orgId))
    .orderBy(desc(accessGroupAssignments.grantedAt))

  const grantorIds = rows
    .map((row) => row.assignment.grantedByPersonId)
    .filter((id): id is string => id !== null)
  const grantorMap = new Map<string, { id: string; name: string; email: string }>()

  if (grantorIds.length > 0) {
    const grantors = await db
      .select({ id: persons.id, name: persons.name, email: persons.email })
      .from(persons)
      .where(and(inArray(persons.id, grantorIds), eq(persons.orgId, orgId)))

    for (const grantor of grantors) {
      grantorMap.set(grantor.id, grantor)
    }
  }

  return rows.map((row) => ({
    ...(row as RawAssignmentRow),
    grantedBy: row.assignment.grantedByPersonId ? grantorMap.get(row.assignment.grantedByPersonId) ?? null : null,
  }))
}

export async function GET() {
  try {
    const session = await requirePermission(...P.people.accessRegister.view())
    const rows = await getAssignmentRows(session.orgId)

    return NextResponse.json(rows.map((row) => toApiResponse(row as AssignmentRow)))
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    console.error("[Access Register API] Error fetching access register:", error)
    return NextResponse.json({ error: "Failed to fetch access register" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.people.accessRegister.create())
    const orgId = session.orgId
    const auditLog = await getAuditLogger()

    const body = await request.json()
    const data = CreateAssignmentSchema.parse(body)

    const [group] = await db
      .select()
      .from(accessGroups)
      .where(and(eq(accessGroups.id, data.accessGroupId), eq(accessGroups.orgId, orgId)))
      .limit(1)

    if (!group) {
      return NextResponse.json({ error: "Access group not found" }, { status: 400 })
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, data.userId), eq(users.orgId, orgId)))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 400 })
    }

    const person = user.personId
      ? await db
          .select()
          .from(persons)
          .where(and(eq(persons.id, user.personId), eq(persons.orgId, orgId)))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null

    if (user.personId && !person) {
      return NextResponse.json({ error: "Linked person not found for this user" }, { status: 400 })
    }

    if (data.grantedByPersonId) {
      const [grantor] = await db
        .select({ id: persons.id })
        .from(persons)
        .where(and(eq(persons.id, data.grantedByPersonId), eq(persons.orgId, orgId)))
        .limit(1)

      if (!grantor) {
        return NextResponse.json({ error: "Grantor person not found" }, { status: 400 })
      }
    }

    const existing = await db
      .select({ id: accessGroupAssignments.id })
      .from(accessGroupAssignments)
      .where(
        and(
          eq(accessGroupAssignments.orgId, orgId),
          eq(accessGroupAssignments.accessGroupId, data.accessGroupId),
          eq(accessGroupAssignments.userId, data.userId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ error: "This user already has this access group" }, { status: 409 })
    }

    const [record] = await db
      .insert(accessGroupAssignments)
      .values({
        orgId,
        accessGroupId: data.accessGroupId,
        userId: data.userId,
        personId: user.personId ?? null,
        grantedByPersonId: data.grantedByPersonId ?? null,
        reviewDueAt: data.reviewDueAt ? new Date(data.reviewDueAt) : null,
        reviewStatus: data.reviewStatus ?? "not_reviewed",
        notes: data.notes ?? null,
      })
      .returning()

    if (auditLog) {
      await auditLog.logCreate("people.access-register", "access_group_assignment", {
        id: record.id,
        accessGroup: group.name,
        user: user.name,
        person: person?.name ?? null,
        reviewDueAt: record.reviewDueAt?.toISOString() ?? null,
      })
    }

    const rows = await getAssignmentRows(orgId)
    const created = rows.find((row) => row.assignment.id === record.id)
    if (!created) {
      return NextResponse.json({ error: "Created assignment not found" }, { status: 500 })
    }

    return NextResponse.json(toApiResponse(created as AssignmentRow), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    console.error("[Access Register API] Error assigning access group:", error)
    return NextResponse.json({ error: "Failed to assign access group" }, { status: 500 })
  }
}
