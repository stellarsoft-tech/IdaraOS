/**
 * Reveal the managed local admin password for a device (break-glass)
 * POST /api/security/software-updates/devices/[id]/admin-credential/reveal
 *
 * Decrypts and returns the device's escrowed local admin password so an admin can sign in locally -
 * e.g. when the device is offline or internet-quarantined and can't be reached any other way. This
 * hands back a secret, so it requires the edit permission and writes an audit-log entry on every
 * reveal. The password is returned with no-store and never cached.
 */

import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { revealAdminCredential } from "@/lib/security/admin-credential-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params

    const [device] = await db
      .select()
      .from(softwareUpdateDevices)
      .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, session.orgId)))
      .limit(1)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

    const revealed = await revealAdminCredential(session.orgId, id)
    if (!revealed) return NextResponse.json({ error: "No admin password escrowed for this device" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "admin_password_revealed",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Revealed the managed local admin password for ${device.hostname} (${revealed.accountName})`,
      })
    }

    return NextResponse.json(
      { data: { accountName: revealed.accountName, password: revealed.password } },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error revealing admin password:", error)
    return NextResponse.json({ error: "Failed to reveal the admin password" }, { status: 500 })
  }
}
