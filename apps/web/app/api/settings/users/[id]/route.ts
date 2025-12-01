/**
 * User Detail API Routes
 * GET /api/settings/users/[id] - Get user by ID
 * PUT /api/settings/users/[id] - Update user
 * DELETE /api/settings/users/[id] - Delete user
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, userRoleValues, userStatusValues, persons, integrations } from "@/lib/db/schema"
import { z } from "zod"
import { syncUserToEntra, isEntraSyncEnabled } from "@/lib/auth/entra-sync"
import { requireOrgId } from "@/lib/api/context"

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
 * Check if SCIM bidirectional sync is enabled
 */
async function isBidirectionalSyncEnabled(orgId: string): Promise<boolean> {
  const [config] = await db
    .select({ scimBidirectionalSync: integrations.scimBidirectionalSync })
    .from(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "entra")))
    .limit(1)
  
  return config?.scimBidirectionalSync ?? false
}

/**
 * GET /api/settings/users/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const orgId = await requireOrgId(request)

    const [record] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .limit(1)

    if (!record) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(toApiResponse(record))
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
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
    const orgId = await requireOrgId(request)
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

    // Check if user is SCIM-provisioned
    const [existingUser] = await db
      .select({ scimProvisioned: users.scimProvisioned })
      .from(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .limit(1)

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // If user is SCIM-provisioned, check if bidirectional sync is enabled
    if (existingUser.scimProvisioned) {
      const bidirectionalEnabled = await isBidirectionalSyncEnabled(orgId)
      if (!bidirectionalEnabled) {
        return NextResponse.json(
          { error: "Cannot modify SCIM-provisioned users when bidirectional sync is disabled. Update the user in Microsoft Entra ID instead." },
          { status: 403 }
        )
      }
    }

    // Update user in database
    const [record] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .returning()

    if (!record) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Sync to Entra ID if SCIM is enabled
    let entraSync: { success: boolean; message: string } | null = null
    
    try {
      const syncEnabled = await isEntraSyncEnabled()
      
      if (syncEnabled) {
        // Get phone from linked person if available
        let phone: string | undefined
        if (record.personId) {
          const [person] = await db
            .select({ phone: persons.phone })
            .from(persons)
            .where(eq(persons.id, record.personId))
            .limit(1)
          phone = person?.phone || undefined
        }

        // Sync user to Entra
        entraSync = await syncUserToEntra(record.email, {
          name: data.name || record.name,
          status: data.status || record.status,
          phone,
        })

        if (entraSync.success) {
          console.log(`Synced user ${record.email} to Entra ID`)
        } else {
          console.warn(`Entra sync warning for ${record.email}: ${entraSync.message}`)
        }
      }
    } catch (syncError) {
      console.error("Error syncing to Entra:", syncError)
      // Don't fail the request if sync fails
      entraSync = { success: false, message: "Sync failed" }
    }

    return NextResponse.json({
      ...toApiResponse(record),
      entraSync: entraSync || undefined,
    })
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
    const orgId = await requireOrgId(request)

    // Get user details before deleting (for validation and Entra sync)
    const [userToDelete] = await db
      .select({ email: users.email, scimProvisioned: users.scimProvisioned })
      .from(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .limit(1)

    if (!userToDelete) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // If user is SCIM-provisioned, check if bidirectional sync is enabled
    if (userToDelete.scimProvisioned) {
      const bidirectionalEnabled = await isBidirectionalSyncEnabled(orgId)
      if (!bidirectionalEnabled) {
        return NextResponse.json(
          { error: "Cannot delete SCIM-provisioned users when bidirectional sync is disabled. Remove the user in Microsoft Entra ID instead." },
          { status: 403 }
        )
      }
    }

    // Delete from database
    const result = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .returning({ id: users.id })

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Disable user in Entra if SCIM is enabled
    try {
      const syncEnabled = await isEntraSyncEnabled()
      
      if (syncEnabled) {
        // Set accountEnabled to false in Entra (don't delete, just disable)
        await syncUserToEntra(userToDelete.email, {
          status: "deactivated",
        })
        console.log(`Disabled user ${userToDelete.email} in Entra ID`)
      }
    } catch (syncError) {
      console.error("Error disabling user in Entra:", syncError)
      // Don't fail the request if sync fails
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

