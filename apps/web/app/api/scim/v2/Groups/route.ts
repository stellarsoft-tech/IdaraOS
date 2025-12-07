/**
 * SCIM v2 Groups Endpoint
 * Handles group provisioning from Azure AD
 * GET /api/scim/v2/Groups - List groups
 * POST /api/scim/v2/Groups - Create group
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { scimGroups, userScimGroups, users } from "@/lib/db/schema"
import { verifyScimToken, DEMO_ORG_ID, mapGroupToRole } from "@/lib/scim/helpers"

/**
 * Convert database group to SCIM format
 */
function toScimGroup(
  group: typeof scimGroups.$inferSelect,
  members?: { value: string; display?: string }[]
) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    id: group.id,
    externalId: group.externalId || undefined,
    displayName: group.displayName,
    members: members || [],
    meta: {
      resourceType: "Group",
      created: group.createdAt?.toISOString(),
      lastModified: group.updatedAt?.toISOString(),
    },
  }
}

/**
 * GET /api/scim/v2/Groups - List groups
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
    // Parse filter (e.g., "displayName eq \"IdaraOS-Admins\"")
    let displayNameFilter: string | null = null

    if (filter) {
      const displayNameMatch = filter.match(/displayName eq "([^"]+)"/)
      if (displayNameMatch) {
        displayNameFilter = displayNameMatch[1]
      }
    }

    // Build query
    const baseCondition = eq(scimGroups.orgId, DEMO_ORG_ID)
    
    let groupList: (typeof scimGroups.$inferSelect)[]
    
    if (displayNameFilter) {
      groupList = await db
        .select()
        .from(scimGroups)
        .where(and(baseCondition, eq(scimGroups.displayName, displayNameFilter)))
        .limit(count)
        .offset(startIndex - 1)
    } else {
      groupList = await db
        .select()
        .from(scimGroups)
        .where(baseCondition)
        .limit(count)
        .offset(startIndex - 1)
    }

    // Get total count
    const allGroups = await db
      .select({ id: scimGroups.id })
      .from(scimGroups)
      .where(baseCondition)

    // Get members for each group
    const groupsWithMembers = await Promise.all(
      groupList.map(async (group) => {
        const memberships = await db
          .select({
            userId: userScimGroups.userId,
            userName: users.email,
            displayName: users.name,
          })
          .from(userScimGroups)
          .innerJoin(users, eq(userScimGroups.userId, users.id))
          .where(eq(userScimGroups.scimGroupId, group.id))

        const members = memberships.map((m) => ({
          value: m.userId,
          display: m.displayName || m.userName,
          $ref: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/scim/v2/Users/${m.userId}`,
        }))

        return toScimGroup(group, members)
      })
    )

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: allGroups.length,
      itemsPerPage: count,
      startIndex,
      Resources: groupsWithMembers,
    })
  } catch (error) {
    console.error("SCIM GET Groups error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scim/v2/Groups - Create group
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

    const displayName = body.displayName
    const externalId = body.externalId
    const members = body.members || []

    if (!displayName) {
      return NextResponse.json(
        { detail: "displayName is required" },
        { status: 400 }
      )
    }

    // Check if group already exists
    const [existing] = await db
      .select()
      .from(scimGroups)
      .where(
        and(
          eq(scimGroups.orgId, DEMO_ORG_ID),
          eq(scimGroups.displayName, displayName)
        )
      )
      .limit(1)

    if (existing) {
      // Return existing group
      return NextResponse.json(toScimGroup(existing), { status: 200 })
    }

    // Map group to role based on naming convention
    const mappedRole = await mapGroupToRole(displayName)

    // Create new group
    const [newGroup] = await db
      .insert(scimGroups)
      .values({
        orgId: DEMO_ORG_ID,
        displayName,
        externalId: externalId || null,
        mappedRoleId: mappedRole?.id || null,
        memberCount: members.length.toString(),
      })
      .returning()

    console.log(`[SCIM Groups] Created group: ${displayName} (mapped to role: ${mappedRole?.name || "none"})`)

    // Process initial members if provided
    if (members.length > 0) {
      const { assignScimRole } = await import("@/lib/scim/helpers")
      
      for (const member of members) {
        const userId = member.value
        
        // Add user to group membership
        await db.insert(userScimGroups).values({
          userId,
          scimGroupId: newGroup.id,
        }).onConflictDoNothing()

        // Assign role if group is mapped
        if (mappedRole) {
          await assignScimRole(userId, mappedRole.id, newGroup.id)
        }
      }
    }

    return NextResponse.json(toScimGroup(newGroup, members), { status: 201 })
  } catch (error) {
    console.error("SCIM POST Groups error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}
