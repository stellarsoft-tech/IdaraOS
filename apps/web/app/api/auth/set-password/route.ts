/**
 * Set Password API Route
 * POST /api/auth/set-password - Set or update user password
 * 
 * SECURITY: This endpoint requires either:
 * 1. A valid invitation token for initial password setup (for "invited" users)
 * 2. Authentication + current password for password changes
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { hashPassword, verifyPassword, getSession } from "@/lib/auth/session"
import { z } from "zod"
import crypto from "crypto"

// Schema for initial password setup (invited users with token)
const InitialSetPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  token: z.string().min(1, "Invitation token is required"),
})

// Schema for authenticated password change
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
})

/**
 * Verify invitation token - uses HMAC with user ID and invited timestamp
 * Token format: userId:timestamp:hmac
 */
function verifyInvitationToken(token: string, user: { id: string; invitedAt: Date | null }): boolean {
  if (!user.invitedAt) {
    return false
  }
  
  const secret = process.env.JWT_SECRET || "your-super-secret-key-change-in-production"
  const expectedData = `${user.id}:${user.invitedAt.getTime()}`
  const expectedHmac = crypto.createHmac("sha256", secret).update(expectedData).digest("hex")
  const expectedToken = `${user.id}:${user.invitedAt.getTime()}:${expectedHmac}`
  
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is an authenticated password change
    const session = await getSession()
    
    if (session) {
      // Authenticated password change flow
      const parseResult = ChangePasswordSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parseResult.error.flatten() },
          { status: 400 }
        )
      }
      
      const { currentPassword, newPassword } = parseResult.data
      
      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1)
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        )
      }
      
      // Verify current password
      if (!user.passwordHash) {
        return NextResponse.json(
          { error: "No password set for this account" },
          { status: 400 }
        )
      }
      
      const isValidPassword = await verifyPassword(currentPassword, user.passwordHash)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        )
      }
      
      // Hash and set new password
      const passwordHash = await hashPassword(newPassword)
      await db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
      
      return NextResponse.json({
        success: true,
        message: "Password changed successfully",
      })
    }
    
    // Unauthenticated flow - requires invitation token
    const parseResult = InitialSetPasswordSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input. Email, password, and invitation token are required.", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, token } = parseResult.data

    // Find user by email - must be in "invited" status
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.email, email.toLowerCase()),
        eq(users.status, "invited")
      ))
      .limit(1)

    if (!user) {
      // Use generic error to prevent email enumeration
      return NextResponse.json(
        { error: "Invalid invitation or user not found" },
        { status: 400 }
      )
    }
    
    // Verify the invitation token
    if (!verifyInvitationToken(token, user)) {
      return NextResponse.json(
        { error: "Invalid or expired invitation token" },
        { status: 401 }
      )
    }
    
    // Check if invitation is not too old (e.g., 7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
    if (user.invitedAt && Date.now() - user.invitedAt.getTime() > maxAge) {
      return NextResponse.json(
        { error: "Invitation has expired. Please request a new invitation." },
        { status: 401 }
      )
    }

    // Hash the password
    const passwordHash = await hashPassword(password)

    // Update user with password and activate
    await db
      .update(users)
      .set({
        passwordHash,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return NextResponse.json({
      success: true,
      message: "Password set successfully. You can now log in.",
    })
  } catch (error) {
    console.error("Set password error:", error)
    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 }
    )
  }
}

