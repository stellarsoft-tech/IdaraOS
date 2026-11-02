/**
 * Link Device API
 * POST /api/security/my-elevation/link - Enter the code shown by the IdaraOS Agent to link that device to me
 *
 * The device is enrolled for the signed-in member and linked to their asset (found by serial number, or created).
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { MAX_LINK_ATTEMPTS_PER_WINDOW, PAIRING_TTL_MINUTES, normalizeUserCode } from "@/lib/security/agent"
import { linkPairing } from "@/lib/security/agent-server"

const linkSchema = z.object({
  code: z.string().trim().min(1, "Enter the code shown on the device").max(20),
})

// Best-effort, per instance: codes are 8 characters from 27, so this only slows down typos-in-a-loop
const failedAttempts = new Map<string, number[]>()

function tooManyAttempts(userId: string, now: number): boolean {
  const windowStart = now - PAIRING_TTL_MINUTES * 60_000
  const recent = (failedAttempts.get(userId) ?? []).filter((t) => t > windowStart)
  failedAttempts.set(userId, recent)
  return recent.length >= MAX_LINK_ATTEMPTS_PER_WINDOW
}

function recordFailure(userId: string, now: number) {
  failedAttempts.set(userId, [...(failedAttempts.get(userId) ?? []), now])
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(...P.security.myElevation.create())
    const now = Date.now()

    if (tooManyAttempts(session.userId, now)) {
      return NextResponse.json({ error: "Too many wrong codes. Wait a few minutes and try again." }, { status: 429 })
    }

    const parsed = linkSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid code" }, { status: 400 })
    }
    const userCode = normalizeUserCode(parsed.data.code)
    if (!userCode) {
      recordFailure(session.userId, now)
      return NextResponse.json({ error: "Codes look like KFJD-7QWX. Check the code on the device." }, { status: 400 })
    }

    const result = await linkPairing({ userCode, orgId: session.orgId, userId: session.userId }, new Date(now))
    if (!result.ok) {
      if (result.code === "invalid_code") recordFailure(session.userId, now)
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "agent_link",
        entityType: "software_update_device",
        entityId: result.device.id,
        entityName: result.device.hostname,
        description: `Linked ${result.device.hostname} to the IdaraOS Agent${result.assetCreated ? " (new asset created)" : ""}`,
      })
    }

    return NextResponse.json({
      data: { deviceId: result.device.id, hostname: result.device.hostname, assetId: result.assetId, assetCreated: result.assetCreated },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error linking device:", error)
    return NextResponse.json({ error: "Failed to link the device" }, { status: 500 })
  }
}
