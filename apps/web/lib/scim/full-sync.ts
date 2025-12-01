/**
 * Full SCIM Sync Service
 * 
 * This service performs a complete sync between Microsoft Entra ID and the application.
 * It can be invoked either:
 * 1. Via the "Sync Now" button in the UI
 * 2. Automatically via SCIM provisioning from Entra ID
 * 
 * The sync process:
 * 1. Fetches all groups from Entra ID that match the configured prefix
 * 2. For each group, fetches all members
 * 3. Creates/updates users in the application
 * 4. Assigns roles based on group memberships
 * 5. Removes roles from users no longer in groups
 * 6. Updates sync counts in the integration record
 */

import { eq, and, inArray, count } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  users, 
  integrations, 
  scimGroups, 
  userScimGroups, 
  userRoles,
  roles,
  persons
} from "@/lib/db/schema"
import { getEntraConfig, type EntraConfig } from "@/lib/auth/entra-config"

/**
 * Property mapping configuration for syncing Entra user properties to People fields
 */
export interface PropertyMapping {
  // Entra property -> People field
  displayName?: string // maps to name (always)
  mail?: string // maps to email (always)
  jobTitle?: string // default: role
  department?: string // default: team
  officeLocation?: string // default: location
  mobilePhone?: string // default: phone
  employeeHireDate?: string // default: startDate
  employeeLeaveDateTime?: string // default: endDate
}

export const DEFAULT_PROPERTY_MAPPING: PropertyMapping = {
  displayName: "name",
  mail: "email",
  jobTitle: "role",
  department: "team",
  officeLocation: "location",
  mobilePhone: "phone",
  employeeHireDate: "startDate",
  employeeLeaveDateTime: "endDate",
}

interface GraphGroup {
  id: string
  displayName: string
  description?: string
}

interface GraphUser {
  id: string
  displayName: string
  mail?: string
  userPrincipalName: string
  givenName?: string
  surname?: string
  accountEnabled?: boolean
  // Additional properties for People sync
  jobTitle?: string
  department?: string
  officeLocation?: string
  mobilePhone?: string
  employeeHireDate?: string
  employeeLeaveDateTime?: string
}

interface SyncResult {
  success: boolean
  message: string
  stats: {
    groupsFound: number
    groupsSynced: number
    groupsRemoved: number
    usersCreated: number
    usersUpdated: number
    usersDeleted: number
    peopleCreated: number
    peopleUpdated: number
    peopleDeleted: number
    rolesAssigned: number
    rolesRemoved: number
    errors: string[]
  }
}

/**
 * Get Microsoft Graph access token using client credentials
 */
async function getGraphAccessToken(): Promise<string | null> {
  const config = await getEntraConfig()
  
  if (!config) {
    console.error("[Full Sync] Entra config not available")
    return null
  }

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          scope: "https://graph.microsoft.com/.default",
          client_secret: config.clientSecret,
          grant_type: "client_credentials",
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("[Full Sync] Failed to get Graph access token:", error)
      return null
    }

    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error("[Full Sync] Error getting Graph access token:", error)
    return null
  }
}

/**
 * Fetch groups from Entra ID that match the configured prefix
 */
async function fetchEntraGroups(accessToken: string, prefix: string): Promise<GraphGroup[]> {
  try {
    // If prefix is provided, filter by displayName starting with prefix
    const filter = prefix 
      ? `startswith(displayName,'${prefix}')`
      : ""
    
    const url = filter
      ? `https://graph.microsoft.com/v1.0/groups?$filter=${encodeURIComponent(filter)}&$select=id,displayName,description`
      : `https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description&$top=100`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[Full Sync] Failed to fetch groups:", error)
      return []
    }

    const data = await response.json()
    return data.value || []
  } catch (error) {
    console.error("[Full Sync] Error fetching groups:", error)
    return []
  }
}

/**
 * Fetch members of a specific Entra ID group
 */
