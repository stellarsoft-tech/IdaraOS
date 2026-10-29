/**
 * Security Training Courses API
 * GET  /api/security/training/courses - List courses with assignment stats
 * POST /api/security/training/courses - Create a draft course
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, desc, eq, sql } from "drizzle-orm"
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
import { DEFAULT_PASSING_SCORE } from "@/lib/security/training"

const createCourseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(trainingCourseCategoryValues).default("general"),
  videoUrl: z.string().url("Enter a valid URL").max(500).optional().nullable().or(z.literal("")),
  videoDurationMinutes: z.number().int().min(1).max(120).optional().nullable(),
  passingScore: z.number().int().min(0).max(100).default(DEFAULT_PASSING_SCORE),
})

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.training.view())
    const status = request.nextUrl.searchParams.get("status")

    const conditions = [eq(trainingCourses.orgId, session.orgId)]
    if (status && (trainingCourseStatusValues as readonly string[]).includes(status)) {
      conditions.push(eq(trainingCourses.status, status as (typeof trainingCourseStatusValues)[number]))
    }

    const questionCounts = db
      .select({
        courseId: trainingQuestions.courseId,
        count: sql<number>`count(*)::int`.as("question_count"),
      })
      .from(trainingQuestions)
      .groupBy(trainingQuestions.courseId)
      .as("question_counts")

    const assignmentStats = db
      .select({
        courseId: trainingAssignments.courseId,
        assigned: sql<number>`count(*)::int`.as("assigned"),
        passed: sql<number>`count(*) filter (where ${trainingAssignments.status} = 'passed')::int`.as("passed"),
        retakeRequired: sql<number>`count(*) filter (where ${trainingAssignments.status} = 'retake_required')::int`.as("retake_required"),
        averageScore: sql<number | null>`round(avg(${trainingAssignments.lastScore}))::int`.as("average_score"),
      })
      .from(trainingAssignments)
      .groupBy(trainingAssignments.courseId)
      .as("assignment_stats")

    const rows = await db
      .select({
        course: trainingCourses,
        questionCount: sql<number>`coalesce(${questionCounts.count}, 0)`,
        assigned: sql<number>`coalesce(${assignmentStats.assigned}, 0)`,
        passed: sql<number>`coalesce(${assignmentStats.passed}, 0)`,
        retakeRequired: sql<number>`coalesce(${assignmentStats.retakeRequired}, 0)`,
        averageScore: assignmentStats.averageScore,
      })
      .from(trainingCourses)
      .leftJoin(questionCounts, eq(questionCounts.courseId, trainingCourses.id))
      .leftJoin(assignmentStats, eq(assignmentStats.courseId, trainingCourses.id))
      .where(and(...conditions))
      .orderBy(desc(trainingCourses.createdAt))

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r.course,
        questionCount: r.questionCount,
        assignedCount: r.assigned,
        passedCount: r.passed,
        retakeRequiredCount: r.retakeRequired,
        averageScore: r.averageScore,
      })),
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching training courses:", error)
    return NextResponse.json({ error: "Failed to fetch training courses" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.training.create())

    const parsed = createCourseSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const data = parsed.data

    const [course] = await db.insert(trainingCourses).values({
      orgId: session.orgId,
      title: data.title,
      description: data.description || null,
      category: data.category,
      videoUrl: data.videoUrl || null,
      videoDurationMinutes: data.videoDurationMinutes ?? null,
      passingScore: data.passingScore,
      status: "draft",
      createdById: session.userId,
    }).returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.training", "training_course", {
        id: course.id,
        name: course.title,
        category: course.category,
        passingScore: course.passingScore,
      })
    }

    return NextResponse.json({ data: course }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating training course:", error)
    return NextResponse.json({ error: "Failed to create training course" }, { status: 500 })
  }
}
