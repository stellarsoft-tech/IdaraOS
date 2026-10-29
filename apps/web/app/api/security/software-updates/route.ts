/**
 * Software Updates API
 * GET /api/security/software-updates - Devices running the IdaraOS Updater, schedule, and the update package list
 */

import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { nextScheduledRun } from "@/lib/security/software"
import { ensureDefaultCatalog, getSoftwareUpdateSettings, getUpdatePackages } from "@/lib/security/software-server"
import { scheduleFromSettings } from "@/lib/security/software-updates-server"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    await ensureDefaultCatalog(session.orgId)

    const [settings, packages, devices] = await Promise.all([
      getSoftwareUpdateSettings(session.orgId),
      getUpdatePackages(session.orgId),
      db
        .select({
          device: softwareUpdateDevices,
          assetName: assets.name,
          assetTag: assets.assetTag,
        })
        .from(softwareUpdateDevices)
        .leftJoin(assets, eq(softwareUpdateDevices.assetId, assets.id))
        .where(eq(softwareUpdateDevices.orgId, session.orgId))
        .orderBy(asc(softwareUpdateDevices.hostname)),
    ])

    const now = new Date()
    const offlineAfterMs = Math.max(settings.checkInMinutes * 4, 24 * 60) * 60_000

    const data = devices.map(({ device, assetName, assetTag }) => {
      const { secretHash: _s, ...rest } = device
      return {
        ...rest,
        assetName,
        assetTag,
        offline: !device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > offlineAfterMs,
      }
    })

    return NextResponse.json({
      data,
      packages,
      settings: {
        scheduleEnabled: settings.scheduleEnabled,
        scheduleDays: settings.scheduleDays,
        scheduleTime: settings.scheduleTime,
        scheduleTimezone: settings.scheduleTimezone,
        checkInMinutes: settings.checkInMinutes,
        enrollmentTokenHint: settings.enrollmentTokenHint,
        enrollmentTokenCreatedAt: settings.enrollmentTokenCreatedAt,
        nextRunAt: nextScheduledRun(scheduleFromSettings(settings), now),
      },
      stats: {
        devices: data.filter((d) => d.status === "active").length,
        failing: data.filter((d) => d.status === "active" && (d.lastRunStatus === "failed" || d.lastRunStatus === "partial")).length,
        offline: data.filter((d) => d.status === "active" && d.offline).length,
      },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching software updates:", error)
    return NextResponse.json({ error: "Failed to fetch software updates" }, { status: 500 })
  }
}
