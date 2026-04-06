/**
 * Documentation Settings API
 * GET  /api/docs/settings - Get current settings (creates defaults if none exist)
 * PUT  /api/docs/settings - Update settings
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { documentSettings } from "@/lib/db/schema"
import { requirePermission } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"
import { contentStorageModeValues, rolloutRequirementValues } from "@/lib/db/schema/docs"

const UpdateSettingsSchema = z.object({
  contentStorageMode: z.enum(contentStorageModeValues).optional(),
  defaultFileCategoryId: z.string().uuid().nullable().optional(),
  defaultReviewFrequencyDays: z.coerce.number().int().positive().optional(),
  defaultRequirement: z.enum(rolloutRequirementValues).optional(),
  enableEmailNotifications: z.boolean().optional(),
  reminderDaysBefore: z.coerce.number().int().positive().optional(),
  footerText: z.string().optional().nullable(),
  settings: z
    .object({
      requireApprovalForPublish: z.boolean().optional(),
      enableVersionSnapshots: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
})

export async function GET() {
  try {
    const session = await requirePermission(...P.docs.documents.view())

    let [settings] = await db
      .select()
      .from(documentSettings)
      .where(eq(documentSettings.orgId, session.orgId))
      .limit(1)

    if (!settings) {
      ;[settings] = await db
        .insert(documentSettings)
        .values({ orgId: session.orgId })
        .returning()
    }

    return NextResponse.json({ data: settings })
  } catch (error) {
    console.error("Error fetching docs settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch documentation settings" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission(...P.docs.documents.view())

    const body = await request.json()
    const parseResult = UpdateSettingsSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    let [existing] = await db
      .select()
      .from(documentSettings)
      .where(eq(documentSettings.orgId, session.orgId))
      .limit(1)

    if (!existing) {
      ;[existing] = await db
        .insert(documentSettings)
        .values({ orgId: session.orgId })
        .returning()
    }

    const mergedSettings = {
      ...((existing.settings as Record<string, unknown>) || {}),
      ...(data.settings || {}),
    }

    const [updated] = await db
      .update(documentSettings)
      .set({
        ...(data.contentStorageMode !== undefined && {
          contentStorageMode: data.contentStorageMode,
        }),
        ...(data.defaultFileCategoryId !== undefined && {
          defaultFileCategoryId: data.defaultFileCategoryId,
        }),
        ...(data.defaultReviewFrequencyDays !== undefined && {
          defaultReviewFrequencyDays: data.defaultReviewFrequencyDays,
        }),
        ...(data.defaultRequirement !== undefined && {
          defaultRequirement: data.defaultRequirement,
        }),
        ...(data.enableEmailNotifications !== undefined && {
          enableEmailNotifications: data.enableEmailNotifications,
        }),
        ...(data.reminderDaysBefore !== undefined && {
          reminderDaysBefore: data.reminderDaysBefore,
        }),
        ...(data.footerText !== undefined && {
          footerText: data.footerText,
        }),
        settings: mergedSettings,
        updatedAt: new Date(),
      })
      .where(eq(documentSettings.id, existing.id))
      .returning()

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating docs settings:", error)
    return NextResponse.json(
      { error: "Failed to update documentation settings" },
      { status: 500 }
    )
  }
}
