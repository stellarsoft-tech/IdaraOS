/**
 * Security Training Course Questions API
 * PUT /api/security/training/courses/[id]/questions - Replace the course quiz
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingCourses, trainingQuestions } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import {
  QUESTIONS_PER_COURSE,
  MIN_OPTIONS_PER_QUESTION,
  MAX_OPTIONS_PER_QUESTION,
} from "@/lib/security/training"

interface RouteContext {
  params: Promise<{ id: string }>
}

const questionSchema = z
  .object({
    question: z.string().trim().min(1, "Question text is required").max(1000),
    options: z
      .array(z.string().trim().min(1, "Options cannot be empty").max(500))
      .min(MIN_OPTIONS_PER_QUESTION, `Each question needs at least ${MIN_OPTIONS_PER_QUESTION} options`)
      .max(MAX_OPTIONS_PER_QUESTION, `Each question can have at most ${MAX_OPTIONS_PER_QUESTION} options`),
    correctOptionIndex: z.number().int().min(0),
    explanation: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((q) => q.correctOptionIndex < q.options.length, {
    message: "Correct answer must be one of the options",
    path: ["correctOptionIndex"],
  })

const replaceQuestionsSchema = z.object({
  questions: z
    .array(questionSchema)
    .length(QUESTIONS_PER_COURSE, `A course quiz must have exactly ${QUESTIONS_PER_COURSE} questions`),
})

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.edit())
    const { id } = await context.params

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, id), eq(trainingCourses.orgId, session.orgId)),
    })
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const parsed = replaceQuestionsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const questions = await db.transaction(async (tx) => {
      await tx.delete(trainingQuestions).where(eq(trainingQuestions.courseId, id))
      await tx.insert(trainingQuestions).values(
        parsed.data.questions.map((q, index) => ({
          courseId: id,
          question: q.question,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation || null,
          sortOrder: index,
        }))
      )
      await tx.update(trainingCourses).set({ updatedAt: new Date() }).where(eq(trainingCourses.id, id))
      return tx
        .select()
        .from(trainingQuestions)
        .where(eq(trainingQuestions.courseId, id))
        .orderBy(asc(trainingQuestions.sortOrder))
    })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.training",
        action: "update",
        entityType: "training_course",
        entityId: id,
        entityName: course.title,
        description: `Updated quiz questions (${questions.length})`,
      })
    }

    return NextResponse.json({ data: questions })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating training questions:", error)
    return NextResponse.json({ error: "Failed to update questions" }, { status: 500 })
  }
}
