/**
 * My Training Video Completion API
 * POST /api/security/my-training/[id]/video-complete - Mark the course video as watched
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingAssignments, trainingCourses } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myTraining.view())
    const { id } = await context.params

    const [row] = await db
      .select({ assignment: trainingAssignments, courseStatus: trainingCourses.status })
      .from(trainingAssignments)
      .innerJoin(trainingCourses, eq(trainingAssignments.courseId, trainingCourses.id))
      .where(and(
        eq(trainingAssignments.id, id),
        eq(trainingAssignments.userId, session.userId),
        eq(trainingAssignments.orgId, session.orgId)
      ))
      .limit(1)

    if (!row || row.courseStatus !== "published") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const { assignment } = row
    if (assignment.status === "passed" || assignment.videoCompletedAt) {
      return NextResponse.json({ data: assignment })
    }

    const [updated] = await db
      .update(trainingAssignments)
      .set({
        videoCompletedAt: new Date(),
        status: assignment.status === "not_started" ? "in_progress" : assignment.status,
        updatedAt: new Date(),
      })
      .where(eq(trainingAssignments.id, id))
      .returning()

    return NextResponse.json({ data: updated })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error marking training video complete:", error)
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
  }
}
