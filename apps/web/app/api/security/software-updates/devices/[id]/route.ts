/**
 * Device detail
 * GET /api/security/software-updates/devices/<id> - one device's details + per-policy compliance
 */

import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, softwareUpdateDevices, users } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getSoftwareUpdateSettings } from "@/lib/security/software-server"
import { getReleasedAgent } from "@/lib/security/agent-release"
import { isAgentVersionOlder } from "@/lib/security/device-policies"
import { getDevicePolicyCompliance } from "@/lib/security/policy-server"
import { getPendingWipe } from "@/lib/security/agent-server"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const { id } = await context.params

    const [row] = await db
      .select({
        device: softwareUpdateDevices,
        assetName: assets.name,
        assetTag: assets.assetTag,
        linkedUserName: users.name,
      })
      .from(softwareUpdateDevices)
      .leftJoin(assets, eq(softwareUpdateDevices.assetId, assets.id))
      .leftJoin(users, eq(softwareUpdateDevices.userId, users.id))
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!row) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const { device, assetName, assetTag, linkedUserName } = row
    const settings = await getSoftwareUpdateSettings(session.orgId)
    const released = await getReleasedAgent()
    const now = new Date()
    const offlineAfterMs = Math.max(settings.checkInMinutes * 4, 24 * 60) * 60_000
    const isAgent = !!device.machineId && !device.entraDeviceId
    const { secretHash: _s, ...rest } = device

    const data = {
      ...rest,
      assetName,
      assetTag,
      linkedUserName,
      offline: !device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > offlineAfterMs,
      agentUpdateAvailable:
        isAgent && released?.version != null && isAgentVersionOlder(device.updaterVersion, released.version),
    }

    const compliance = await getDevicePolicyCompliance(device)

    // Internet-access / quarantine status. 'applying' = the admin locked it (or the grace period
    // elapsed) but the agent hasn't yet confirmed it blocked the internet; 'quarantined' = the agent
    // confirmed (quarantinedAt is set only on the agent's report, not on the lock request).
    const nonCompliant = compliance.some((c) => c.status === "error" || c.status === "pending")
    const graceMs = settings.quarantineGraceDays * 86_400_000
    const autoQuarantine =
      settings.quarantineEnabled &&
      nonCompliant &&
      !!device.nonCompliantSince &&
      now.getTime() - device.nonCompliantSince.getTime() >= graceMs
    const quarantineDesired = device.quarantineManual || autoQuarantine
    const appliedConfirmed = !!device.quarantinedAt
    let internetStatus: "compliant" | "grace" | "applying" | "quarantined" = "compliant"
    let graceEndsAt: string | null = null
    if (quarantineDesired && appliedConfirmed) {
      internetStatus = "quarantined"
    } else if (quarantineDesired) {
      internetStatus = "applying"
    } else if (nonCompliant && device.nonCompliantSince) {
      internetStatus = "grace"
      graceEndsAt = new Date(device.nonCompliantSince.getTime() + graceMs).toISOString()
    }
    const internet = {
      status: internetStatus,
      manual: device.quarantineManual,
      quarantineEnabled: settings.quarantineEnabled,
      graceDays: settings.quarantineGraceDays,
      nonCompliantSince: device.nonCompliantSince?.toISOString() ?? null,
      graceEndsAt,
      hasIp: !!device.lastPublicIp,
    }

    const pendingWipe = isAgent ? await getPendingWipe(device) : null

    return NextResponse.json({ data, compliance, internet, pendingWipe })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching device:", error)
    return NextResponse.json({ error: "Failed to fetch the device" }, { status: 500 })
  }
}
