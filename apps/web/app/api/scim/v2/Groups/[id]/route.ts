/**
 * SCIM v2 Individual Group Endpoint
 * GET /api/scim/v2/Groups/{id} - Get a group
 * PATCH /api/scim/v2/Groups/{id} - Update group (add/remove members)
 * PUT /api/scim/v2/Groups/{id} - Replace group
 * DELETE /api/scim/v2/Groups/{id} - Delete group
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { scimGroups, userScimGroups, users } from "@/lib/db/schema"
import { 
  verifyScimToken, 
  DEMO_ORG_ID, 
  assignScimRole, 
  removeScimRole,
  mapGroupToRole 
} from "@/lib/scim/helpers"

/**
 * Convert database group to SCIM format
 */
function toScimGroup(
  group: typeof scimGroups.$inferSelect,
  members?: { value: string; display?: string; $ref?: string }[]
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
 * Get group members as SCIM format
 */
async function getGroupMembers(groupId: string, baseUrl: string) {
  const memberships = await db
    .select({
      userId: userScimGroups.userId,
      userName: users.email,
      displayName: users.name,
    })
    .from(userScimGroups)
    .innerJoin(users, eq(userScimGroups.userId, users.id))
    .where(eq(userScimGroups.scimGroupId, groupId))

  return memberships.map((m) => ({
    value: m.userId,
    display: m.displayName || m.userName,
    $ref: `${baseUrl}/api/scim/v2/Users/${m.userId}`,
  }))
}

/**
 * GET /api/scim/v2/Groups/{id} - Get a specific group
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const [group] = await db
      .select()
      .from(scimGroups)
      .where(
        and(
          eq(scimGroups.id, id),
          eq(scimGroups.orgId, DEMO_ORG_ID)
        )
      )
      .limit(1)

    if (!group) {
      return NextResponse.json(
        { detail: "Group not found" },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const members = await getGroupMembers(id, baseUrl)

    return NextResponse.json(toScimGroup(group, members))
  } catch (error) {
    console.error("SCIM GET Group error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/scim/v2/Groups/{id} - Update group (add/remove members)
 * This is the main endpoint Azure AD uses for group membership changes
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    // Get the group
    const [group] = await db
      .select()
      .from(scimGroups)
      .where(
        and(
          eq(scimGroups.id, id),
          eq(scimGroups.orgId, DEMO_ORG_ID)
        )
      )
      .limit(1)

    if (!group) {
      return NextResponse.json(
        { detail: "Group not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const operations = body.Operations || []

    console.log(`[SCIM Groups] PATCH ${group.displayName}: ${JSON.stringify(operations)}`)

    for (const operation of operations) {
      const op = operation.op?.toLowerCase()
      const path = operation.path
      const value = operation.value

      if (path === "members" || path?.startsWith("members")) {
        if (op === "add") {
          // Add members to group
          const membersToAdd = Array.isArray(value) ? value : [value]
          
          for (const member of membersToAdd) {
            const userId = member.value
            
            // Verify user exists
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.id, userId))
              .limit(1)

            if (!user) {
              console.warn(`[SCIM Groups] User ${userId} not found, skipping`)
              continue
            }

            // Add to group membership
            await db.insert(userScimGroups).values({
              userId,
              scimGroupId: group.id,
            }).onConflictDoNothing()

            // Assign role if group is mapped
            if (group.mappedRoleId) {
              await assignScimRole(userId, group.mappedRoleId, group.id)
              console.log(`[SCIM Groups] Assigned role ${group.mappedRoleId} to user ${user.email} via group ${group.displayName}`)
            }
          }
        } else if (op === "remove") {
          // Remove members from group
          // Parse member ID from path like "members[value eq \"user-id\"]"
          const memberIdMatch = path?.match(/members\[value eq "([^"]+)"\]/)
          
          if (memberIdMatch) {
            const userId = memberIdMatch[1]
            
            // Remove from group membership
            await db
              .delete(userScimGroups)
              .where(
                and(
                  eq(userScimGroups.userId, userId),
                  eq(userScimGroups.scimGroupId, group.id)
                )
              )

            // Remove SCIM-assigned role from this group
            await removeScimRole(userId, group.id)
            console.log(`[SCIM Groups] Removed user ${userId} from group ${group.displayName}`)
          } else if (Array.isArray(value)) {
            // Remove multiple members
            for (const member of value) {
              const userId = member.value
              
              await db
                .delete(userScimGroups)
                .where(
                  and(
                    eq(userScimGroups.userId, userId),
                    eq(userScimGroups.scimGroupId, group.id)
                  )
                )

              await removeScimRole(userId, group.id)
              console.log(`[SCIM Groups] Removed user ${userId} from group ${group.displayName}`)
            }
          }
        } else if (op === "replace") {
          // Replace all members
          const membersToSet = Array.isArray(value) ? value : [value]
          
          // Get current members to remove their roles
          const currentMembers = await db
            .select({ userId: userScimGroups.userId })
            .from(userScimGroups)
            .where(eq(userScimGroups.scimGroupId, group.id))

          // Remove roles from current members
          for (const member of currentMembers) {
            await removeScimRole(member.userId, group.id)
          }

          // Clear existing memberships
          await db
            .delete(userScimGroups)
            .where(eq(userScimGroups.scimGroupId, group.id))

          // Add new members
          for (const member of membersToSet) {
            const userId = member.value
            
            await db.insert(userScimGroups).values({
              userId,
              scimGroupId: group.id,
            }).onConflictDoNothing()

            if (group.mappedRoleId) {
              await assignScimRole(userId, group.mappedRoleId, group.id)
            }
          }
          
          console.log(`[SCIM Groups] Replaced members in group ${group.displayName}`)
        }
      } else if (path === "displayName" && op === "replace") {
        // Update display name and re-map role
        const newDisplayName = value
        const newMappedRole = await mapGroupToRole(newDisplayName)
        
        await db
          .update(scimGroups)
          .set({
            displayName: newDisplayName,
            mappedRoleId: newMappedRole?.id || null,
            updatedAt: new Date(),
          })
          .where(eq(scimGroups.id, group.id))
      }
    }

    // Update member count
    const memberCount = await db
      .select({ count: userScimGroups.userId })
      .from(userScimGroups)
      .where(eq(userScimGroups.scimGroupId, group.id))

    await db
      .update(scimGroups)
      .set({
        memberCount: memberCount.length.toString(),
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scimGroups.id, group.id))

    // Return updated group
    const [updatedGroup] = await db
      .select()
      .from(scimGroups)
      .where(eq(scimGroups.id, id))
      .limit(1)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const members = await getGroupMembers(id, baseUrl)

    return NextResponse.json(toScimGroup(updatedGroup, members))
  } catch (error) {
    console.error("SCIM PATCH Group error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/scim/v2/Groups/{id} - Replace group
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const [group] = await db
      .select()
      .from(scimGroups)
      .where(
        and(
          eq(scimGroups.id, id),
          eq(scimGroups.orgId, DEMO_ORG_ID)
        )
      )
      .limit(1)

    if (!group) {
      return NextResponse.json(
        { detail: "Group not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const displayName = body.displayName || group.displayName
    const externalId = body.externalId
    const newMembers = body.members || []

    // Re-map role based on new display name
    const mappedRole = await mapGroupToRole(displayName)

    // Get current members to remove their roles
    const currentMembers = await db
      .select({ userId: userScimGroups.userId })
      .from(userScimGroups)
      .where(eq(userScimGroups.scimGroupId, group.id))

    for (const member of currentMembers) {
      await removeScimRole(member.userId, group.id)
    }

    // Clear existing memberships
    await db
      .delete(userScimGroups)
      .where(eq(userScimGroups.scimGroupId, group.id))

    // Add new members
    for (const member of newMembers) {
      const userId = member.value

      await db.insert(userScimGroups).values({
        userId,
        scimGroupId: group.id,
      }).onConflictDoNothing()

      if (mappedRole) {
        await assignScimRole(userId, mappedRole.id, group.id)
      }
    }

    // Update group
    const [updatedGroup] = await db
      .update(scimGroups)
      .set({
        displayName,
        externalId: externalId || null,
        mappedRoleId: mappedRole?.id || null,
        memberCount: newMembers.length.toString(),
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scimGroups.id, id))
      .returning()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const members = await getGroupMembers(id, baseUrl)

    return NextResponse.json(toScimGroup(updatedGroup, members))
  } catch (error) {
    console.error("SCIM PUT Group error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scim/v2/Groups/{id} - Delete group
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isValid = await verifyScimToken(request)
  if (!isValid) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const [group] = await db
      .select()
      .from(scimGroups)
      .where(
        and(
          eq(scimGroups.id, id),
          eq(scimGroups.orgId, DEMO_ORG_ID)
        )
      )
      .limit(1)

    if (!group) {
      return NextResponse.json(
        { detail: "Group not found" },
        { status: 404 }
      )
    }

    // Get all members and remove their SCIM-assigned roles from this group
    const members = await db
      .select({ userId: userScimGroups.userId })
      .from(userScimGroups)
      .where(eq(userScimGroups.scimGroupId, group.id))

    for (const member of members) {
      await removeScimRole(member.userId, group.id)
    }

    // Delete group memberships (will cascade from group delete, but let's be explicit)
    await db
      .delete(userScimGroups)
      .where(eq(userScimGroups.scimGroupId, group.id))

    // Delete the group
    await db.delete(scimGroups).where(eq(scimGroups.id, id))

    console.log(`[SCIM Groups] Deleted group: ${group.displayName}`)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("SCIM DELETE Group error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}
