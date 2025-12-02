/**
 * People Sync Service
 * 
 * Handles syncing People records from Microsoft Entra ID independently of User sync.
 * This is used when People module is in "independent" sync mode.
 */

import { eq, and, ilike, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { persons, peopleSettings } from "@/lib/db/schema"
import { getEntraConfig } from "@/lib/auth/entra-config"
import type { PeoplePropertyMapping } from "@/lib/db/schema/people-settings"

/**
 * Safely format a date string to YYYY-MM-DD format
 * Returns null if the date is invalid
 */
function safeFormatDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    
    const formatted = date.toISOString().split("T")[0]
    
    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      console.warn(`[People Sync] Invalid date format: ${formatted}`)
      return null
    }
    
    return formatted
  } catch {
    return null
  }
}

interface GraphUser {
  id: string
  displayName: string
  mail?: string
  userPrincipalName: string
  givenName?: string
  surname?: string
  accountEnabled?: boolean
  jobTitle?: string
  department?: string
  officeLocation?: string
  mobilePhone?: string
  employeeHireDate?: string
  employeeLeaveDateTime?: string
}

interface GraphGroup {
  id: string
  displayName: string
  description?: string
}

interface SyncOptions {
  groupPattern: string
  propertyMapping?: PeoplePropertyMapping | null
  autoDeleteOnRemoval: boolean
  defaultStatus: string
}

interface SyncResult {
  success: boolean
  message: string
  stats: {
    groupsFound: number
    peopleCreated: number
    peopleUpdated: number
    peopleDeleted: number
    syncedCount: number
    errors: string[]
  }
}

const DEFAULT_MAPPING: PeoplePropertyMapping = {
  displayName: "name",
  mail: "email",
  jobTitle: "role",
  department: "team",
  officeLocation: "location",
  mobilePhone: "phone",
  employeeHireDate: "startDate",
  employeeLeaveDateTime: "endDate",
}

/**
 * Get Microsoft Graph access token using client credentials
 */
async function getGraphAccessToken(): Promise<string | null> {
  const config = await getEntraConfig()
  
  if (!config) {
    console.error("[People Sync] Entra config not available")
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
      console.error("[People Sync] Failed to get Graph access token:", error)
      return null
    }

    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error("[People Sync] Error getting Graph access token:", error)
    return null
  }
}

/**
 * Convert a wildcard pattern to a regex
 * Supports * as a wildcard that matches any characters
 */
function patternToRegex(pattern: string): RegExp {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  // Convert * to regex wildcard
  const regexStr = escaped.replace(/\*/g, '.*')
  return new RegExp(`^${regexStr}$`, 'i')
}

/**
 * Check if a group name matches the configured pattern
 */
function matchesPattern(groupName: string, pattern: string): boolean {
  if (!pattern) return true
  const regex = patternToRegex(pattern)
  return regex.test(groupName)
}

/**
 * Fetch groups from Entra ID that match the pattern
 * Pattern supports wildcards (*) anywhere in the name
 */
async function fetchMatchingGroups(accessToken: string, pattern: string): Promise<GraphGroup[]> {
  try {
    // Extract prefix (before first *) for MS Graph filter optimization
    const starIndex = pattern.indexOf('*')
    const prefix = starIndex > 0 ? pattern.substring(0, starIndex) : ""
    
    // If we have a prefix, use startswith filter. Otherwise fetch more groups.
    const filter = prefix 
      ? `startswith(displayName,'${prefix}')`
      : (pattern && !pattern.includes('*') ? `displayName eq '${pattern}'` : "")

    const url = filter
      ? `https://graph.microsoft.com/v1.0/groups?$filter=${encodeURIComponent(filter)}&$select=id,displayName,description`
      : `https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description&$top=200`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[People Sync] Failed to fetch groups:", error)
      return []
    }

    const data = await response.json()
    const allGroups: GraphGroup[] = data.value || []
    
    // If pattern has wildcards, filter client-side for full pattern match
    if (pattern && pattern.includes('*')) {
      return allGroups.filter(g => matchesPattern(g.displayName, pattern))
    }
    
    return allGroups
  } catch (error) {
    console.error("[People Sync] Error fetching groups:", error)
    return []
  }
}

/**
 * Fetch members of a specific Entra ID group
 */
async function fetchGroupMembers(accessToken: string, groupId: string): Promise<GraphUser[]> {
  try {
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
      console.error(`[People Sync] Failed to fetch members for group ${groupId}:`, error)
      return []
    }

    const data = await response.json()
    // Filter to only return users (not other member types like groups)
    return (data.value || []).filter((m: { "@odata.type"?: string }) => 
      m["@odata.type"] === "#microsoft.graph.user"
    )
  } catch (error) {
    console.error(`[People Sync] Error fetching members for group ${groupId}:`, error)
    return []
  }
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
 * Map Entra user to person fields using property mapping
 */
