/**
 * Device Actions API (IdaraOS Agent)
 * GET  /api/security/software-updates/devices/[id]/action - recent action jobs for the device
 * POST /api/security/software-updates/devices/[id]/action - queue one allowlisted action
 *
 * The body names an action KEY from the allowlist (lib/security/device-actions.ts) and, for
 * actions that take one, a parameter from that action's fixed options. No command is accepted.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateDevices } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { listDeviceActionJobs, queueDeviceAction } from "@/lib/security/agent-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const actionSchema = z.object({
  action: z.string().trim().min(1).max(64),
  param: z.string().trim().max(64).optional().nullable(),
})

async function loadDevice(id: string, orgId: string) {
  const [device] = await db
    .select()
    .from(softwareUpdateDevices)
    .where(and(eq(softwareUpdateDevices.id, id), eq(softwareUpdateDevices.orgId, orgId)))
    .limit(1)
  return device ?? null
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.view())
    const { id } = await context.params

    const device = await loadDevice(id, session.orgId)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

    const jobs = await listDeviceActionJobs(device)
    return NextResponse.json({ data: jobs })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing device actions:", error)
    return NextResponse.json({ error: "Failed to list device actions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const { id } = await context.params

    const parsed = actionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const device = await loadDevice(id, session.orgId)
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
    if (device.status !== "active") {
      return NextResponse.json({ error: "This device was revoked" }, { status: 409 })
    }
    // Device actions are an IdaraOS Agent feature. Agent devices enroll with a MachineGuid and
    // no Entra device ID; Intune devices (which have one) can't run these actions.
    if (device.entraDeviceId || !device.machineId) {
      return NextResponse.json({ error: "Device actions are only for IdaraOS Agent devices" }, { status: 409 })
    }

    const result = await queueDeviceAction(device, parsed.data.action, parsed.data.param ?? null)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: "device_action_queued",
        entityType: "software_update_device",
        entityId: id,
        entityName: device.hostname,
        description: `Queued "${result.actionName}"${parsed.data.param ? ` (${parsed.data.param})` : ""} on ${device.hostname}`,
      })
    }

    return NextResponse.json({ data: { id: result.jobId } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error queueing device action:", error)
    return NextResponse.json({ error: "Failed to queue the action" }, { status: 500 })
  }
}
