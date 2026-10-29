/**
 * Security Training Assignment API
 * PATCH  /api/security/training/assignments/[id] - Change due date or reset (require retake)
 * DELETE /api/security/training/assignments/[id] - Unassign the course
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingAssignments, trainingCourses, users } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

interface RouteContext {
  params: Promise<{ id: string }>
}

const updateAssignmentSchema = z.object({
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
    .optional()
    .nullable(),
  // Reset progress so the user must watch the video and pass the quiz again
  reset: z.boolean().optional(),
})

async function findAssignment(id: string, orgId: string) {
  const [row] = await db
    .select({
      assignment: trainingAssignments,
      courseTitle: trainingCourses.title,
      userName: users.name,
    })
    .from(trainingAssignments)
    .innerJoin(trainingCourses, eq(trainingAssignments.courseId, trainingCourses.id))
    .innerJoin(users, eq(trainingAssignments.userId, users.id))
    .where(and(eq(trainingAssignments.id, id), eq(trainingAssignments.orgId, orgId)))
    .limit(1)
  return row
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.edit())
    const { id } = await context.params

    const parsed = updateAssignmentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const { dueDate, reset } = parsed.data

    const existing = await findAssignment(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    const [updated] = await db
      .update(trainingAssignments)
      .set({
        ...(dueDate !== undefined && { dueDate: dueDate || null }),
        ...(reset && {
          status: "not_started" as const,
          videoCompletedAt: null,
          passedAt: null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(trainingAssignments.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.training",
        "training_assignment",
        id,
        `${existing.courseTitle} - ${existing.userName}`,
        existing.assignment as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating training assignment:", error)
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.delete())
    const { id } = await context.params

    const existing = await findAssignment(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    await db.delete(trainingAssignments).where(eq(trainingAssignments.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.training", "training_assignment", {
        id,
        name: `${existing.courseTitle} - ${existing.userName}`,
        status: existing.assignment.status,
        attemptCount: existing.assignment.attemptCount,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting training assignment:", error)
    return NextResponse.json({ error: "Failed to remove assignment" }, { status: 500 })
  }
}