async function fetchGroupMembers(accessToken: string, groupId: string): Promise<GraphUser[]> {
  try {
    // Request additional properties for People sync
    const selectFields = [
      "id", "displayName", "mail", "userPrincipalName", "givenName", "surname", "accountEnabled",
      "jobTitle", "department", "officeLocation", "mobilePhone", "employeeHireDate", "employeeLeaveDateTime"
    ].join(",")
    
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=${selectFields}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error(`[Full Sync] Failed to fetch members for group ${groupId}:`, error)
      return []
    }

    const data = await response.json()
    // Filter to only return users (not other member types like groups)
    return (data.value || []).filter((m: { "@odata.type"?: string }) => 
      m["@odata.type"] === "#microsoft.graph.user"
    )
  } catch (error) {
    console.error(`[Full Sync] Error fetching members for group ${groupId}:`, error)
    return []
  }
}

/**
 * Get the default role for the organization
 */
async function getDefaultRole(orgId: string): Promise<typeof roles.$inferSelect | null> {
  const [defaultRole] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.isDefault, true)))
    .limit(1)
  
  return defaultRole || null
}

/**
 * Map a group display name to a role using the configured prefix
 */
async function mapGroupToRole(displayName: string, orgId: string, prefix: string | null): Promise<typeof roles.$inferSelect | null> {
  if (!prefix) {
    // No prefix - try direct match
    const [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.orgId, orgId), eq(roles.slug, displayName.toLowerCase())))
      .limit(1)
    return role || null
  }

  if (!displayName.startsWith(prefix)) {
    return null
  }

  const roleSlug = displayName.substring(prefix.length).toLowerCase()
  
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.slug, roleSlug)))
    .limit(1)

  return role || null
}

/**
 * Get or create a user in the application
 */
async function getOrCreateUser(
  orgId: string,
  entraUser: GraphUser
): Promise<{ user: typeof users.$inferSelect; created: boolean }> {
  const email = entraUser.mail || entraUser.userPrincipalName

  // Try to find existing user
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.email, email)))
    .limit(1)

  if (existing) {
    // Update if needed
    const updates: Partial<typeof users.$inferInsert> = {}
    
    if (entraUser.displayName && entraUser.displayName !== existing.name) {
      updates.name = entraUser.displayName
    }
    if (!existing.scimProvisioned) {
      updates.scimProvisioned = true
    }
    if (!existing.entraId && entraUser.id) {
      updates.entraId = entraUser.id
    }
    
    if (Object.keys(updates).length > 0) {
      const [updated] = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning()
      return { user: updated, created: false }
    }
    
    return { user: existing, created: false }
  }

  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      orgId,
      email,
      name: entraUser.displayName || email,
      entraId: entraUser.id,
      scimProvisioned: true,
      status: entraUser.accountEnabled !== false ? "active" : "invited",
      invitedAt: new Date(),
    })
    .returning()

  return { user: newUser, created: true }
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name: string, email: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  
  // Add part of email to make unique
  const emailPart = email.split("@")[0].replace(/[^a-z0-9]/g, "").slice(0, 8)
  return `${baseSlug}-${emailPart}`
}

/**
 * Create or update a Person record linked to a User
 */
