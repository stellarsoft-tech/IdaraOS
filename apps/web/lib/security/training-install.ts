/**
 * Security Training - install starter courses for an organization (server only)
 * Idempotent: courses already installed (matched by library key) are skipped.
 * Installed starter courses that predate lessons (no lesson yet) get the lesson added.
 */

import { and, eq, inArray, isNull } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
// Relative imports so seed scripts (run with tsx, outside Next.js) can use this module
import * as schema from "../db/schema"
import { trainingCourses, trainingQuestions } from "../db/schema"
import { TRAINING_LIBRARY } from "./training-library"
import { estimateLessonMinutes } from "./training-lesson"

export interface InstallLibraryResult {
  installed: { id: string; title: string }[]
  skipped: string[]
  lessonsAdded: string[]
}

/**
 * Install starter library courses for an organization.
 *
 * @param db - Drizzle database (app client or a script's own client)
 * @param orgId - Organization to install for
 * @param createdById - User performing the install (null for seed scripts)
 * @param keys - Optional subset of library keys; installs all when omitted
 * @param options.refreshLessons - Replace the lesson of already-installed starter courses with the
 *   current library version (overwrites admin edits to those lessons; used by the dev seed)
 */
export async function installTrainingLibrary(
  db: NodePgDatabase<typeof schema>,
  orgId: string,
  createdById: string | null,
  keys?: string[],
  options: { refreshLessons?: boolean } = {}
): Promise<InstallLibraryResult> {
  const selected = keys?.length
    ? TRAINING_LIBRARY.filter((c) => keys.includes(c.key))
    : TRAINING_LIBRARY

  if (selected.length === 0) return { installed: [], skipped: [], lessonsAdded: [] }

  const existing = await db
    .select({ id: trainingCourses.id, libraryKey: trainingCourses.libraryKey, lesson: trainingCourses.lesson })
    .from(trainingCourses)
    .where(and(
      eq(trainingCourses.orgId, orgId),
      inArray(trainingCourses.libraryKey, selected.map((c) => c.key))
    ))
  const existingByKey = new Map(existing.map((e) => [e.libraryKey, e]))

  const result: InstallLibraryResult = { installed: [], skipped: [], lessonsAdded: [] }

  for (const course of selected) {
    const installedCourse = existingByKey.get(course.key)
    if (installedCourse) {
      // Starter courses installed before lessons existed used an external video
      if (!installedCourse.lesson || options.refreshLessons) {
        await db
          .update(trainingCourses)
          .set({
            lesson: course.lesson,
            videoUrl: null,
            videoDurationMinutes: estimateLessonMinutes(course.lesson),
            updatedAt: new Date(),
          })
          .where(and(
            eq(trainingCourses.id, installedCourse.id),
            options.refreshLessons ? undefined : isNull(trainingCourses.lesson)
          ))
        result.lessonsAdded.push(course.key)
      }
      result.skipped.push(course.key)
      continue
    }

    await db.transaction(async (tx) => {
      const [created] = await tx.insert(trainingCourses).values({
        orgId,
        libraryKey: course.key,
        title: course.title,
        description: course.description,
        category: course.category,
        lesson: course.lesson,
        videoDurationMinutes: estimateLessonMinutes(course.lesson),
        passingScore: course.passingScore,
        status: "published",
        createdById,
      }).returning({ id: trainingCourses.id, title: trainingCourses.title })

      await tx.insert(trainingQuestions).values(
        course.questions.map((q, index) => ({
          courseId: created.id,
          question: q.question,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation,
          sortOrder: index,
        }))
      )

      result.installed.push(created)
    })
  }

  return result
}
