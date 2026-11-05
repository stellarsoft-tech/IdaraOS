/**
 * Reveal one escrowed BitLocker recovery key
 * POST /api/security/software-updates/devices/[id]/bitlocker-keys/[keyId]/reveal
 *
 * Decrypts and returns a single recovery key. This hands back a secret, so it requires the edit
 * permission and writes an audit-log entry on every reveal.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { revealBitlockerKey } from "@/lib/security/policy-server"

interface RouteContext {
  params: Promise<{ id: string; keyId: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id, keyId } = await context.params

    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

    const revealed = await revealBitlockerKey(device, keyId)
    if (!revealed) return NextResponse.json({ error: "Recovery key not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "bitlocker_key_revealed",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Revealed the BitLocker recovery key for ${device.hostname} (${revealed.volume})`,
      })
    }

    return NextResponse.json({ data: { volume: revealed.volume, recoveryKey: revealed.recoveryKey } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error revealing BitLocker key:", error)
    return NextResponse.json({ error: "Failed to reveal the recovery key" }, { status: 500 })
  }
}
