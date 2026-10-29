/**
 * Software Update Schedule API
 * PATCH /api/security/software-updates/settings - Update the schedule that applies to every device
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateSettings } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { SCHEDULE_TIME_PATTERN, isValidTimeZone } from "@/lib/security/software"
import { getSoftwareUpdateSettings } from "@/lib/security/software-server"

const updateSchema = z.object({
  scheduleEnabled: z.boolean().optional(),
  scheduleDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  scheduleTime: z.string().regex(SCHEDULE_TIME_PATTERN, "Time must be HH:mm").optional(),
  scheduleTimezone: z.string().refine(isValidTimeZone, "Unknown time zone").optional(),
  checkInMinutes: z.number().int().min(5).max(240).optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())

    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }
    const fields = parsed.data
    const existing = await getSoftwareUpdateSettings(session.orgId)

    const days = fields.scheduleDays ? [...new Set(fields.scheduleDays)].sort() : existing.scheduleDays
    if ((fields.scheduleEnabled ?? existing.scheduleEnabled) && days.length === 0) {
      return NextResponse.json({ error: "Pick at least one day for the schedule" }, { status: 400 })
    }

    const [updated] = await db
      .update(softwareUpdateSettings)
      .set({ ...fields, scheduleDays: days, updatedById: session.userId, updatedAt: new Date() })
      .where(eq(softwareUpdateSettings.id, existing.id))
      .returning()

    const pick = (s: typeof existing) => ({
      scheduleEnabled: s.scheduleEnabled,
      scheduleDays: s.scheduleDays,
      scheduleTime: s.scheduleTime,
      scheduleTimezone: s.scheduleTimezone,
      checkInMinutes: s.checkInMinutes,
    })
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.software-updates",
        "software_update_settings",
        updated.id,
        "Software update schedule",
        pick(existing),
        pick(updated)
      )
    }

    return NextResponse.json({ data: pick(updated) })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error updating software update schedule:", error)
    return NextResponse.json({ error: "Failed to update the schedule" }, { status: 500 })
  }
}
