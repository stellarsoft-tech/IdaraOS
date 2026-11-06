/**
 * Managed local admin credential escrowed for one device
 * GET /api/security/software-updates/devices/[id]/admin-credential
 *
 * Returns the escrow status (account name, whether a password is held, last rotation) WITHOUT the
 * password. The password itself is handed back only by the audited reveal endpoint. Also reports
 * whether a real ENCRYPTION_KEY is set, so the UI can warn when escrow is only weakly protected.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getAdminCredentialView } from "@/lib/security/admin-credential-server"
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

    const view = await getAdminCredentialView(device)
    return NextResponse.json({ data: view, encryptionKeyConfigured: isEncryptionKeyConfigured() })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error loading admin credential:", error)
    return NextResponse.json({ error: "Failed to load the admin password" }, { status: 500 })
  }
}
