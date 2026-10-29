/**
 * Admin Access Sweep (scheduled job)
 * POST /api/internal/elevation/sweep - Expire ended grants, request and verify LAPS rotations
 *
 * Call every minute with header `x-internal-secret: $INTERNAL_CRON_SECRET`.
 * Excluded from session auth in middleware.ts.
 */

import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { runElevationSweep } from "@/lib/security/elevation-server"

function isAuthorized(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "INTERNAL_CRON_SECRET is not configured" }, { status: 503 })
  }
  if (!isAuthorized(request.headers.get("x-internal-secret"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runElevationSweep()
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error("[Elevation] Sweep failed:", error)
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 })
  }
}
