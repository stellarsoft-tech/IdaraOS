/**
 * Current User API Route
 * GET /api/auth/me - Get current authenticated user from session
 */

import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, organizations } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"

export async function GET() {
  try {
    // Get session from cookie
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Fetch fresh user data from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      )
    }

    // Check if user is still active
    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 401 }
      )
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      avatar: user.avatar,
      status: user.status,
    })
  } catch (error) {
    console.error("Error fetching current user:", error)
    return NextResponse.json(
      { error: "Failed to fetch current user" },
      { status: 500 }
    )
  }
}
