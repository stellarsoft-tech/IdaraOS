/**
 * My Training Course API
 * GET /api/security/my-training/[id] - One of the current user's assigned courses
 *
 * Quiz questions are returned without answers, and only after the video is watched.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingAssignments, trainingCourses, trainingQuestions, trainingAttempts } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { isAssignmentOverdue } from "@/lib/security/training"
import { buildAttemptReview } from "@/lib/security/training-attempt-review"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myTraining.view())
    const { id } = await context.params

    const [row] = await db
      .select({ assignment: trainingAssignments, course: trainingCourses })
      .from(trainingAssignments)
      .innerJoin(trainingCourses, eq(trainingAssignments.courseId, trainingCourses.id))
      .where(and(
        eq(trainingAssignments.id, id),
        eq(trainingAssignments.userId, session.userId),
        eq(trainingAssignments.orgId, session.orgId)
      ))
      .limit(1)

    if (!row || row.course.status === "archived") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }
    const { assignment, course } = row

    const [questions, attempts] = await Promise.all([
      db.select().from(trainingQuestions)
        .where(eq(trainingQuestions.courseId, course.id))
        .orderBy(asc(trainingQuestions.sortOrder)),
      db.select().from(trainingAttempts)
        .where(eq(trainingAttempts.assignmentId, assignment.id))
        .orderBy(desc(trainingAttempts.submittedAt)),
    ])

    const passed = assignment.status === "passed"
    const quizUnlocked = !passed && !!assignment.videoCompletedAt
    const lastAttempt = attempts[0]

    return NextResponse.json({
      data: {
        id: assignment.id,
        status: assignment.status,
        dueDate: assignment.dueDate,
        isOverdue: isAssignmentOverdue(assignment.dueDate, assignment.status),
        attemptCount: assignment.attemptCount,
        lastScore: assignment.lastScore,
        bestScore: assignment.bestScore,
        passedAt: assignment.passedAt,
        videoCompletedAt: assignment.videoCompletedAt,
        quizUnlocked,
        course: {
          id: course.id,
          title: course.title,
          description: course.description,
          category: course.category,
          lesson: course.lesson,
          videoUrl: course.videoUrl,
          videoDurationMinutes: course.videoDurationMinutes,
          passingScore: course.passingScore,
          questionCount: questions.length,
        },
        // Never include correctOptionIndex or explanation here
        questions: quizUnlocked
          ? questions.map((q) => ({ id: q.id, question: q.question, options: q.options }))
          : [],
        attempts: attempts.map((a) => ({
          id: a.id,
          score: a.score,
          correctCount: a.correctCount,
          totalQuestions: a.totalQuestions,
          passed: a.passed,
          submittedAt: a.submittedAt,
        })),
        lastAttemptReview: lastAttempt ? buildAttemptReview(lastAttempt, questions, passed) : null,
      },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching training course:", error)
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 })
  }
}
