/**
 * My Training API
 * GET /api/security/my-training - Courses assigned to the current user
 */

import { NextResponse } from "next/server"
import { and, asc, eq, ne, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingAssignments, trainingCourses } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { isAssignmentOverdue } from "@/lib/security/training"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.myTraining.view())

    const rows = await db
      .select({
        assignment: trainingAssignments,
        course: {
          id: trainingCourses.id,
          title: trainingCourses.title,
          description: trainingCourses.description,
          category: trainingCourses.category,
          videoDurationMinutes: trainingCourses.videoDurationMinutes,
          passingScore: trainingCourses.passingScore,
        },
      })
      .from(trainingAssignments)
      .innerJoin(trainingCourses, eq(trainingAssignments.courseId, trainingCourses.id))
      .where(and(
        eq(trainingAssignments.userId, session.userId),
        eq(trainingAssignments.orgId, session.orgId),
        ne(trainingCourses.status, "archived")
      ))
      .orderBy(
        // Outstanding work first, then by due date
        sql`CASE WHEN ${trainingAssignments.status} = 'passed' THEN 1 ELSE 0 END`,
        asc(trainingAssignments.dueDate),
        asc(trainingCourses.title)
      )

    const data = rows.map((r) => ({
      id: r.assignment.id,
      status: r.assignment.status,
      dueDate: r.assignment.dueDate,
      attemptCount: r.assignment.attemptCount,
      lastScore: r.assignment.lastScore,
      bestScore: r.assignment.bestScore,
      passedAt: r.assignment.passedAt,
      videoCompletedAt: r.assignment.videoCompletedAt,
      assignedAt: r.assignment.createdAt,
      isOverdue: isAssignmentOverdue(r.assignment.dueDate, r.assignment.status),
      course: r.course,
    }))

    return NextResponse.json({
      data,
      stats: {
        total: data.length,
        passed: data.filter((d) => d.status === "passed").length,
        outstanding: data.filter((d) => d.status !== "passed").length,
        retakeRequired: data.filter((d) => d.status === "retake_required").length,
        overdue: data.filter((d) => d.isOverdue).length,
      },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching my training:", error)
    return NextResponse.json({ error: "Failed to fetch your training" }, { status: 500 })
  }
}
