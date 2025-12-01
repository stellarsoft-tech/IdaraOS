/**
 * Azure AD Login Initiation Route
 * GET /api/auth/login/azure-ad - Start OAuth flow with Microsoft
 */

import { NextRequest, NextResponse } from "next/server"
import { getEntraConfig } from "@/lib/auth/entra-config"

export async function GET(request: NextRequest) {
  // Get config from database
  const entraConfig = await getEntraConfig()

  if (!entraConfig || !entraConfig.ssoEnabled) {
    return NextResponse.redirect(
      new URL("/login?error=Microsoft SSO is not configured or enabled", request.url)
    )
  }

  const { tenantId, clientId } = entraConfig
  
  // Get app URL - prioritize env var, then forwarded headers, then request
  const forwardedProto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "")
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${forwardedProto}://${forwardedHost}`
  const redirectUri = `${appUrl}/api/auth/callback/azure-ad`
  
  // Get return URL from query params
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/dashboard"
  
  // Encode return URL in state parameter
  const state = Buffer.from(JSON.stringify({ returnTo })).toString("base64")

  // Build authorization URL
  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_mode", "query")
  authUrl.searchParams.set("scope", "openid profile email User.Read")
  authUrl.searchParams.set("state", state)

  return NextResponse.redirect(authUrl.toString())
}

