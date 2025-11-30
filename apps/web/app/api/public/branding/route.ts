/**
 * Public Branding API
 * GET /api/public/branding - Get public branding info (app name, logo)
 * 
 * This endpoint is public and doesn't require authentication.
 * It only returns minimal branding info for login/public pages.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { organizations } from "@/lib/db/schema"

export async function GET() {
  try {
    // Get the first organization (demo/single-tenant mode)
    const [org] = await db
      .select({
        appName: organizations.appName,
        logo: organizations.logo,
      })
      .from(organizations)
      .limit(1)

    if (!org) {
      return NextResponse.json({
        appName: "IdaraOS",
        logo: null,
      })
    }

    return NextResponse.json({
      appName: org.appName || "IdaraOS",
      logo: org.logo,
    })
  } catch (error) {
    console.error("Error fetching branding:", error)
    return NextResponse.json({
      appName: "IdaraOS",
      logo: null,
    })
  }
}

