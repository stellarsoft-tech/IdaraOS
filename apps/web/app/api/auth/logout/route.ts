/**
 * Logout API Route
 * POST /api/auth/logout - Clear session and log out user
 */

import { NextResponse } from "next/server"
import { clearSession } from "@/lib/auth/session"

export async function POST() {
  try {
    await clearSession()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { error: "An error occurred during logout" },
      { status: 500 }
    )
  }
}

