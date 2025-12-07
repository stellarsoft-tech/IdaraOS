/**
 * Set Password API Route
 * POST /api/auth/set-password - Set or update user password
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { hashPassword } from "@/lib/auth/session"
import { z } from "zod"

const SetPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parseResult = SetPasswordSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password } = parseResult.data

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Hash the password
    const passwordHash = await hashPassword(password)

    // Update user with password and activate if invited
    await db
      .update(users)
      .set({
        passwordHash,
        status: user.status === "invited" ? "active" : user.status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return NextResponse.json({
      success: true,
      message: "Password set successfully",
    })
  } catch (error) {
    console.error("Set password error:", error)
    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 }
    )
  }
}