async function getOrCreatePerson(
  orgId: string,
  userId: string,
  entraUser: GraphUser,
  _config: EntraConfig // Reserved for future property mapping support
): Promise<{ person: typeof persons.$inferSelect | null; created: boolean; updated: boolean }> {
  const email = entraUser.mail || entraUser.userPrincipalName
  const name = entraUser.displayName || email

  // Check if user already has a linked person
  const [existingUser] = await db
    .select({ personId: users.personId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (existingUser?.personId) {
    // Person already linked - update if needed
    const [existingPerson] = await db
      .select()
      .from(persons)
      .where(eq(persons.id, existingUser.personId))
      .limit(1)

    if (existingPerson) {
      // Update person with latest Entra data
      const updates: Partial<typeof persons.$inferInsert> = {}
      
      if (name !== existingPerson.name) updates.name = name
      if (email !== existingPerson.email) updates.email = email
      if (entraUser.jobTitle && entraUser.jobTitle !== existingPerson.role) {
        updates.role = entraUser.jobTitle
      }
      if (entraUser.department && entraUser.department !== existingPerson.team) {
        updates.team = entraUser.department
      }
      if (entraUser.officeLocation && entraUser.officeLocation !== existingPerson.location) {
        updates.location = entraUser.officeLocation
      }
      if (entraUser.mobilePhone && entraUser.mobilePhone !== existingPerson.phone) {
        updates.phone = entraUser.mobilePhone
      }

      if (Object.keys(updates).length > 0) {
        const [updated] = await db
          .update(persons)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(persons.id, existingPerson.id))
          .returning()
        return { person: updated, created: false, updated: true }
      }

      return { person: existingPerson, created: false, updated: false }
    }
  }

  // Try to find person by email (might exist but not linked)
  const [existingPersonByEmail] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.orgId, orgId), eq(persons.email, email)))
    .limit(1)

  if (existingPersonByEmail) {
    // Link existing person to user
    await db
      .update(users)
      .set({ personId: existingPersonByEmail.id, updatedAt: new Date() })
      .where(eq(users.id, userId))

    console.log(`[Full Sync] Linked existing person ${existingPersonByEmail.name} to user`)
    return { person: existingPersonByEmail, created: false, updated: false }
  }

  // Create new person
  const slug = generateSlug(name, email)
  const startDate = entraUser.employeeHireDate 
    ? new Date(entraUser.employeeHireDate).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0]

  const [newPerson] = await db
    .insert(persons)
    .values({
      orgId,
      slug,
      name,
      email,
      role: entraUser.jobTitle || "Employee",
      team: entraUser.department || null,
      location: entraUser.officeLocation || null,
      phone: entraUser.mobilePhone || null,
      status: "active",
      startDate,
    })
    .returning()

  // Link person to user
  await db
    .update(users)
    .set({ personId: newPerson.id, updatedAt: new Date() })
    .where(eq(users.id, userId))

  console.log(`[Full Sync] Created and linked person: ${newPerson.name}`)
  return { person: newPerson, created: true, updated: false }
}

/**
 * Get or create a SCIM group in our database
 */
async function getOrCreateScimGroup(
  orgId: string,
  entraGroup: GraphGroup,
  mappedRoleId: string | null
): Promise<typeof scimGroups.$inferSelect> {
  // Try to find existing group by external ID
  const [existing] = await db
    .select()
    .from(scimGroups)
    .where(and(eq(scimGroups.orgId, orgId), eq(scimGroups.externalId, entraGroup.id)))
    .limit(1)

  if (existing) {
    // Update if display name or role mapping changed
    if (existing.displayName !== entraGroup.displayName || existing.mappedRoleId !== mappedRoleId) {
      const [updated] = await db
        .update(scimGroups)
        .set({
          displayName: entraGroup.displayName,
          mappedRoleId,
          updatedAt: new Date(),
        })
        .where(eq(scimGroups.id, existing.id))
        .returning()
      return updated
    }
    return existing
  }

  // Create new group
  const [newGroup] = await db
    .insert(scimGroups)
    .values({
      orgId,
      externalId: entraGroup.id,
      displayName: entraGroup.displayName,
      mappedRoleId,
    })
    .returning()

  return newGroup
}

/**
 * Sync a user's membership in a SCIM group and assign the corresponding role
 */
async function syncUserGroupMembership(
  userId: string,
  groupId: string,
  roleId: string | null
): Promise<{ membershipAdded: boolean; roleAssigned: boolean }> {
  let membershipAdded = false
  let roleAssigned = false

  // Add group membership
  const [existingMembership] = await db
    .select()
    .from(userScimGroups)
    .where(and(eq(userScimGroups.userId, userId), eq(userScimGroups.scimGroupId, groupId)))
    .limit(1)

  if (!existingMembership) {
    await db.insert(userScimGroups).values({
      userId,
      scimGroupId: groupId,
    }).onConflictDoNothing()
    membershipAdded = true
  }

  // Assign role if group is mapped
  if (roleId) {
    const [existingRole] = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1)

    if (!existingRole) {
      await db.insert(userRoles).values({
        userId,
        roleId,
        source: "scim",
        scimGroupId: groupId,
        assignedAt: new Date(),
      })
      roleAssigned = true
    } else if (existingRole.source === "manual") {
      // Upgrade from manual to SCIM
      await db
        .update(userRoles)
        .set({ source: "scim", scimGroupId: groupId, assignedAt: new Date() })
        .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      roleAssigned = true
    }
  }

  return { membershipAdded, roleAssigned }
}

