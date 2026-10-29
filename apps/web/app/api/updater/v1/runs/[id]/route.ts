/**
 * IdaraOS Updater - Run report
 * POST /api/updater/v1/runs/[id] - Report the results of a run (every package, including failures)
 *
 * Auth: `Authorization: Bearer <deviceId>.<deviceSecret>`. Excluded from session auth in middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { softwareUpdateOutcomeValues } from "@/lib/db/schema"
import { isValidWingetId, MAX_RUN_LOG_CHARS } from "@/lib/security/software"
import { authenticateDevice, completeRun } from "@/lib/security/software-updates-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

const version = z.string().trim().max(100).optional().nullable()

const reportSchema = z.object({
  results: z
    .array(
      z.object({
        wingetId: z.string().refine(isValidWingetId),
        name: z.string().max(200).optional(),
        outcome: z.enum(softwareUpdateOutcomeValues),
        fromVersion: version,
        toVersion: version,
        exitCode: z.number().int().optional().nullable(),
        rebootRequired: z.boolean().optional(),
        message: z.string().max(2000).optional().nullable(),
      })
    )
    .max(200),
  error: z.string().max(2000).optional().nullable(),
  // The device sends the tail; anything longer is cut on the server too
  log: z.string().max(MAX_RUN_LOG_CHARS * 2).optional().nullable(),
})

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const device = await authenticateDevice(request.headers.get("authorization"))
    if (!device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await context.params

    const parsed = reportSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid run report" }, { status: 400 })
    }

    const run = await completeRun(device, id, parsed.data)
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }
    return NextResponse.json({ status: run.status })
  } catch (error) {
    console.error("[Updater] Run report failed:", error)
    return NextResponse.json({ error: "Run report failed" }, { status: 500 })
  }
}
