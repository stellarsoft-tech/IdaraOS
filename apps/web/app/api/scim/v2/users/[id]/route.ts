/**
 * SCIM v2 User Endpoint (by ID)
 * GET /api/scim/v2/Users/{id} - Get user
 * PUT /api/scim/v2/Users/{id} - Update user
 * PATCH /api/scim/v2/Users/{id} - Partial update user
 * DELETE /api/scim/v2/Users/{id} - Delete user
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { getEntraConfig } from "@/lib/auth/entra-config"
import { decrypt } from "@/lib/encryption"

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

/**
 * Verify SCIM authentication token
 */
async function verifyScimToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }

  const token = authHeader.substring(7)
  const config = await getEntraConfig()
  
  if (!config || !config.scimEnabled || !config.scimTokenEncrypted) {
    return false
  }

  try {
    const decryptedToken = decrypt(config.scimTokenEncrypted)
    return decryptedToken === token
  } catch {
    return false
  }
}

/**
 * Convert database user to SCIM format
 */
function toScimUser(user: typeof users.$inferSelect) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: user.id,
    externalId: user.entraId || undefined,
    userName: user.email,
    name: {
      formatted: user.name || user.email,
      givenName: user.name?.split(" ")[0] || undefined,
      familyName: user.name?.split(" ").slice(1).join(" ") || undefined,
    },
    displayName: user.name || user.email,
    emails: [
      {
        value: user.email,
        type: "work",
        primary: true,
      },
    ],
    active: user.status === "active",
    meta: {
      resourceType: "User",
      created: user.createdAt?.toISOString(),
      lastModified: user.updatedAt?.toISOString(),
    },
  }
}

/**
 * GET /api/scim/v2/Users/{id} - Get user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        eq(users.orgId, DEMO_ORG_ID)
      ))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { detail: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(toScimUser(user))
  } catch (error) {
    console.error("SCIM GET User error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/scim/v2/Users/{id} - Update user (full replace)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const displayName = body.displayName || body.name?.formatted
    const active = body.active !== false

    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        eq(users.orgId, DEMO_ORG_ID)
      ))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { detail: "User not found" },
        { status: 404 }
      )
    }

    // Update user
    const [updated] = await db
      .update(users)
      .set({
        name: displayName || user.name,
        status: active ? "active" : "invited",
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    return NextResponse.json(toScimUser(updated))
  } catch (error) {
    console.error("SCIM PUT User error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/scim/v2/Users/{id} - Partial update user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        eq(users.orgId, DEMO_ORG_ID)
      ))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { detail: "User not found" },
        { status: 404 }
      )
    }

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    }

    // Process PATCH operations
    if (body.Operations) {
      for (const op of body.Operations) {
        if (op.op === "replace") {
          if (op.path === "active" || op.value?.active !== undefined) {
            const active = op.value?.active ?? op.value
            updates.status = active ? "active" : "invited"
          }
          if (op.path === "displayName" || op.value?.displayName) {
            updates.name = op.value?.displayName || op.value
          }
          if (op.path === "name" || op.value?.name) {
            const name = op.value?.name
            updates.name = name?.formatted || name?.givenName + " " + name?.familyName || user.name
          }
        } else if (op.op === "add" && op.path === "active") {
          updates.status = op.value ? "active" : "invited"
        } else if (op.op === "remove" && op.path === "active") {
          updates.status = "invited"
        }
      }
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning()

    return NextResponse.json(toScimUser(updated))
  } catch (error) {
    console.error("SCIM PATCH User error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scim/v2/Users/{id} - Delete user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        eq(users.orgId, DEMO_ORG_ID)
      ))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { detail: "User not found" },
        { status: 404 }
      )
    }

    // Soft delete - set status to deactivated
    await db
      .update(users)
      .set({
        status: "deactivated",
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("SCIM DELETE User error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}
