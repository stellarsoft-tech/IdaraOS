/**
 * SCIM v2 Users Endpoint
 * Handles user provisioning from Azure AD
 * GET /api/scim/v2/Users - List users
 * POST /api/scim/v2/Users - Create user
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, organizations } from "@/lib/db/schema"
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
 * GET /api/scim/v2/Users - List users
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const filter = searchParams.get("filter")
  const startIndex = parseInt(searchParams.get("startIndex") || "1")
  const count = parseInt(searchParams.get("count") || "100")

  try {
    // Parse filter (e.g., "userName eq \"user@example.com\"")
    let emailFilter: string | null = null

    if (filter) {
      // Simple filter parsing for userName
      const userNameMatch = filter.match(/userName eq "([^"]+)"/)
      if (userNameMatch) {
        emailFilter = userNameMatch[1]
      }
    }

    // Build query with optional email filter
    const baseCondition = eq(users.orgId, DEMO_ORG_ID)
    const whereCondition = emailFilter 
      ? and(baseCondition, eq(users.email, emailFilter))!
      : baseCondition

    // Get total count
    const totalResults = await db
      .select({ count: users.id })
      .from(users)
      .where(whereCondition)

    // Get users
    const userList = await db
      .select()
      .from(users)
      .where(whereCondition)
      .limit(count)
      .offset(startIndex - 1)

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: totalResults.length,
      itemsPerPage: count,
      startIndex,
      Resources: userList.map(toScimUser),
    })
  } catch (error) {
    console.error("SCIM GET Users error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scim/v2/Users - Create user
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // Extract user data from SCIM format
    const userName = body.userName || body.emails?.[0]?.value
    const displayName = body.displayName || body.name?.formatted || userName
    const givenName = body.name?.givenName
    const familyName = body.name?.familyName
    const fullName = displayName || [givenName, familyName].filter(Boolean).join(" ") || userName
    const externalId = body.externalId
    const active = body.active !== false // Default to true

    if (!userName) {
      return NextResponse.json(
        { detail: "userName is required" },
        { status: 400 }
      )
    }

    // Ensure organization exists
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, DEMO_ORG_ID))
      .limit(1)

    if (!org) {
      await db.insert(organizations).values({
        id: DEMO_ORG_ID,
        name: "Demo Organization",
        slug: "demo-org",
      }).onConflictDoNothing()
    }

    // Check if user already exists
    const emailCondition = eq(users.email, userName)
    const externalIdCondition = externalId ? eq(users.entraId, externalId) : null
    
    const existing = await db
      .select()
      .from(users)
      .where(
        externalIdCondition
          ? and(eq(users.orgId, DEMO_ORG_ID), or(emailCondition, externalIdCondition))!
          : and(eq(users.orgId, DEMO_ORG_ID), emailCondition)!
      )
      .limit(1)

    if (existing.length > 0) {
      // User exists - return existing user
      return NextResponse.json(toScimUser(existing[0]), { status: 200 })
    }

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        orgId: DEMO_ORG_ID,
        email: userName,
        name: fullName,
        entraId: externalId || null,
        status: active ? "active" : "invited",
        invitedAt: new Date(),
      })
      .returning()

    return NextResponse.json(toScimUser(newUser), { status: 201 })
  } catch (error) {
    console.error("SCIM POST Users error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}
