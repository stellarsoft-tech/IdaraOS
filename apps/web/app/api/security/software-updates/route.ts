/**
 * Software Updates API
 * GET /api/security/software-updates - Devices running the IdaraOS Updater, schedule, and the update package list
 */

import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, softwareUpdateDevices, users } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { nextScheduledRun } from "@/lib/security/software"
import { ensureDefaultCatalog, getSoftwareUpdateSettings, getUpdatePackages } from "@/lib/security/software-server"
import { scheduleFromSettings } from "@/lib/security/software-updates-server"
import { getReleasedAgent } from "@/lib/security/agent-release"
import { isAgentVersionOlder } from "@/lib/security/device-policies"

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
          linkedUserName: users.name,
        })
        .from(softwareUpdateDevices)
        .leftJoin(assets, eq(softwareUpdateDevices.assetId, assets.id))
        .leftJoin(users, eq(softwareUpdateDevices.userId, users.id))
        .where(eq(softwareUpdateDevices.orgId, session.orgId))
        .orderBy(asc(softwareUpdateDevices.hostname)),
    ])

    const now = new Date()
    const offlineAfterMs = Math.max(settings.checkInMinutes * 4, 24 * 60) * 60_000
    const released = await getReleasedAgent()
    const releasedAgentVersion = released?.version ?? null

    const data = devices.map(({ device, assetName, assetTag, linkedUserName }) => {
      const { secretHash: _s, ...rest } = device
      const isAgent = !!device.machineId && !device.entraDeviceId
      return {
        ...rest,
        assetName,
        assetTag,
        linkedUserName,
        offline: !device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > offlineAfterMs,
        // Agent devices behind the version this server ships can self-update
        agentUpdateAvailable:
          isAgent && releasedAgentVersion != null && isAgentVersionOlder(device.updaterVersion, releasedAgentVersion),
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
        agentAutoUpdate: settings.agentAutoUpdate,
        releasedAgentVersion,
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
