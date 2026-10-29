/**
 * Security Training Course Assignments API
 * GET  /api/security/training/courses/[id]/assignments - Who is assigned and their scores
 * POST /api/security/training/courses/[id]/assignments - Assign the course to users (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, eq, inArray, notInArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingCourses, trainingAssignments, users } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { isAssignmentOverdue } from "@/lib/security/training"

interface RouteContext {
  params: Promise<{ id: string }>
}

const assignSchema = z
  .object({
    userIds: z.array(z.string().uuid()).max(1000).optional(),
    allUsers: z.boolean().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
      .optional()
      .nullable(),
  })
  .refine((d) => d.allUsers || (d.userIds && d.userIds.length > 0), {
    message: "Select at least one user",
  })

/** Users who can no longer sign in are never assigned */
const INACTIVE_USER_STATUSES = ["suspended", "deactivated"] as const

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.view())
    const { id } = await context.params

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, id), eq(trainingCourses.orgId, session.orgId)),
      columns: { id: true },
    })
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const rows = await db
      .select({
        assignment: trainingAssignments,
        userName: users.name,
        userEmail: users.email,
      })
      .from(trainingAssignments)
      .innerJoin(users, eq(trainingAssignments.userId, users.id))
      .where(and(eq(trainingAssignments.courseId, id), eq(trainingAssignments.orgId, session.orgId)))
      .orderBy(asc(users.name))

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r.assignment,
        userName: r.userName,
        userEmail: r.userEmail,
        isOverdue: isAssignmentOverdue(r.assignment.dueDate, r.assignment.status),
      })),
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching training assignments:", error)
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.create())
    const { id } = await context.params

    const parsed = assignSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const { userIds, allUsers, dueDate } = parsed.data

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, id), eq(trainingCourses.orgId, session.orgId)),
    })
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }
    if (course.status !== "published") {
      return NextResponse.json(
        { error: "Only published courses can be assigned" },
        { status: 400 }
      )
    }

    // Resolve target users within this organization only
    const targetUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.orgId, session.orgId),
        notInArray(users.status, [...INACTIVE_USER_STATUSES]),
        allUsers ? undefined : inArray(users.id, userIds!)
      ))

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: "No eligible users found" }, { status: 400 })
    }

    const inserted = await db
      .insert(trainingAssignments)
      .values(targetUsers.map((u) => ({
        orgId: session.orgId,
        courseId: id,
        userId: u.id,
        dueDate: dueDate || null,
        assignedById: session.userId,
      })))
      .onConflictDoNothing({ target: [trainingAssignments.courseId, trainingAssignments.userId] })
      .returning({ id: trainingAssignments.id })

    const audit = await getAuditLogger()
    if (audit && inserted.length > 0) {
      await audit.log({
        module: "security.training",
        action: "create",
        entityType: "training_assignment",
        entityId: id,
        entityName: course.title,
        description: `Assigned course to ${inserted.length} user(s)`,
        metadata: { assignedCount: inserted.length, dueDate: dueDate || null, allUsers: !!allUsers },
      })
    }

    return NextResponse.json(
      {
        data: {
          assigned: inserted.length,
          alreadyAssigned: targetUsers.length - inserted.length,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error assigning training course:", error)
    return NextResponse.json({ error: "Failed to assign course" }, { status: 500 })
  }
}