function mapEntraUserToPerson(
  user: GraphUser,
  mapping: PeoplePropertyMapping,
  defaultStatus: string
): Partial<typeof persons.$inferInsert> {
  const email = user.mail || user.userPrincipalName
  const name = user.displayName || email

  // Map defaultStatus to valid person status
  const validStatuses = ["active", "onboarding", "offboarding", "inactive"] as const
  const status = validStatuses.includes(defaultStatus as typeof validStatuses[number])
    ? (defaultStatus as typeof validStatuses[number])
    : "active"

  const person: Partial<typeof persons.$inferInsert> = {
    name,
    email,
    status,
  }

  // Apply property mapping
  if (user.jobTitle && mapping.jobTitle === "role") {
    person.role = user.jobTitle
  }
  if (user.department && mapping.department === "team") {
    person.team = user.department
  }
  if (user.officeLocation && mapping.officeLocation === "location") {
    person.location = user.officeLocation
  }
  if (user.mobilePhone && mapping.mobilePhone === "phone") {
    person.phone = user.mobilePhone
  }
  
  // Safely parse dates
  if (user.employeeHireDate && mapping.employeeHireDate === "startDate") {
    const formattedDate = safeFormatDate(user.employeeHireDate)
    if (formattedDate) {
      person.startDate = formattedDate
    }
  }
  if (user.employeeLeaveDateTime && mapping.employeeLeaveDateTime === "endDate") {
    const formattedDate = safeFormatDate(user.employeeLeaveDateTime)
    if (formattedDate) {
      person.endDate = formattedDate
    }
  }

  // Set default role if not mapped
  if (!person.role) {
    person.role = "Employee"
  }

  // Set default start date if not available
  if (!person.startDate) {
    person.startDate = new Date().toISOString().split("T")[0]
  }
  
  // Final validation of start date format
  if (person.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(person.startDate)) {
    console.warn(`[People Sync] Invalid startDate format "${person.startDate}", using current date`)
    person.startDate = new Date().toISOString().split("T")[0]
  }

  return person
}

/**
 * Perform people sync from Entra ID (independent mode)
 */
