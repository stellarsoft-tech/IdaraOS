/**
 * SSO Configuration Check
 * GET /api/auth/sso-config - Check if SSO is available
 */

import { NextResponse } from "next/server"
import { getEntraConfig } from "@/lib/auth/entra-config"

export async function GET() {
  try {
    const config = await getEntraConfig()

    // SSO is available if config exists, is connected, and SSO is enabled
    const ssoAvailable = config !== null && 
                         config.status === "connected" && 
                         config.ssoEnabled

    return NextResponse.json({
      ssoAvailable,
      // Only expose tenant and client ID, never the secret
      tenantId: ssoAvailable ? config?.tenantId : null,
      clientId: ssoAvailable ? config?.clientId : null,
      passwordAuthDisabled: ssoAvailable ? config?.passwordAuthDisabled : false,
    })
  } catch (error) {
    console.error("Error checking SSO config:", error)
    return NextResponse.json({
      ssoAvailable: false,
      tenantId: null,
      clientId: null,
      passwordAuthDisabled: false,
    })
  }
}

