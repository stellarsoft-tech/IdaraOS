/**
 * Run Updates On All Devices API
 * POST /api/security/software-updates/run-all - Every active device runs updates at its next check-in
 */

import { NextResponse } from "next/server"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { requestRunNow } from "@/lib/security/software-updates-server"

export async function POST() {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const count = await requestRunNow(session.orgId, session.userId)

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "run_now",
        entityType: "software_update_device",
        description: `Requested updates on all devices (${count})`,
      })
    }

    return NextResponse.json({ data: { count } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error requesting updates on all devices:", error)
    return NextResponse.json({ error: "Failed to request updates" }, { status: 500 })
  }
}
