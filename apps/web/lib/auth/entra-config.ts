/**
 * Entra ID Configuration Helper
 * Fetches and decrypts Entra ID config from database
 */

import { db } from "@/lib/db"
import { integrations, organizations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { decrypt } from "@/lib/encryption"

// Demo org ID
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

export interface EntraConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  ssoEnabled: boolean
  passwordAuthDisabled: boolean
  scimEnabled: boolean
  scimTokenEncrypted: string | null
  status: string
}

/**
 * Get Entra ID configuration from database
 */
export async function getEntraConfig(): Promise<EntraConfig | null> {
  try {
    // Ensure org exists
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, DEMO_ORG_ID))
      .limit(1)

    if (!org) {
      return null
    }

    // Get Entra integration
    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, DEMO_ORG_ID),
          eq(integrations.provider, "entra")
        )
      )
      .limit(1)

    if (!integration) {
      return null
    }

    // Check if configured
    if (!integration.tenantId || !integration.clientId || !integration.clientSecretEncrypted) {
      return null
    }

    // Decrypt the client secret
    const clientSecret = decrypt(integration.clientSecretEncrypted)

    if (!clientSecret) {
      console.error("Failed to decrypt client secret")
      return null
    }

    return {
      tenantId: integration.tenantId,
      clientId: integration.clientId,
      clientSecret,
      ssoEnabled: integration.ssoEnabled,
      passwordAuthDisabled: integration.passwordAuthDisabled,
      scimEnabled: integration.scimEnabled,
      scimTokenEncrypted: integration.scimTokenEncrypted,
      status: integration.status,
    }
  } catch (error) {
    console.error("Error fetching Entra config:", error)
    return null
  }
}

/**
 * Check if SSO is available (config exists and SSO is enabled)
 */
export async function isSSOAvailable(): Promise<boolean> {
  const config = await getEntraConfig()
  return config !== null && config.ssoEnabled && config.status === "connected"
}

