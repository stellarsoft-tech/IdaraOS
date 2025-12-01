/**
 * SCIM Helper Functions
 * Shared utilities for SCIM endpoints
 */

import { NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { integrations, roles, scimGroups, userRoles, userScimGroups } from "@/lib/db/schema"
import { decrypt } from "@/lib/encryption"

// Demo org ID - same as other routes
export const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

/**
 * Get SCIM configuration for the organization
 */
export async function getScimConfig() {
  const [config] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.orgId, DEMO_ORG_ID),
        eq(integrations.provider, "entra")
      )
    )
    .limit(1)

  return config
}

/**
 * Verify SCIM authentication token
 */
export async function verifyScimToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }

  const token = authHeader.substring(7)
  const config = await getScimConfig()
  
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
 * Map a SCIM group display name to a role using the configured prefix
 * 
 * Example: If prefix is "IdaraOS-" and displayName is "IdaraOS-Admin",
 * this returns the role with slug "admin"
 */
export async function mapGroupToRole(displayName: string): Promise<typeof roles.$inferSelect | null> {
  const config = await getScimConfig()
  
  if (!config?.scimGroupPrefix) {
    // No prefix configured - try direct match on role slug or name
    const [role] = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.orgId, DEMO_ORG_ID),
          eq(roles.slug, displayName.toLowerCase())
        )
      )
      .limit(1)
    
    return role || null
  }

  // Extract role name from group display name using prefix
  const prefix = config.scimGroupPrefix
  if (!displayName.startsWith(prefix)) {
    // Group doesn't match our naming convention - no role mapping
    return null
  }

  const roleSlug = displayName.substring(prefix.length).toLowerCase()
  
  const [role] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.orgId, DEMO_ORG_ID),
        eq(roles.slug, roleSlug)
      )
    )
    .limit(1)

  return role || null
}

/**
 * Assign a role to a user via SCIM (from group membership)
 */
export async function assignScimRole(
  userId: string,
  roleId: string,
  scimGroupId: string
): Promise<void> {
  // Check if user already has this role
  const [existing] = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, roleId)
      )
    )
    .limit(1)

  if (existing) {
    // Update existing to mark as SCIM-assigned if it was manual
    if (existing.source === "manual") {
      await db
        .update(userRoles)
        .set({
          source: "scim",
          scimGroupId,
          assignedAt: new Date(),
        })
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.roleId, roleId)
          )
        )
    }
    return
  }

  // Insert new role assignment
  await db.insert(userRoles).values({
    userId,
    roleId,
    source: "scim",
    scimGroupId,
    assignedAt: new Date(),
  })
}

/**
 * Remove a SCIM-assigned role from a user
 */
export async function removeScimRole(
  userId: string,
  scimGroupId: string
): Promise<void> {
  // Only remove roles that were assigned by this specific SCIM group
  await db
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.scimGroupId, scimGroupId),
        eq(userRoles.source, "scim")
      )
    )
}

/**
 * Check if a user has any SCIM-assigned roles
 */
export async function hasScimAssignedRoles(userId: string): Promise<boolean> {
  const [result] = await db
    .select({ count: userRoles.userId })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.source, "scim")
      )
    )
    .limit(1)

  return !!result
}

/**
 * Get the default role for users without any group membership
 */
export async function getDefaultRole(): Promise<typeof roles.$inferSelect | null> {
  const [role] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.orgId, DEMO_ORG_ID),
        eq(roles.isDefault, true)
      )
    )
    .limit(1)

  if (role) return role

  // Fallback: get "user" role by slug
  const [userRole] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.orgId, DEMO_ORG_ID),
        eq(roles.slug, "user")
      )
    )
    .limit(1)

  return userRole || null
}

/**
 * Recalculate all SCIM-assigned roles for a user based on their current group memberships
 * This ensures roles are in sync with group memberships, useful for:
 * - Fixing sync inconsistencies
 * - Ensuring roles match current group memberships after manual changes
 * 
 * This function:
 * 1. Gets all groups the user is currently a member of
 * 2. Removes all SCIM-assigned roles for this user
 * 3. Re-assigns roles based on current group memberships
 */
export async function recalculateUserScimRoles(userId: string): Promise<void> {
  // Get all groups the user is currently a member of
  const userGroups = await db
    .select({
      groupId: scimGroups.id,
      roleId: scimGroups.mappedRoleId,
      displayName: scimGroups.displayName,
    })
    .from(userScimGroups)
    .innerJoin(scimGroups, eq(userScimGroups.scimGroupId, scimGroups.id))
    .where(eq(userScimGroups.userId, userId))

  // Remove all existing SCIM-assigned roles for this user
  await db
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.source, "scim")
      )
    )

  // Re-assign roles based on current group memberships
  for (const group of userGroups) {
    if (group.roleId) {
      await assignScimRole(userId, group.roleId, group.groupId)
      console.log(`[SCIM Sync] Re-assigned role ${group.roleId} to user ${userId} via group ${group.displayName}`)
    }
  }

  console.log(`[SCIM Sync] Recalculated roles for user ${userId}: ${userGroups.length} groups processed`)
}
