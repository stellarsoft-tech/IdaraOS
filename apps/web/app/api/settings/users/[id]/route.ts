/**
 * User Detail API Routes
 * GET /api/settings/users/[id] - Get user by ID
 * PUT /api/settings/users/[id] - Update user
 * DELETE /api/settings/users/[id] - Delete user
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, userRoleValues, userStatusValues } from "@/lib/db/schema"
import { z } from "zod"

// TODO: Get orgId from authenticated session
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

// Update user schema
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(userRoleValues).optional(),
  status: z.enum(userStatusValues).optional(),
  personId: z.string().uuid().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
})

function toApiResponse(record: typeof users.$inferSelect) {
  return {
    id: record.id,
    orgId: record.orgId,
    personId: record.personId,
    email: record.email,
    name: record.name,
    avatar: record.avatar,
    role: record.role,
    status: record.status,
    lastLoginAt: record.lastLoginAt?.toISOString(),
    invitedAt: record.invitedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/settings/users/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const [record] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.orgId, DEMO_ORG_ID)))
      .limit(1)

    if (!record) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(toApiResponse(record))
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

/**
 * PUT /api/settings/users/[id]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    // Validate
    const parseResult = UpdateUserSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // Update user
    const [record] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.orgId, DEMO_ORG_ID)))
      .returning()

    if (!record) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(toApiResponse(record))
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/users/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const result = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.orgId, DEMO_ORG_ID)))
      .returning({ id: users.id })

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

