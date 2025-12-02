/**
 * Azure AD OAuth Callback Route
 * GET /api/auth/callback/azure-ad - Handle OAuth callback from Microsoft
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, organizations } from "@/lib/db/schema"
import { createSessionToken, setSessionCookie } from "@/lib/auth/session"
import { getEntraConfig } from "@/lib/auth/entra-config"

// Demo org - same as other routes
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

interface MicrosoftTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  expires_in: number
  scope: string
  refresh_token?: string
}

interface MicrosoftUserInfo {
  id: string
  displayName: string
  mail: string
  userPrincipalName: string
  givenName?: string
  surname?: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  // Get app URL - prioritize env var, then forwarded headers, then request
  // This must be calculated early so all redirects use the correct base URL
  const forwardedProto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "")
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${forwardedProto}://${forwardedHost}`

  // Handle OAuth errors
  if (error) {
    console.error("Azure AD OAuth error:", error, errorDescription)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, appUrl)
    )
  }

  if (!code) {
    console.error("No authorization code received")
    return NextResponse.redirect(
      new URL("/login?error=No authorization code received", appUrl)
    )
  }

  // Parse return URL from state
  let returnTo = "/dashboard" // Default to dashboard after login
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString())
      returnTo = stateData.returnTo || "/dashboard"
    } catch {
      // Invalid state, use default
    }
  }

  try {
    // Get Azure AD configuration from database
    const entraConfig = await getEntraConfig()

    if (!entraConfig) {
      console.error("Entra ID not configured in database")
      return NextResponse.redirect(
        new URL("/login?error=SSO not configured", appUrl)
      )
    }

    const { tenantId, clientId, clientSecret } = entraConfig
    const redirectUri = `${appUrl}/api/auth/callback/azure-ad`

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "openid profile email User.Read",
          code: code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          client_secret: clientSecret,
        }),
      }
    )

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error("Token exchange failed:", errorData)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorData.error_description || "Token exchange failed")}`, appUrl)
      )
    }

    const tokens: MicrosoftTokenResponse = await tokenResponse.json()

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json()
      console.error("Failed to get user info:", errorData)
      return NextResponse.redirect(
        new URL("/login?error=Failed to get user info from Microsoft", appUrl)
      )
    }

    const msUser: MicrosoftUserInfo = await userInfoResponse.json()

    // Get the user's email (prefer mail, fallback to userPrincipalName)
    const userEmail = (msUser.mail || msUser.userPrincipalName || "").toLowerCase().trim()
    
    if (!userEmail) {
      console.error("No email found for Microsoft user:", msUser.id)
      return NextResponse.redirect(
        new URL("/login?error=No email associated with Microsoft account", appUrl)
      )
    }

    // Ensure organization exists
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, DEMO_ORG_ID))
      .limit(1)

    if (!org) {
      // Create default organization if it doesn't exist
      await db.insert(organizations).values({
        id: DEMO_ORG_ID,
        name: "IdaraOS Demo",
        slug: "idaraos-demo",
        appName: "IdaraOS",
      }).onConflictDoNothing()
    }

    // Find user - DO NOT auto-create, user must be pre-registered
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1)

    if (!user) {
      // User not registered - redirect to registration incomplete page
      const redirectUrl = new URL("/registration-incomplete", appUrl)
      redirectUrl.searchParams.set("email", userEmail)
      return NextResponse.redirect(redirectUrl)
    }

    // Check user status
    if (user.status === "suspended") {
      return NextResponse.redirect(
        new URL("/login?error=Your account has been suspended", appUrl)
      )
    }

    if (user.status === "deactivated") {
      return NextResponse.redirect(
        new URL("/login?error=Your account has been deactivated", appUrl)
      )
    }

    // Update user's last login and link their Microsoft ID if not already linked
    await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        // Store Microsoft Entra ID for future syncing
        entraId: msUser.id,
        // If user was "invited", activate them on first SSO login
        status: user.status === "invited" ? "active" : user.status,
      })
      .where(eq(users.id, user.id))

    // Create session token
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
    })

    console.log(`[Azure AD Callback] Creating session for user: ${user.email} (${user.id})`)

    // Create redirect response
    const redirectResponse = NextResponse.redirect(new URL(returnTo, appUrl))

    // Set session cookie directly on the response
    // This ensures the cookie is set before the redirect happens
    // Domain is set to root domain (e.g., .idaraos.com) for cross-subdomain support
    const cookieOptions: {
      httpOnly: boolean
      secure: boolean
      sameSite: "lax" | "strict" | "none"
      maxAge: number
      path: string
      domain?: string
    } = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    }
    
    // Set cookie domain for cross-subdomain support in production
    // This allows the cookie to work on both idaraos.com and app.idaraos.com
    if (process.env.ROOT_DOMAIN) {
      cookieOptions.domain = `.${process.env.ROOT_DOMAIN}`
    }
    
    redirectResponse.cookies.set("idaraos_session", token, cookieOptions)

    console.log(`[Azure AD Callback] Session cookie set, redirecting to: ${returnTo}`)

    return redirectResponse
  } catch (error) {
    console.error("Azure AD callback error:", error)
    return NextResponse.redirect(
      new URL("/login?error=Authentication failed", appUrl)
    )
  }
}

