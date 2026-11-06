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

    // Internet-access / quarantine status (derived from compliance + settings + device flags)
    const nonCompliant = compliance.some((c) => c.status === "error" || c.status === "pending")
    const quarantined = !!device.quarantinedAt || device.quarantineManual
    let internetStatus: "compliant" | "grace" | "quarantined" = "compliant"
    let graceEndsAt: string | null = null
    if (quarantined) {
      internetStatus = "quarantined"
    } else if (nonCompliant && device.nonCompliantSince) {
      internetStatus = "grace"
      graceEndsAt = new Date(
        device.nonCompliantSince.getTime() + settings.quarantineGraceDays * 86_400_000
      ).toISOString()
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

    return NextResponse.json({ data, compliance, internet })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching device:", error)
    return NextResponse.json({ error: "Failed to fetch the device" }, { status: 500 })
  }
}