/**
 * Remove users from groups they're no longer in and remove associated roles
 */
async function cleanupStaleGroupMemberships(
  orgId: string,
  groupId: string,
  currentMemberUserIds: string[]
): Promise<number> {
  // Get all current memberships in our DB for this group
  const existingMemberships = await db
    .select({ userId: userScimGroups.userId })
    .from(userScimGroups)
    .where(eq(userScimGroups.scimGroupId, groupId))

  const existingUserIds = existingMemberships.map(m => m.userId)
  const staleUserIds = existingUserIds.filter(id => !currentMemberUserIds.includes(id))

  if (staleUserIds.length === 0) {
    return 0
  }

  // Remove memberships
  await db
    .delete(userScimGroups)
    .where(
      and(
        eq(userScimGroups.scimGroupId, groupId),
        inArray(userScimGroups.userId, staleUserIds)
      )
    )

  // Remove SCIM-assigned roles from this group
  await db
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.scimGroupId, groupId),
        eq(userRoles.source, "scim"),
        inArray(userRoles.userId, staleUserIds)
      )
    )

  console.log(`[Full Sync] Removed ${staleUserIds.length} stale memberships from group ${groupId}`)
  return staleUserIds.length
}

/**
 * Clean up groups that no longer match the prefix and remove associated users/roles/people
 */
async function cleanupStaleGroups(
  orgId: string,
  validGroupExternalIds: string[],
  config: EntraConfig
): Promise<{ groupsRemoved: number; usersRemoved: number; peopleRemoved: number; rolesRemoved: number }> {
  let groupsRemoved = 0
  let usersRemoved = 0
  let peopleRemoved = 0
  let rolesRemoved = 0

  // Find all SCIM groups in our DB that are NOT in the valid list
  const allDbGroups = await db
    .select()
    .from(scimGroups)
    .where(eq(scimGroups.orgId, orgId))

  const staleGroups = allDbGroups.filter(g => g.externalId && !validGroupExternalIds.includes(g.externalId))

  if (staleGroups.length === 0) {
    console.log(`[Full Sync] No stale groups to clean up`)
    return { groupsRemoved: 0, usersRemoved: 0, peopleRemoved: 0, rolesRemoved: 0 }
  }

  console.log(`[Full Sync] Found ${staleGroups.length} stale group(s) to clean up`)

  for (const staleGroup of staleGroups) {
    try {
      console.log(`[Full Sync] Cleaning up stale group: ${staleGroup.displayName} (${staleGroup.externalId})`)

      // Get all users in this stale group
      const memberships = await db
        .select({ userId: userScimGroups.userId })
        .from(userScimGroups)
        .where(eq(userScimGroups.scimGroupId, staleGroup.id))

      const userIdsInStaleGroup = memberships.map(m => m.userId)

      if (userIdsInStaleGroup.length > 0) {
        // Remove all memberships for this group
        await db
          .delete(userScimGroups)
          .where(eq(userScimGroups.scimGroupId, staleGroup.id))

        // Remove all SCIM-assigned roles from this group
        const deleteResult = await db
          .delete(userRoles)
          .where(
            and(
              eq(userRoles.scimGroupId, staleGroup.id),
              eq(userRoles.source, "scim")
            )
          )
          .returning()

        rolesRemoved += deleteResult.length
        console.log(`[Full Sync] Removed ${userIdsInStaleGroup.length} memberships and ${deleteResult.length} roles from stale group ${staleGroup.displayName}`)

        // Check if any of these users are now orphaned (no longer in any SCIM group)
        for (const userId of userIdsInStaleGroup) {
          const remainingMemberships = await db
            .select({ count: count() })
            .from(userScimGroups)
            .where(eq(userScimGroups.userId, userId))

          if (remainingMemberships[0]?.count === 0) {
            // User is no longer in any SCIM group - check if they were SCIM provisioned
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.id, userId))
              .limit(1)

            if (user && user.scimProvisioned) {
              // User was provisioned via SCIM/sync and is no longer in any valid group
              
              // Delete linked Person if configured to do so
              if (config.deletePeopleOnUserDelete && user.personId) {
                await db
                  .delete(persons)
                  .where(eq(persons.id, user.personId))
                peopleRemoved++
                console.log(`[Full Sync] DELETED person linked to user ${user.email}`)
              }
              
              // Remove any remaining roles
              await db
                .delete(userRoles)
                .where(eq(userRoles.userId, userId))

              // Delete the user
              await db
                .delete(users)
                .where(eq(users.id, userId))

              usersRemoved++
              console.log(`[Full Sync] DELETED user ${user.email} (no longer in any valid SCIM group)`)
            }
          }
        }
      }

      // Delete the stale group from our DB
      await db
        .delete(scimGroups)
        .where(eq(scimGroups.id, staleGroup.id))

      groupsRemoved++
      console.log(`[Full Sync] Deleted stale group: ${staleGroup.displayName}`)
    } catch (error) {
      console.error(`[Full Sync] Error cleaning up stale group ${staleGroup.displayName}:`, error)
    }
  }

  return { groupsRemoved, usersRemoved, peopleRemoved, rolesRemoved }
}

