/**
 * Login API Route
 * POST /api/auth/login - Authenticate user and create session
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { createSessionToken, setSessionCookie, hashPassword, verifyPassword } from "@/lib/auth/session"
import { z } from "zod"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parseResult = LoginSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid email or password format" },
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
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    // Check if user is active
    if (user.status !== "active") {
      if (user.status === "invited") {
        return NextResponse.json(
          { error: "Please set up your password first. Check your email for the invitation link." },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact an administrator." },
        { status: 401 }
      )
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Please set up your password first" },
        { status: 401 }
      )
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

    // Create session token
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
    })

    // Set session cookie
    await setSessionCookie(token)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    )
  }
}

