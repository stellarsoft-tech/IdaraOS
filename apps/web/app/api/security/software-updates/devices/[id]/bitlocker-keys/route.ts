/**
 * BitLocker recovery keys escrowed for one device
 * GET /api/security/software-updates/devices/[id]/bitlocker-keys
 *
 * Lists the device's escrowed BitLocker volumes WITHOUT the recovery keys. The keys themselves are
 * handed back only by the audited reveal endpoint. Also reports whether a real ENCRYPTION_KEY is set.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { listBitlockerKeys } from "@/lib/security/policy-server"
import { isEncryptionKeyConfigured } from "@/lib/encryption"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const { id } = await context.params

    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

    const keys = await listBitlockerKeys(device)
    return NextResponse.json({ data: keys, encryptionKeyConfigured: isEncryptionKeyConfigured() })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing BitLocker keys:", error)
    return NextResponse.json({ error: "Failed to list recovery keys" }, { status: 500 })
  }
}
