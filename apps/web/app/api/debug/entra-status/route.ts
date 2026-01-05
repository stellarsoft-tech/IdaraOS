/**
 * Debug endpoint to check Entra integration status
 * GET /api/debug/entra-status
 * 
 * SECURITY: This endpoint requires authentication and admin role.
 * Only accessible in development or by authenticated admins.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { integrations, organizations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"

// Demo org ID
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

export async function GET() {
  try {
    // SECURITY: Require authentication
    const session = await getSession()
    
    // In production, require admin role. In development, allow if authenticated.
    const isProduction = process.env.NODE_ENV === "production"
    
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    // In production, only allow Admin or Owner roles
    if (isProduction && !["Admin", "Owner"].includes(session.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }
    // Check if org exists
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, DEMO_ORG_ID))
      .limit(1)

    // Get all integrations for this org
    const allIntegrations = await db
      .select({
        id: integrations.id,
        provider: integrations.provider,
        status: integrations.status,
        ssoEnabled: integrations.ssoEnabled,
        scimEnabled: integrations.scimEnabled,
        tenantId: integrations.tenantId,
        clientId: integrations.clientId,
        hasClientSecret: integrations.clientSecretEncrypted,
      })
      .from(integrations)
      .where(eq(integrations.orgId, DEMO_ORG_ID))

    // Get specifically Entra integration
    const [entraIntegration] = await db
      .select({
        id: integrations.id,
        status: integrations.status,
        ssoEnabled: integrations.ssoEnabled,
        scimEnabled: integrations.scimEnabled,
        syncPeopleEnabled: integrations.syncPeopleEnabled,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, DEMO_ORG_ID),
          eq(integrations.provider, "entra")
        )
      )
      .limit(1)

    return NextResponse.json({
      orgId: DEMO_ORG_ID,
      orgFound: !!org,
      orgName: org?.name || null,
      totalIntegrations: allIntegrations.length,
      integrations: allIntegrations.map(i => ({
        ...i,
        hasClientSecret: !!i.hasClientSecret,
      })),
      entraIntegration: entraIntegration ? {
        ...entraIntegration,
        isConnected: entraIntegration.status === "connected",
      } : null,
      diagnosis: {
        hasOrg: !!org,
        hasEntraIntegration: !!entraIntegration,
        entraStatus: entraIntegration?.status || "not found",
        isEntraConnected: entraIntegration?.status === "connected",
        ssoEnabled: entraIntegration?.ssoEnabled || false,
      }
    })
  } catch (error) {
    console.error("[Debug Entra Status] Error:", error)
    return NextResponse.json({
      error: "Failed to check status",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
