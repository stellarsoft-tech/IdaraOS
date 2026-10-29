/**
 * Security Training Course Detail API
 * GET    /api/security/training/courses/[id] - Course with questions (including answers)
 * PATCH  /api/security/training/courses/[id] - Update course details / status
 * DELETE /api/security/training/courses/[id] - Delete course, its questions and assignments
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  trainingCourses,
  trainingQuestions,
  trainingAssignments,
  trainingCourseCategoryValues,
  trainingCourseStatusValues,
} from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { QUESTIONS_PER_COURSE, parseTrainingVideoUrl } from "@/lib/security/training"
import { estimateLessonMinutes, trainingLessonSchema } from "@/lib/security/training-lesson"

interface RouteContext {
  params: Promise<{ id: string }>
}

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(trainingCourseCategoryValues).optional(),
  lesson: trainingLessonSchema.optional().nullable(),
  videoUrl: z.string().url("Enter a valid URL").max(500).optional().nullable().or(z.literal("")),
  videoDurationMinutes: z.number().int().min(1).max(120).optional().nullable(),
  passingScore: z.number().int().min(0).max(100).optional(),
  status: z.enum(trainingCourseStatusValues).optional(),
})

async function findCourse(id: string, orgId: string) {
  return db.query.trainingCourses.findFirst({
    where: and(eq(trainingCourses.id, id), eq(trainingCourses.orgId, orgId)),
  })
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.view())
    const { id } = await context.params

    const course = await findCourse(id, session.orgId)
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const questions = await db
      .select()
      .from(trainingQuestions)
      .where(eq(trainingQuestions.courseId, id))
      .orderBy(asc(trainingQuestions.sortOrder))

    return NextResponse.json({ data: { ...course, questions } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching training course:", error)
    return NextResponse.json({ error: "Failed to fetch training course" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.edit())
    const { id } = await context.params

    const parsed = updateCourseSchema.safeParse(await request.json())
    if (!parsed.success) {
      const issue = parsed.error.errors[0]
      return NextResponse.json(
        {
          error: issue ? `${issue.path.join(".") || "Request"}: ${issue.message}` : "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }
    const data = parsed.data

    const existing = await findCourse(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const nextVideoUrl = data.videoUrl !== undefined ? data.videoUrl || null : existing.videoUrl
    if (data.videoUrl && !parseTrainingVideoUrl(data.videoUrl)) {
      return NextResponse.json(
        { error: "Unsupported video URL. Use a YouTube or Vimeo link, or a direct .mp4/.webm file." },
        { status: 400 }
      )
    }

    // Publishing requires a lesson or playable video, and a complete quiz
    const nextLesson = data.lesson !== undefined ? data.lesson : existing.lesson
    const nextStatus = data.status ?? existing.status
    if (nextStatus === "published") {
      if (!nextLesson?.scenes.length && !parseTrainingVideoUrl(nextVideoUrl)) {
        return NextResponse.json(
          { error: "Add a lesson or a valid video URL before publishing this course" },
          { status: 400 }
        )
      }
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(trainingQuestions)
        .where(eq(trainingQuestions.courseId, id))
      if (count !== QUESTIONS_PER_COURSE) {
        return NextResponse.json(
          { error: `A course needs exactly ${QUESTIONS_PER_COURSE} questions before it can be published (currently ${count})` },
          { status: 400 }
        )
      }
    }

    const [updated] = await db
      .update(trainingCourses)
      .set({
        ...data,
        description: data.description === undefined ? undefined : data.description || null,
        videoUrl: data.videoUrl === undefined ? undefined : nextVideoUrl,
        // Lesson length is derived from its narration
        ...(data.lesson && { videoDurationMinutes: estimateLessonMinutes(data.lesson) }),
        updatedAt: new Date(),
      })
      .where(eq(trainingCourses.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.training",
        "training_course",
        id,
        updated.title,
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating training course:", error)
    return NextResponse.json({ error: "Failed to update training course" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.training.delete())
    const { id } = await context.params

    const existing = await findCourse(id, session.orgId)
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const [{ count: assignmentCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trainingAssignments)
      .where(eq(trainingAssignments.courseId, id))

    await db.delete(trainingCourses).where(eq(trainingCourses.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.training", "training_course", {
        id,
        name: existing.title,
        assignmentCount,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting training course:", error)
    return NextResponse.json({ error: "Failed to delete training course" }, { status: 500 })
  }
}
