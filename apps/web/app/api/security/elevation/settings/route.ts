/**
 * Admin Access Settings API
 * GET   /api/security/elevation/settings - Current settings (webhook URL is never returned)
 * PATCH /api/security/elevation/settings - Update settings
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { elevationSettings, type ElevationSettings } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { encrypt } from "@/lib/encryption"
import { MAX_GRANT_MINUTES, normalizeDurationOptions } from "@/lib/security/elevation"
import { getElevationSettings } from "@/lib/security/elevation-server"

const updateSettingsSchema = z.object({
  durationOptions: z.array(z.number().int().min(1).max(MAX_GRANT_MINUTES)).min(1).max(12).optional(),
  maxMinutes: z.number().int().min(5).max(MAX_GRANT_MINUTES).optional(),
  requireReason: z.boolean().optional(),
  credentialModeEnabled: z.boolean().optional(),
  requireRecentAuth: z.boolean().optional(),
  recentAuthMinutes: z.number().int().min(1).max(120).optional(),
  maxRevealsPerGrant: z.number().int().min(1).max(20).optional(),
  // null clears the webhook; omit to keep it
  teamsWebhookUrl: z
    .string()
    .trim()
    .url("Webhook must be a valid URL")
    .refine((u) => u.startsWith("https://"), "Webhook must use https")
    .nullable()
    .optional(),
})

function toResponse(settings: ElevationSettings) {
  const { teamsWebhookUrlEncrypted, ...rest } = settings
  return { ...rest, teamsWebhookConfigured: !!teamsWebhookUrlEncrypted }
}

export async function GET() {
  try {
    const session = await requirePermission(...P.security.elevationSettings.view())
    const settings = await getElevationSettings(session.orgId)
    return NextResponse.json({ data: toResponse(settings) })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching admin access settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.elevationSettings.edit())

    const parsed = updateSettingsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const { teamsWebhookUrl, durationOptions, ...fields } = parsed.data

    const existing = await getElevationSettings(session.orgId)
    const maxMinutes = fields.maxMinutes ?? existing.maxMinutes
    const options = normalizeDurationOptions(durationOptions ?? existing.durationOptions, maxMinutes)
    if (options.length === 0) {
      return NextResponse.json(
        { error: "At least one duration must be within the maximum duration" },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(elevationSettings)
      .set({
        ...fields,
        durationOptions: options,
        ...(teamsWebhookUrl !== undefined && {
          teamsWebhookUrlEncrypted: teamsWebhookUrl ? encrypt(teamsWebhookUrl) : null,
        }),
        updatedById: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(elevationSettings.id, existing.id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.elevation",
        "elevation_settings",
        updated.id,
        "Admin access settings",
        toResponse(existing) as unknown as Record<string, unknown>,
        toResponse(updated) as unknown as Record<string, unknown>
      )
    }

    return NextResponse.json({ data: toResponse(updated) })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating admin access settings:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
