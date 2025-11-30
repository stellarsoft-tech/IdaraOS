/**
 * API Route: Search Entra ID Users
 * GET /api/settings/integrations/entra/users?search=query
 * 
 * Returns Entra users matching the search query, excluding users already registered in the app.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, integrations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { decrypt } from "@/lib/encryption"
import { requireOrgId } from "@/lib/api/context"

interface EntraUser {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  givenName: string | null
  surname: string | null
  jobTitle: string | null
  department: string | null
}

// Cache the access token
let cachedToken: { token: string; expiry: number } | null = null

async function getGraphAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string | null> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiry) {
    return cachedToken.token
  }

  try {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "https://graph.microsoft.com/.default",
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }),
      }
    )

    if (!tokenResponse.ok) {
      console.error("Failed to get Graph access token:", await tokenResponse.text())
      return null
    }

    const data = await tokenResponse.json()
    cachedToken = {
      token: data.access_token,
      expiry: Date.now() + (data.expires_in - 60) * 1000, // Refresh 1 minute before expiry
    }
    return cachedToken.token
  } catch (error) {
    console.error("Error getting Graph access token:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get("search") || ""

  try {
    // Get orgId from authenticated session
    const orgId = await requireOrgId(request)
    
    // Get Entra integration config for this organization
    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, "entra"),
          eq(integrations.orgId, orgId)
        )
      )
      .limit(1)

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Entra ID integration not connected", users: [] },
        { status: 400 }
      )
    }

    if (!integration.tenantId || !integration.clientId || !integration.clientSecretEncrypted) {
      return NextResponse.json(
        { error: "Entra ID integration not fully configured", users: [] },
        { status: 400 }
      )
    }

    // Decrypt client secret
    const clientSecret = decrypt(integration.clientSecretEncrypted)

    // Get access token
    const accessToken = await getGraphAccessToken(
      integration.tenantId,
      integration.clientId,
      clientSecret
    )

    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to authenticate with Microsoft Graph", users: [] },
        { status: 500 }
      )
    }

    // Get all registered user emails in this organization to exclude
    const registeredUsers = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.orgId, orgId))

    const registeredEmails = new Set(
      registeredUsers.map((u) => u.email.toLowerCase())
    )

    // Build Graph API query
    let graphUrl = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,givenName,surname,jobTitle,department&$top=50"
    
    if (search.trim()) {
      // Search by displayName, mail, or userPrincipalName
      const searchFilter = `startswith(displayName,'${search}') or startswith(mail,'${search}') or startswith(userPrincipalName,'${search}')`
      graphUrl += `&$filter=${encodeURIComponent(searchFilter)}`
    }

    // Fetch users from Microsoft Graph
    const graphResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json()
      console.error("Graph API error:", errorData)
      return NextResponse.json(
        { error: "Failed to fetch users from Entra ID", users: [] },
        { status: 500 }
      )
    }

    const graphData = await graphResponse.json()
    const entraUsers: EntraUser[] = graphData.value || []

    // Filter out already registered users
    const availableUsers = entraUsers.filter((entraUser) => {
      const email = (entraUser.mail || entraUser.userPrincipalName || "").toLowerCase()
      return email && !registeredEmails.has(email)
    })

    // Transform to response format
    const responseUsers = availableUsers.map((user) => ({
      id: user.id,
      name: user.displayName,
      email: user.mail || user.userPrincipalName,
      firstName: user.givenName,
      lastName: user.surname,
      jobTitle: user.jobTitle,
      department: user.department,
    }))

    return NextResponse.json({ users: responseUsers })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated", users: [] },
        { status: 401 }
      )
    }
    
    console.error("Error fetching Entra users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users", users: [] },
      { status: 500 }
    )
  }
}

