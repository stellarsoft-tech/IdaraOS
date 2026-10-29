/**
 * My Training Quiz Attempts API
 * POST /api/security/my-training/[id]/attempts - Submit quiz answers and get a score
 *
 * Grading happens on the server. Scoring below the course's passing score marks the
 * assignment "retake_required" and resets video progress, so the employee must watch
 * the video again before retaking the quiz.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingAssignments, trainingCourses, trainingQuestions, trainingAttempts } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { gradeQuiz } from "@/lib/security/training"
import { buildAttemptReview } from "@/lib/security/training-attempt-review"

interface RouteContext {
  params: Promise<{ id: string }>
}

const submitSchema = z.object({
  answers: z.record(z.string().uuid(), z.number().int().min(0)),
})

class AttemptRejected extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myTraining.view())
    const { id } = await context.params

    const parsed = submitSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid answers" }, { status: 400 })
    }
    const submitted = parsed.data.answers

    const outcome = await db.transaction(async (tx) => {
      // Lock the assignment so double-submits cannot create two attempts
      const [row] = await tx
        .select({ assignment: trainingAssignments, course: trainingCourses })
        .from(trainingAssignments)
        .innerJoin(trainingCourses, eq(trainingAssignments.courseId, trainingCourses.id))
        .where(and(
          eq(trainingAssignments.id, id),
          eq(trainingAssignments.userId, session.userId),
          eq(trainingAssignments.orgId, session.orgId)
        ))
        .limit(1)
        .for("update", { of: trainingAssignments })

      if (!row || row.course.status !== "published") {
        throw new AttemptRejected("Course not found", 404)
      }
      const { assignment, course } = row

      if (assignment.status === "passed") {
        throw new AttemptRejected("You have already passed this course", 409)
      }
      if (!assignment.videoCompletedAt) {
        throw new AttemptRejected("Watch the course video before taking the quiz", 409)
      }

      const questions = await tx
        .select()
        .from(trainingQuestions)
        .where(eq(trainingQuestions.courseId, course.id))
        .orderBy(asc(trainingQuestions.sortOrder))

      if (questions.length === 0) {
        throw new AttemptRejected("This course has no quiz questions yet", 409)
      }

      // Every current question must be answered with a valid option
      const questionIds = new Set(questions.map((q) => q.id))
      const unknown = Object.keys(submitted).some((qid) => !questionIds.has(qid))
      if (unknown) {
        throw new AttemptRejected("The quiz was updated. Reload the page and try again.", 409)
      }
      for (const q of questions) {
        const selected = submitted[q.id]
        if (selected === undefined) {
          throw new AttemptRejected("Answer every question before submitting", 400)
        }
        if (selected >= q.options.length) {
          throw new AttemptRejected("Invalid answer selected", 400)
        }
      }

      const grade = gradeQuiz(questions, submitted, course.passingScore)

      const [attempt] = await tx.insert(trainingAttempts).values({
        assignmentId: assignment.id,
        userId: session.userId,
        score: grade.score,
        correctCount: grade.correctCount,
        totalQuestions: grade.totalQuestions,
        passingScore: course.passingScore,
        passed: grade.passed,
        answers: grade.answers,
      }).returning()

      const now = new Date()
      await tx
        .update(trainingAssignments)
        .set({
          attemptCount: assignment.attemptCount + 1,
          lastScore: grade.score,
          bestScore: Math.max(assignment.bestScore ?? 0, grade.score),
          status: grade.passed ? "passed" : "retake_required",
          passedAt: grade.passed ? now : null,
          // A failed attempt requires watching the video again before retaking
          videoCompletedAt: grade.passed ? assignment.videoCompletedAt : null,
          updatedAt: now,
        })
        .where(eq(trainingAssignments.id, assignment.id))

      return { attempt, questions, course }
    })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.training",
        action: "submit",
        entityType: "training_attempt",
        entityId: outcome.attempt.id,
        entityName: outcome.course.title,
        description: `Scored ${outcome.attempt.score}% (${outcome.attempt.passed ? "passed" : "retake required"})`,
        metadata: {
          assignmentId: id,
          score: outcome.attempt.score,
          passingScore: outcome.attempt.passingScore,
          passed: outcome.attempt.passed,
        },
      })
    }

    return NextResponse.json(
      { data: buildAttemptReview(outcome.attempt, outcome.questions, outcome.attempt.passed) },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof AttemptRejected) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error submitting training attempt:", error)
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 })
  }
}
