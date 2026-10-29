/**
 * Intune Apps API
 * GET /api/security/software/intune-apps?search= - Windows apps in Intune with their assignment groups
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { IntuneError, listIntuneApps } from "@/lib/security/software-intune"

export async function GET(request: NextRequest) {
  try {
    await requirePermission(...P.security.software.edit())
    const search = request.nextUrl.searchParams.get("search") ?? undefined
    const apps = await listIntuneApps(search)
    return NextResponse.json({ data: apps })
  } catch (error) {
    if (error instanceof IntuneError) {
      const status = error.code === "not_configured" ? 503 : error.code === "forbidden" ? 403 : 502
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing Intune apps:", error)
    return NextResponse.json({ error: "Failed to list Intune apps" }, { status: 500 })
  }
}