/**
 * Main full sync function
 */
export async function performFullSync(orgId: string): Promise<SyncResult> {
  const stats: SyncResult["stats"] = {
    groupsFound: 0,
    groupsSynced: 0,
    groupsRemoved: 0,
    usersCreated: 0,
    usersUpdated: 0,
    usersDeleted: 0,
    peopleCreated: 0,
    peopleUpdated: 0,
    peopleDeleted: 0,
    rolesAssigned: 0,
    rolesRemoved: 0,
    errors: [],
  }

  console.log(`[Full Sync] Starting full sync for org ${orgId}`)

  // Get Entra configuration
  const config = await getEntraConfig()
  
  if (!config) {
    return {
      success: false,
      message: "Entra ID not configured",
      stats,
    }
  }

  if (!config.scimEnabled) {
    return {
      success: false,
      message: "SCIM is not enabled",
      stats,
    }
  }

  // Get access token
  const accessToken = await getGraphAccessToken()
  if (!accessToken) {
    return {
      success: false,
      message: "Failed to authenticate with Microsoft Graph API",
      stats,
    }
  }

  const prefix = config.scimGroupPrefix || ""

  // Get the default role for users in groups without a role mapping
  const defaultRole = await getDefaultRole(orgId)
  if (defaultRole) {
    console.log(`[Full Sync] Default role: ${defaultRole.name} (${defaultRole.slug})`)
  } else {
    console.log(`[Full Sync] Warning: No default role configured`)
  }

  // Fetch groups from Entra ID
  console.log(`[Full Sync] Fetching groups with prefix: "${prefix}"`)
  const entraGroups = await fetchEntraGroups(accessToken, prefix)
  stats.groupsFound = entraGroups.length
  console.log(`[Full Sync] Found ${entraGroups.length} groups`)

  if (entraGroups.length === 0 && prefix) {
    return {
      success: true,
      message: `No groups found with prefix "${prefix}"`,
      stats,
    }
  }

  // Process each group
  for (const entraGroup of entraGroups) {
    try {
      console.log(`[Full Sync] Processing group: ${entraGroup.displayName}`)

      // Map group to role - use default role if no mapping found
      let mappedRole = await mapGroupToRole(entraGroup.displayName, orgId, prefix || null)
      
      if (!mappedRole) {
        // Use default role for groups without a specific role mapping
        mappedRole = defaultRole
        if (mappedRole) {
          console.log(`[Full Sync] Group "${entraGroup.displayName}" has no role mapping - using default role: ${mappedRole.name}`)
        } else {
          console.log(`[Full Sync] Group "${entraGroup.displayName}" has no role mapping and no default role - users will have no roles`)
        }
      }

      // Get or create the group in our DB
      const dbGroup = await getOrCreateScimGroup(orgId, entraGroup, mappedRole?.id || null)

      // Fetch group members from Entra
      const members = await fetchGroupMembers(accessToken, entraGroup.id)
      console.log(`[Full Sync] Group "${entraGroup.displayName}" has ${members.length} members`)

      const currentMemberUserIds: string[] = []

      // Process each member
      for (const member of members) {
        try {
          // Get or create user
          const { user, created } = await getOrCreateUser(orgId, member)
          currentMemberUserIds.push(user.id)

          if (created) {
            stats.usersCreated++
            console.log(`[Full Sync] Created user: ${user.email}`)
          }

          // Create/update Person record if People sync is enabled
          if (config.syncPeopleEnabled) {
            try {
              const { created: personCreated, updated: personUpdated } = await getOrCreatePerson(
                orgId,
                user.id,
                member,
                config
              )
              if (personCreated) stats.peopleCreated++
              if (personUpdated) stats.peopleUpdated++
            } catch (personError) {
              console.error(`[Full Sync] Error creating/updating person for ${user.email}:`, personError)
              // Don't fail the whole sync for person errors
            }
          }

          // Sync group membership and role
          const { membershipAdded, roleAssigned } = await syncUserGroupMembership(
            user.id,
            dbGroup.id,
            dbGroup.mappedRoleId
          )

          if (!created && membershipAdded) {
            stats.usersUpdated++
          }
          if (roleAssigned) {
            stats.rolesAssigned++
          }
        } catch (memberError) {
          const errorMsg = `Error processing member ${member.userPrincipalName}: ${memberError}`
          console.error(`[Full Sync] ${errorMsg}`)
          stats.errors.push(errorMsg)
        }
      }

      // Clean up stale memberships
      const removedCount = await cleanupStaleGroupMemberships(orgId, dbGroup.id, currentMemberUserIds)
      stats.rolesRemoved += removedCount

      // Update group member count
      await db
        .update(scimGroups)
        .set({
          memberCount: members.length.toString(),
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scimGroups.id, dbGroup.id))

      stats.groupsSynced++
    } catch (groupError) {
      const errorMsg = `Error processing group ${entraGroup.displayName}: ${groupError}`
      console.error(`[Full Sync] ${errorMsg}`)
      stats.errors.push(errorMsg)
    }
  }

  // Clean up groups that no longer match the prefix (or were removed from Entra)
  // This is the key for idempotent sync - removes stale data when prefix changes
  const validGroupExternalIds = entraGroups.map(g => g.id)
  const cleanupResult = await cleanupStaleGroups(orgId, validGroupExternalIds, config)
  stats.groupsRemoved = cleanupResult.groupsRemoved
  stats.usersDeleted = cleanupResult.usersRemoved
  stats.peopleDeleted = cleanupResult.peopleRemoved
  stats.rolesRemoved += cleanupResult.rolesRemoved

  // Update integration sync stats
  const [userCountResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.scimProvisioned, true)))

  const [groupCountResult] = await db
    .select({ count: count() })
    .from(scimGroups)
    .where(eq(scimGroups.orgId, orgId))

  await db
    .update(integrations)
    .set({
      syncedUserCount: (userCountResult?.count || 0).toString(),
      syncedGroupCount: (groupCountResult?.count || 0).toString(),
      lastSyncAt: new Date(),
      lastError: stats.errors.length > 0 ? stats.errors.join("; ") : null,
      lastErrorAt: stats.errors.length > 0 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "entra")))

  const peopleInfo = config.syncPeopleEnabled 
    ? `, people: +${stats.peopleCreated}/-${stats.peopleDeleted}`
    : ""
  const message = `Synced ${stats.groupsSynced} groups (removed ${stats.groupsRemoved} stale), users: +${stats.usersCreated}/-${stats.usersDeleted}${peopleInfo}, roles: +${stats.rolesAssigned}/-${stats.rolesRemoved}`
  console.log(`[Full Sync] Complete: ${message}`)

  return {
    success: stats.errors.length === 0,
    message,
    stats,
  }
}