export async function performPeopleSync(
  orgId: string,
  options: SyncOptions
): Promise<SyncResult> {
  const stats = {
    groupsFound: 0,
    peopleCreated: 0,
    peopleUpdated: 0,
    peopleDeleted: 0,
    syncedCount: 0,
    errors: [] as string[],
  }

  console.log(`[People Sync] Starting sync for org ${orgId} with pattern: ${options.groupPattern}`)

  // Get access token
  const accessToken = await getGraphAccessToken()
  if (!accessToken) {
    return {
      success: false,
      message: "Failed to authenticate with Microsoft Graph API",
      stats,
    }
  }

  const mapping = options.propertyMapping || DEFAULT_MAPPING

  // Fetch matching groups
  const groups = await fetchMatchingGroups(accessToken, options.groupPattern)
  stats.groupsFound = groups.length
  console.log(`[People Sync] Found ${groups.length} groups matching pattern "${options.groupPattern}"`)

  if (groups.length === 0) {
    return {
      success: true,
      message: `No groups found matching pattern "${options.groupPattern}"`,
      stats,
    }
  }

  // Collect all synced emails to track for deletion
  const syncedEmails: string[] = []

  // Process each group
  for (const group of groups) {
    try {
      console.log(`[People Sync] Processing group: ${group.displayName}`)
      
      const members = await fetchGroupMembers(accessToken, group.id)
      console.log(`[People Sync] Group "${group.displayName}" has ${members.length} members`)

      for (const member of members) {
        const email = (member.mail || member.userPrincipalName).toLowerCase()
        syncedEmails.push(email)
        const now = new Date()

        try {
          // Check if person exists (case-insensitive email match)
          const [existing] = await db
            .select()
            .from(persons)
            .where(and(eq(persons.orgId, orgId), ilike(persons.email, email)))
            .limit(1)

          const personData = mapEntraUserToPerson(member, mapping, options.defaultStatus)

          if (existing) {
            // Update existing person with sync tracking
            const updates: Partial<typeof persons.$inferInsert> = {
              // Always update sync tracking fields
              source: "sync" as const,
              entraId: member.id,
              entraGroupId: group.id,
              entraGroupName: group.displayName,
              lastSyncedAt: now,
              syncEnabled: true,
            }
            
            if (personData.name && personData.name !== existing.name) {
              updates.name = personData.name
            }
            if (personData.role && personData.role !== existing.role) {
              updates.role = personData.role
            }
            if (personData.team && personData.team !== existing.team) {
              updates.team = personData.team
            }
            if (personData.location && personData.location !== existing.location) {
              updates.location = personData.location
            }
            if (personData.phone && personData.phone !== existing.phone) {
              updates.phone = personData.phone
            }

            await db
              .update(persons)
              .set({ ...updates, updatedAt: now })
              .where(eq(persons.id, existing.id))
            stats.peopleUpdated++
            console.log(`[People Sync] Updated person: ${email}`)
          } else {
            // Create new person with upsert to handle race conditions
            const slug = generateSlug(personData.name as string, email)
            
            try {
              await db.insert(persons).values({
                orgId,
                slug,
                email, // Already lowercase
                ...personData,
                // Sync tracking fields
                source: "sync" as const,
                entraId: member.id,
                entraGroupId: group.id,
                entraGroupName: group.displayName,
                lastSyncedAt: now,
                syncEnabled: true,
              } as typeof persons.$inferInsert)
              .onConflictDoUpdate({
                target: persons.email,
                set: {
                  name: personData.name || sql`${persons.name}`,
                  role: personData.role || sql`${persons.role}`,
                  team: personData.team || sql`${persons.team}`,
                  location: personData.location || sql`${persons.location}`,
                  phone: personData.phone || sql`${persons.phone}`,
                  source: "sync",
                  entraId: member.id,
                  entraGroupId: group.id,
                  entraGroupName: group.displayName,
                  lastSyncedAt: now,
                  syncEnabled: true,
                  updatedAt: now,
                },
              })
              
              stats.peopleCreated++
              console.log(`[People Sync] Created person: ${email}`)
            } catch (insertError) {
              // If slug conflict, try with a different slug
              console.warn(`[People Sync] Insert failed for ${email}, retrying with unique slug:`, insertError)
              const uniqueSlug = `${slug}-${Date.now().toString(36)}`
              
              await db.insert(persons).values({
                orgId,
                slug: uniqueSlug,
                email,
                ...personData,
                // Sync tracking fields
                source: "sync" as const,
                entraId: member.id,
                entraGroupId: group.id,
                entraGroupName: group.displayName,
                lastSyncedAt: now,
                syncEnabled: true,
              } as typeof persons.$inferInsert)
              .onConflictDoNothing() // If still fails, person likely already exists
              
              stats.peopleCreated++
              console.log(`[People Sync] Created person with unique slug: ${email}`)
            }
          }

          stats.syncedCount++
        } catch (memberError) {
          const errorMsg = `Error processing member ${email}: ${memberError}`
          console.error(`[People Sync] ${errorMsg}`)
          stats.errors.push(errorMsg)
        }
      }
    } catch (groupError) {
      const errorMsg = `Error processing group ${group.displayName}: ${groupError}`
      console.error(`[People Sync] ${errorMsg}`)
      stats.errors.push(errorMsg)
    }
  }

  // Handle deletions if auto-delete is enabled
  if (options.autoDeleteOnRemoval && syncedEmails.length > 0) {
    try {
      // Find people who were synced before but are no longer in any synced group
      // We identify synced people by having a status that matches the default status
      // In a more robust implementation, we'd track which people were synced
      
      // For now, we'll skip auto-deletion to avoid accidental data loss
      // This can be enhanced with a "syncedFromEntra" flag on the persons table
      console.log("[People Sync] Auto-delete is enabled but not implemented for safety")
    } catch (deleteError) {
      console.error(`[People Sync] Error during cleanup:`, deleteError)
    }
  }

  const message = `Synced ${stats.groupsFound} groups: +${stats.peopleCreated} created, ~${stats.peopleUpdated} updated`
  console.log(`[People Sync] Complete: ${message}`)

  return {
    success: stats.errors.length === 0,
    message,
    stats,
  }
}

/**
 * Get people sync settings for an organization
 */
export async function getPeopleSyncSettings(orgId: string) {
  const [settings] = await db
    .select()
    .from(peopleSettings)
    .where(eq(peopleSettings.orgId, orgId))
    .limit(1)

  return settings
}

/**
 * Check if people sync is in independent mode
 */
export async function isPeopleIndependentMode(orgId: string): Promise<boolean> {
  const settings = await getPeopleSyncSettings(orgId)
  return settings?.syncMode === "independent"
}

