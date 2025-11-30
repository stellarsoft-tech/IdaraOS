/**
 * Integrations API
 * Manages integration configurations (Entra ID, etc.)
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { integrations, organizations, type IntegrationProvider } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import crypto from "crypto"
import { requireOrgId } from "@/lib/api/context"

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


// Validation schemas
const SaveEntraConfigSchema = z.object({
  provider: z.literal("entra"),
  tenantId: z.string().min(1, "Tenant ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client secret is required"),
  ssoEnabled: z.boolean().default(true),
  scimEnabled: z.boolean().default(true),
})

/**
 * Validate Azure AD / Entra ID credentials by attempting to get an access token
 * This ensures the tenant ID, client ID, and client secret are all valid
 */
async function validateEntraCredentials(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Attempt to get an access token using client credentials flow
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorDescription = errorData.error_description || errorData.error || "Invalid credentials"
      
      // Parse common Azure AD errors
      if (errorDescription.includes("AADSTS700016")) {
        return { valid: false, error: "Invalid Client ID - application not found in the tenant" }
      }
      if (errorDescription.includes("AADSTS7000215")) {
        return { valid: false, error: "Invalid Client Secret - the secret is incorrect or expired" }
      }
      if (errorDescription.includes("AADSTS90002") || errorDescription.includes("AADSTS900023")) {
        return { valid: false, error: "Invalid Tenant ID - tenant not found" }
      }
      
      return { valid: false, error: errorDescription }
    }

    // Successfully got a token - credentials are valid
    return { valid: true }
  } catch (error) {
    console.error("Error validating Entra credentials:", error)
    return { 
      valid: false, 
      error: "Failed to connect to Microsoft - please check your network connection" 
    }
  }
}

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
    const orgId = await requireOrgId(request)

    const query = db
      .select()
      .from(integrations)
      .where(eq(integrations.orgId, orgId))

    if (provider) {
      const results = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.orgId, orgId),
            eq(integrations.provider, provider as IntegrationProvider)
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
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
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
    const orgId = await requireOrgId(request)

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

      // Validate credentials before saving
      const validation = await validateEntraCredentials(
        data.tenantId,
        data.clientId,
        data.clientSecret
      )

      if (!validation.valid) {
        return NextResponse.json(
          { 
            error: "Invalid credentials", 
            details: validation.error,
            field: validation.error?.includes("Client ID") ? "clientId" 
                 : validation.error?.includes("Client Secret") ? "clientSecret"
                 : validation.error?.includes("Tenant") ? "tenantId"
                 : undefined
          },
          { status: 400 }
        )
      }

      // Check if integration already exists
      const existing = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.orgId, orgId),
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
            lastError: null, // Clear any previous errors
            lastErrorAt: null,
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
          message: "Integration connected successfully - credentials validated",
        })
      }

      // Create new
      const [created] = await db
        .insert(integrations)
        .values({
          orgId,
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
          message: "Integration connected successfully - credentials validated",
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 400 }
    )
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
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
    const orgId = await requireOrgId(request)

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
            eq(integrations.orgId, orgId),
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
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
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
    const orgId = await requireOrgId(request)

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
          eq(integrations.orgId, orgId),
          eq(integrations.provider, provider as IntegrationProvider)
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
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error deleting integration:", error)
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    )
  }
}

