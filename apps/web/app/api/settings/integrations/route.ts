/**
 * Integrations API
 * Manages integration configurations (Entra ID, etc.)
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { integrations, organizations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import crypto from "crypto"

// Demo org ID for single-tenant demo
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

// Simple encryption for demo (in production, use proper key management)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "demo-key-change-in-production-32c"

function encrypt(text: string): string {
  const algorithm = "aes-256-cbc"
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return iv.toString("hex") + ":" + encrypted
}

function decrypt(encryptedText: string): string {
  try {
    const algorithm = "aes-256-cbc"
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)
    const [ivHex, encrypted] = encryptedText.split(":")
    const iv = Buffer.from(ivHex, "hex")
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    return ""
  }
}

// Ensure org exists
async function ensureOrgExists() {
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, DEMO_ORG_ID))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(organizations).values({
      id: DEMO_ORG_ID,
      name: "Demo Organization",
      slug: "demo",
    })
  }
}

// Validation schemas
const SaveEntraConfigSchema = z.object({
  provider: z.literal("entra"),
  tenantId: z.string().min(1, "Tenant ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client secret is required"),
  ssoEnabled: z.boolean().default(true),
  scimEnabled: z.boolean().default(true),
})

const UpdateEntraConfigSchema = z.object({
  provider: z.literal("entra"),
  ssoEnabled: z.boolean().optional(),
  passwordAuthDisabled: z.boolean().optional(),
  scimEnabled: z.boolean().optional(),
})

/**
 * GET /api/settings/integrations
 * Get all integrations for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get("provider")

    await ensureOrgExists()

    let query = db
      .select()
      .from(integrations)
      .where(eq(integrations.orgId, DEMO_ORG_ID))

    if (provider) {
      const results = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.orgId, DEMO_ORG_ID),
            eq(integrations.provider, provider)
          )
        )
        .limit(1)

      if (results.length === 0) {
        // Return default disconnected state
        return NextResponse.json({
          provider,
          status: "disconnected",
          tenantId: null,
          clientId: null,
          ssoEnabled: false,
          passwordAuthDisabled: false,
          scimEnabled: false,
          scimEndpoint: null,
          lastSyncAt: null,
          syncedUserCount: 0,
          syncedGroupCount: 0,
        })
      }

      const integration = results[0]
      return NextResponse.json({
        id: integration.id,
        provider: integration.provider,
        status: integration.status,
        tenantId: integration.tenantId,
        clientId: integration.clientId,
        ssoEnabled: integration.ssoEnabled,
        passwordAuthDisabled: integration.passwordAuthDisabled,
        scimEnabled: integration.scimEnabled,
        scimEndpoint: integration.scimEndpoint,
        // Don't expose the actual token, just indicate if it exists
        hasScimToken: !!integration.scimTokenEncrypted,
        lastSyncAt: integration.lastSyncAt?.toISOString(),
        syncedUserCount: parseInt(integration.syncedUserCount || "0"),
        syncedGroupCount: parseInt(integration.syncedGroupCount || "0"),
        lastError: integration.lastError,
        lastErrorAt: integration.lastErrorAt?.toISOString(),
        createdAt: integration.createdAt.toISOString(),
        updatedAt: integration.updatedAt.toISOString(),
      })
    }

    const results = await query

    return NextResponse.json(
      results.map((i) => ({
        id: i.id,
        provider: i.provider,
        status: i.status,
        ssoEnabled: i.ssoEnabled,
        scimEnabled: i.scimEnabled,
        lastSyncAt: i.lastSyncAt?.toISOString(),
        createdAt: i.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error("Error fetching integrations:", error)
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/integrations
 * Create or update an integration configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    await ensureOrgExists()

    // For now, only handle Entra
    if (body.provider === "entra") {
      const parseResult = SaveEntraConfigSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid request body", details: parseResult.error.flatten() },
          { status: 400 }
        )
      }

      const data = parseResult.data

      // Check if integration already exists
      const existing = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.orgId, DEMO_ORG_ID),
            eq(integrations.provider, "entra")
          )
        )
        .limit(1)

      // Generate SCIM endpoint and token
      const scimEndpoint = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/scim/v2`
      const scimToken = `scim_${crypto.randomBytes(24).toString("hex")}`

      if (existing.length > 0) {
        // Update existing
        const [updated] = await db
          .update(integrations)
          .set({
            status: "connected",
            tenantId: data.tenantId,
            clientId: data.clientId,
            clientSecretEncrypted: encrypt(data.clientSecret),
            ssoEnabled: data.ssoEnabled,
            scimEnabled: data.scimEnabled,
            scimEndpoint,
            scimTokenEncrypted: encrypt(scimToken),
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, existing[0].id))
          .returning()

        return NextResponse.json({
          id: updated.id,
          provider: updated.provider,
          status: updated.status,
          tenantId: updated.tenantId,
          clientId: updated.clientId,
          ssoEnabled: updated.ssoEnabled,
          scimEnabled: updated.scimEnabled,
          scimEndpoint: updated.scimEndpoint,
          scimToken, // Return token only on creation/update
          message: "Integration updated successfully",
        })
      }

      // Create new
      const [created] = await db
        .insert(integrations)
        .values({
          orgId: DEMO_ORG_ID,
          provider: "entra",
          status: "connected",
          tenantId: data.tenantId,
          clientId: data.clientId,
          clientSecretEncrypted: encrypt(data.clientSecret),
          ssoEnabled: data.ssoEnabled,
          scimEnabled: data.scimEnabled,
          scimEndpoint,
          scimTokenEncrypted: encrypt(scimToken),
        })
        .returning()

      return NextResponse.json(
        {
          id: created.id,
          provider: created.provider,
          status: created.status,
          tenantId: created.tenantId,
          clientId: created.clientId,
          ssoEnabled: created.ssoEnabled,
          scimEnabled: created.scimEnabled,
          scimEndpoint: created.scimEndpoint,
          scimToken, // Return token only on creation
          message: "Integration connected successfully",
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error saving integration:", error)
    return NextResponse.json(
      { error: "Failed to save integration" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/integrations
 * Update integration settings (SSO/SCIM toggles)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.provider === "entra") {
      const parseResult = UpdateEntraConfigSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid request body", details: parseResult.error.flatten() },
          { status: 400 }
        )
      }

      const data = parseResult.data

      const existing = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.orgId, DEMO_ORG_ID),
            eq(integrations.provider, "entra")
          )
        )
        .limit(1)

      if (existing.length === 0) {
        return NextResponse.json(
          { error: "Integration not found" },
          { status: 404 }
        )
      }

      const updateData: Partial<typeof integrations.$inferInsert> = {
        updatedAt: new Date(),
      }

      if (data.ssoEnabled !== undefined) {
        updateData.ssoEnabled = data.ssoEnabled
      }
      if (data.passwordAuthDisabled !== undefined) {
        updateData.passwordAuthDisabled = data.passwordAuthDisabled
      }
      if (data.scimEnabled !== undefined) {
        updateData.scimEnabled = data.scimEnabled
      }

      const [updated] = await db
        .update(integrations)
        .set(updateData)
        .where(eq(integrations.id, existing[0].id))
        .returning()

      return NextResponse.json({
        id: updated.id,
        provider: updated.provider,
        ssoEnabled: updated.ssoEnabled,
        passwordAuthDisabled: updated.passwordAuthDisabled,
        scimEnabled: updated.scimEnabled,
        message: "Integration updated",
      })
    }

    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error updating integration:", error)
    return NextResponse.json(
      { error: "Failed to update integration" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/integrations
 * Disconnect an integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get("provider")

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      )
    }

    const existing = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, DEMO_ORG_ID),
          eq(integrations.provider, provider)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      )
    }

    await db.delete(integrations).where(eq(integrations.id, existing[0].id))

    return NextResponse.json({
      message: "Integration disconnected successfully",
    })
  } catch (error) {
    console.error("Error deleting integration:", error)
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    )
  }
}

