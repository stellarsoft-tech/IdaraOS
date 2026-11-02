/**
 * IdaraOS Agent - Job result
 * POST /api/updater/v1/jobs/[id] - Report the result of a job (e.g. an approved install)
 *
 * Auth: `Authorization: Bearer <deviceId>.<deviceSecret>`. Excluded from session auth in middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { MAX_RUN_LOG_CHARS } from "@/lib/security/software"
import { authenticateDevice } from "@/lib/security/software-updates-server"
import { completeJob } from "@/lib/security/agent-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const reportSchema = z.object({
  // winget's exit code; null when the agent failed before running winget (see message)
  exitCode: z.number().int().optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  log: z.string().max(MAX_RUN_LOG_CHARS * 2).optional().nullable(),
})

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const device = await authenticateDevice(request.headers.get("authorization"))
    if (!device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const parsed = reportSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid job report" }, { status: 400 })
    }

    const result = await completeJob(device, id, parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ status: result.job.status })
  } catch (error) {
    console.error("[Agent] Job report failed:", error)
    return NextResponse.json({ error: "Job report failed" }, { status: 500 })
  }
}
