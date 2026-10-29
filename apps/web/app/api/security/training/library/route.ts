/**
 * Security Training Starter Library API
 * GET  /api/security/training/library - Starter courses and whether each is installed
 * POST /api/security/training/library - Install starter courses for this organization
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainingCourses } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { TRAINING_LIBRARY } from "@/lib/security/training-library"
import { installTrainingLibrary } from "@/lib/security/training-install"

const installSchema = z.object({
  keys: z.array(z.string()).optional(),
})

export async function GET() {
  try {
    const session = await requirePermission(...P.security.training.view())

    const installed = await db
      .select({ libraryKey: trainingCourses.libraryKey })
      .from(trainingCourses)
      .where(and(eq(trainingCourses.orgId, session.orgId), isNotNull(trainingCourses.libraryKey)))
    const installedKeys = new Set(installed.map((c) => c.libraryKey))

    return NextResponse.json({
      data: TRAINING_LIBRARY.map((c) => ({
        key: c.key,
        title: c.title,
        description: c.description,
        category: c.category,
        questionCount: c.questions.length,
        installed: installedKeys.has(c.key),
      })),
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching training library:", error)
    return NextResponse.json({ error: "Failed to fetch training library" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.training.create())

    const parsed = installSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    const result = await installTrainingLibrary(db, session.orgId, session.userId, parsed.data.keys)

    const audit = await getAuditLogger()
    if (audit && result.installed.length > 0) {
      await audit.log({
        module: "security.training",
        action: "create",
        entityType: "training_course",
        description: `Installed ${result.installed.length} starter course(s)`,
        metadata: { courses: result.installed.map((c) => c.title) },
      })
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error installing training library:", error)
    return NextResponse.json({ error: "Failed to install starter courses" }, { status: 500 })
  }
}
