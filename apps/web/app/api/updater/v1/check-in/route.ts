/**
 * IdaraOS Updater - Check-in
 * POST /api/updater/v1/check-in - Heartbeat; returns an update run when one is due, and any agent jobs
 *
 * Auth: `Authorization: Bearer <deviceId>.<deviceSecret>`. Excluded from session auth in middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { getSoftwareUpdateSettings } from "@/lib/security/software-server"
import { authenticateDevice, dispatchRunIfDue } from "@/lib/security/software-updates-server"
import { dispatchJobs } from "@/lib/security/agent-server"
import { getEffectivePolicies, recordBitlockerKeys, recordDevicePolicyState } from "@/lib/security/policy-server"
import { expireDueGrants, getElevationSettings, requestDueAgentRotations, verifyAgentRotations } from "@/lib/security/elevation-server"
import { getAdminCredentialSignal, recordAdminCredential } from "@/lib/security/admin-credential-server"
import { getReleasedAgent } from "@/lib/security/agent-release"
import { isAgentVersionOlder, WEB_FILTERING_TYPE } from "@/lib/security/device-policies"
import { getFilterListManifest } from "@/lib/security/filter-lists"
import { getActiveWebAccessDomains } from "@/lib/security/web-access-server"

const checkInSchema = z.object({
  hostname: z.string().trim().min(1).max(63).optional(),
  osVersion: z.string().trim().max(100).optional().nullable(),
  updaterVersion: z.string().trim().max(32).optional().nullable(),
  wingetVersion: z.string().trim().max(32).optional().nullable(),
  // Error the device hit outside a run (winget missing, previous upload failed, ...)
  lastError: z.string().max(2000).optional().nullable(),
  // Windows user signed in at the console (DOMAIN\user), if any
  loggedOnUser: z.string().trim().max(256).optional().nullable(),
  // What the agent applied for each effective policy last cycle (type from the allowlist)
  policyResults: z
    .array(
      z.object({
        type: z.string().trim().max(64),
        ok: z.boolean(),
        message: z.string().max(2000).optional().nullable(),
        state: z.record(z.unknown()).optional(),
      })
    )
    .max(20)
    .optional(),
  // BitLocker recovery keys escrowed by the bitlocker policy (secret, encrypted at rest on arrival)
  bitlocker: z
    .array(
      z.object({
        volume: z.string().trim().min(1).max(16),
        recoveryKeyId: z.string().trim().max(64).optional().nullable(),
        recoveryKey: z.string().trim().min(1).max(256),
        encryptionMethod: z.string().trim().max(32).optional().nullable(),
        protectionOn: z.boolean().optional(),
        encryptionPercentage: z.number().optional().nullable(),
      })
    )
    .max(16)
    .optional(),
  // Managed local admin account the agent rotates + escrows (agent provider). password is a secret,
  // encrypted at rest on arrival; status says whether the rotation actually happened.
  adminCredential: z
    .object({
      account: z.string().trim().max(64).optional().nullable(),
      password: z.string().max(256).optional().nullable(),
      rotatedAt: z.string().trim().max(40).optional().nullable(),
      status: z.enum(["ok", "missing", "error"]),
      error: z.string().max(2000).optional().nullable(),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request.headers.get("authorization"))
    if (!device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = checkInSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid check-in" }, { status: 400 })
    }
    const body = parsed.data

    const now = new Date()
    const [updatedDevice] = await db
      .update(softwareUpdateDevices)
      .set({
        lastSeenAt: now,
        ...(body.hostname && { hostname: body.hostname }),
        ...(body.osVersion !== undefined && { osVersion: body.osVersion }),
        ...(body.updaterVersion !== undefined && { updaterVersion: body.updaterVersion }),
        ...(body.wingetVersion !== undefined && { wingetVersion: body.wingetVersion }),
        ...(body.lastError !== undefined && { lastError: body.lastError }),
        // Keep the last known user when nobody is signed in
        ...(body.loggedOnUser && { lastLoggedOnUser: body.loggedOnUser }),
        updatedAt: now,
      })
      .where(eq(softwareUpdateDevices.id, device.id))
      .returning()

    // Record what the agent applied for each policy last cycle
    if (body.policyResults?.length) {
      await recordDevicePolicyState(updatedDevice, body.policyResults, now)
    }
    // Escrow any BitLocker recovery keys the agent reported (encrypted at rest before storage)
    if (body.bitlocker?.length) {
      await recordBitlockerKeys(updatedDevice, body.bitlocker, now)
    }
    // Escrow the managed local admin password the agent rotated (encrypted at rest). A fresh password
    // confirms any grant that was waiting on this device's rotation.
    if (body.adminCredential) {
      const { rotatedAt } = await recordAdminCredential(updatedDevice, body.adminCredential, now)
      if (rotatedAt) {
        // A genuinely fresh rotation was escrowed, so confirm any grant awaiting it
        await verifyAgentRotations(updatedDevice.id, now)
      }
    }

    const settings = await getSoftwareUpdateSettings(device.orgId)
    const run = await dispatchRunIfDue(updatedDevice, settings, now)
    const jobs = await dispatchJobs(updatedDevice, now)
    const policies = await getEffectivePolicies(updatedDevice)

    // Web filtering: advertise the SHA-256 of each selected category list so the agent re-downloads
    // only the lists that changed since it last applied them. The list contents are fetched from
    // /api/updater/v1/filter-list/<category>; the settings themselves ride in `policies`.
    let webFilteringLists: Array<{ category: string; sha256: string }> = []
    const webPolicy = policies.find((p) => p.type === WEB_FILTERING_TYPE)
    const webCategories = webPolicy?.settings.categories
    if (Array.isArray(webCategories) && webCategories.length > 0) {
      webFilteringLists = await getFilterListManifest(webCategories)
    }
    // Merge the member's live website-access exceptions into the effective allowlist: an approved
    // request unblocks that site until it expires, after which it drops out and the agent re-blocks.
    if (webPolicy && updatedDevice.userId) {
      const exceptions = await getActiveWebAccessDomains(device.orgId, updatedDevice.userId, now)
      if (exceptions.length > 0) {
        const current = Array.isArray(webPolicy.settings.allowlist) ? webPolicy.settings.allowlist : []
        webPolicy.settings.allowlist = [...new Set([...current, ...exceptions])]
      }
    }

    // Tell the agent whether to manage (rotate + escrow) the local admin account this cycle
    const elevationSettings = await getElevationSettings(device.orgId)
    // Rotate the managed admin password promptly when a session ends: expire any due grants and
    // request a rotation for this device now, so it happens on this check-in instead of waiting for
    // the next periodic sweep. The sweep still backstops offline devices.
    if (elevationSettings.manageAgentAdmin) {
      await expireDueGrants(now, device.orgId)
      await requestDueAgentRotations(updatedDevice.id, now)
    }
    const adminCredential = await getAdminCredentialSignal(updatedDevice, {
      manageAgentAdmin: elevationSettings.manageAgentAdmin,
      agentAdminAccount: elevationSettings.agentAdminAccount,
    })

    // Agent self-update: offer the shipped version when this device is behind and either an admin
    // asked it to update or auto-update is on. The agent only ever moves to the server's own script.
    let agentUpdate: { version: string; sha256: string } | null = null
    const released = await getReleasedAgent()
    if (released) {
      const behind = isAgentVersionOlder(updatedDevice.updaterVersion, released.version)
      const wanted = settings.agentAutoUpdate || updatedDevice.agentUpdateRequestedAt != null
      if (behind && wanted) {
        agentUpdate = { version: released.version, sha256: released.sha256 }
      } else if (!behind && updatedDevice.agentUpdateRequestedAt) {
        // The device reached the shipped version - clear the pending request
        await db
          .update(softwareUpdateDevices)
          .set({ agentUpdateRequestedAt: null, updatedAt: now })
          .where(eq(softwareUpdateDevices.id, updatedDevice.id))
      }
    }

    return NextResponse.json({
      checkInMinutes: settings.checkInMinutes,
      run,
      jobs,
      policies,
      agentUpdate,
      adminCredential,
      webFilteringLists,
    })
  } catch (error) {
    console.error("[Updater] Check-in failed:", error)
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 })
  }
}
