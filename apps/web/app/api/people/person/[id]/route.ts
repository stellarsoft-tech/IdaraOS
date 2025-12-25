/**
 * People Detail API Routes
 * GET /api/people/person/[id] - Get person by ID or slug
 * PUT /api/people/person/[id] - Update person
 * DELETE /api/people/person/[id] - Delete person
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { persons, users } from "@/lib/db/schema"
import { UpdatePersonSchema } from "@/lib/generated/people/person/types"
import { getEntraConfig } from "@/lib/auth/entra-config"
import { syncPersonToEntra } from "@/lib/auth/entra-sync"
import { getAuditLogger, requireSession } from "@/lib/api/context"
import { triggerPersonWorkflow } from "@/lib/workflows/engine"

// UUID regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
}

// Linked user info type
interface LinkedUserInfo {
  id: string
  name: string
  email: string
  status: string
  hasEntraLink: boolean
}

// Manager info type
interface ManagerInfo {
  id: string
  name: string
  email: string
  slug: string
}

// Real-time Entra info (fetched live, not stored)
interface EntraRealTimeInfo {
  lastSignInAt: string | null
  lastPasswordChangeAt: string | null
}

// Sync info type
interface SyncInfo {
  source: "manual" | "sync"
  entraId: string | null
  entraGroupId: string | null
  entraGroupName: string | null
  lastSyncedAt: string | null
  syncEnabled: boolean
}

// Transform DB record to API response
function toApiResponse(
  record: typeof persons.$inferSelect,
  linkedUser?: LinkedUserInfo | null,
  manager?: ManagerInfo | null,
  entraRealTimeInfo?: EntraRealTimeInfo | null
) {
  // Determine if person has Entra link (either through linked user or direct sync)
  const hasEntraLink = !!record.entraId || linkedUser?.hasEntraLink || false
  
  // Build sync info
  const syncInfo: SyncInfo = {
    source: record.source as "manual" | "sync",
    entraId: record.entraId ?? null,
    entraGroupId: record.entraGroupId ?? null,
    entraGroupName: record.entraGroupName ?? null,
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    syncEnabled: record.syncEnabled ?? false,
  }
  
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    email: record.email,
    role: record.role,
    team: record.team ?? undefined,
    managerId: record.managerId,
    manager: manager || null,
    status: record.status,
    startDate: record.startDate,
    endDate: record.endDate,
    phone: record.phone ?? undefined,
    location: record.location ?? undefined,
    avatar: record.avatar ?? undefined,
    bio: record.bio ?? undefined,
    assignedAssets: 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    // Entra fields (stored in DB)
    entraCreatedAt: record.entraCreatedAt?.toISOString() ?? null,
    hireDate: record.hireDate ?? null,
    // Last sign-in and password change - use real-time if available, else use cached DB value
    lastSignInAt: entraRealTimeInfo?.lastSignInAt ?? record.lastSignInAt?.toISOString() ?? null,
    lastPasswordChangeAt: entraRealTimeInfo?.lastPasswordChangeAt ?? record.lastPasswordChangeAt?.toISOString() ?? null,
    // Linked user info
    linkedUser: linkedUser || null,
    hasLinkedUser: !!linkedUser,
    hasEntraLink,
    // Sync tracking
    ...syncInfo,
  }
}

/**
 * Fetch real-time sign-in activity from Entra ID
 */
async function fetchEntraRealTimeInfo(entraId: string): Promise<EntraRealTimeInfo | null> {
  try {
    const config = await getEntraConfig()
    if (!config || config.status !== "connected") {
      return null
    }

    // Get access token
    const tokenResponse = await fetch(
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

    if (!tokenResponse.ok) {
      console.error("[People API] Failed to get Graph access token")
      return null
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch user with sign-in activity (requires AuditLog.Read.All or Directory.Read.All)
    // Note: signInActivity requires Azure AD Premium license
    const userResponse = await fetch(
      `https://graph.microsoft.com/beta/users/${entraId}?$select=signInActivity,lastPasswordChangeDateTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!userResponse.ok) {
      // May not have permission or user not found
      console.warn("[People API] Could not fetch Entra sign-in activity")
      return null
    }

    const userData = await userResponse.json()
    
    return {
      lastSignInAt: userData.signInActivity?.lastSignInDateTime ?? null,
      lastPasswordChangeAt: userData.lastPasswordChangeDateTime ?? null,
    }
  } catch (error) {
    console.error("[People API] Error fetching Entra real-time info:", error)
    return null
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/people/person/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    
    const [record] = await db
      .select()
      .from(persons)
      .where(isUUID(id) ? eq(persons.id, id) : eq(persons.slug, id))
      .limit(1)
    
    if (!record) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }
    
    // Fetch linked user if exists
    let linkedUser: LinkedUserInfo | null = null
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        entraId: users.entraId,
      })
      .from(users)
      .where(eq(users.personId, record.id))
      .limit(1)
    
    if (user) {
      linkedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        hasEntraLink: !!user.entraId,
      }
    }
    
    // Fetch manager info if exists
    let manager: ManagerInfo | null = null
    if (record.managerId) {
      const [managerRecord] = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
          slug: persons.slug,
        })
        .from(persons)
        .where(eq(persons.id, record.managerId))
        .limit(1)
      
      if (managerRecord) {
        manager = managerRecord
      }
    }
    
    // Fetch real-time Entra info if person has an Entra link
    let entraRealTimeInfo: EntraRealTimeInfo | null = null
    if (record.entraId) {
      entraRealTimeInfo = await fetchEntraRealTimeInfo(record.entraId)
    }
    
    return NextResponse.json(toApiResponse(record, linkedUser, manager, entraRealTimeInfo))
  } catch (error) {
    console.error("Error fetching person:", error)
    return NextResponse.json({ error: "Failed to fetch person" }, { status: 500 })
  }
}

/**
 * PUT /api/people/person/[id]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    
    // Validate
    const parseResult = UpdatePersonSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    // Find existing
    const [existing] = await db
      .select()
      .from(persons)
      .where(isUUID(id) ? eq(persons.id, id) : eq(persons.slug, id))
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }
    
    // Get Entra config to check bidirectional sync setting
    const config = await getEntraConfig()
    const isBidirectionalSyncEnabled = config?.scimBidirectionalSync ?? false
    const hasEntraLink = !!existing.entraId
    
    const data = parseResult.data
    
    // Fields that are managed by sync and should not be updated when syncEnabled
    // UNLESS bidirectional sync is enabled
    const syncManagedFields = ["name", "email", "role", "team", "location", "phone", "startDate"]
    
    // Build update object
    const updateData: Partial<typeof persons.$inferInsert> = {}
    
    // Determine if we can edit synced fields
    const canEditSyncedFields = !existing.syncEnabled || (isBidirectionalSyncEnabled && hasEntraLink)
    
    if (canEditSyncedFields) {
      // Allow all updates (except email for synced users with bidirectional sync)
      if (data.name !== undefined) {
        updateData.name = data.name
        updateData.slug = slugify(data.name)
      }
      // Email changes are not synced to Entra, so only allow for non-synced users
      if (data.email !== undefined && !existing.syncEnabled) {
        updateData.email = data.email
      }
      if (data.role !== undefined) updateData.role = data.role
      if (data.team !== undefined) updateData.team = data.team || null
      if (data.status !== undefined) updateData.status = data.status
      if (data.startDate !== undefined) updateData.startDate = data.startDate
      if (data.hireDate !== undefined) updateData.hireDate = data.hireDate || null
      if (data.endDate !== undefined) updateData.endDate = data.endDate || null
      if (data.phone !== undefined) updateData.phone = data.phone || null
      if (data.location !== undefined) updateData.location = data.location || null
      if (data.bio !== undefined) updateData.bio = data.bio || null
    } else {
      // Sync is enabled without bidirectional sync - only allow updating non-sync-managed fields
      if (data.status !== undefined) updateData.status = data.status
      if (data.endDate !== undefined) updateData.endDate = data.endDate || null
      if (data.bio !== undefined) updateData.bio = data.bio || null
      
      // Warn if trying to update sync-managed fields
      const attemptedSyncFields = syncManagedFields.filter(
        field => (data as Record<string, unknown>)[field] !== undefined
      )
      if (attemptedSyncFields.length > 0) {
        console.warn(
          `[People API] Ignoring sync-managed fields for ${existing.email}: ${attemptedSyncFields.join(", ")}`
        )
      }
    }
    
    // Fetch linked user before update
    let linkedUser: LinkedUserInfo | null = null
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        entraId: users.entraId,
      })
      .from(users)
      .where(eq(users.personId, existing.id))
      .limit(1)
    
    if (user) {
      linkedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        hasEntraLink: !!user.entraId,
      }
    }
    
    // Fetch manager info if exists
    let manager: ManagerInfo | null = null
    if (existing.managerId) {
      const [managerRecord] = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
          slug: persons.slug,
        })
        .from(persons)
        .where(eq(persons.id, existing.managerId))
        .limit(1)
      
      if (managerRecord) {
        manager = managerRecord
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(toApiResponse(existing, linkedUser, manager))
    }
    
    updateData.updatedAt = new Date()
    
    const [record] = await db
      .update(persons)
      .set(updateData)
      .where(eq(persons.id, existing.id))
      .returning()
    
    // Audit log the update
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "people.directory",
        "person",
        record.id,
        record.name,
        {
          name: existing.name,
          email: existing.email,
          role: existing.role,
          team: existing.team,
          status: existing.status,
          startDate: existing.startDate,
          hireDate: existing.hireDate,
          endDate: existing.endDate,
          phone: existing.phone,
          location: existing.location,
          bio: existing.bio,
        },
        {
          name: record.name,
          email: record.email,
          role: record.role,
          team: record.team,
          status: record.status,
          startDate: record.startDate,
          hireDate: record.hireDate,
          endDate: record.endDate,
          phone: record.phone,
          location: record.location,
          bio: record.bio,
        }
      )
    }
    
    // If bidirectional sync is enabled and person has Entra link, sync to Entra
    if (isBidirectionalSyncEnabled && hasEntraLink && existing.entraId) {
      try {
        const entraUpdates: Record<string, string | undefined> = {}
        
        if (data.name !== undefined) entraUpdates.displayName = data.name
        if (data.role !== undefined) entraUpdates.jobTitle = data.role
        if (data.team !== undefined) entraUpdates.department = data.team
        if (data.location !== undefined) entraUpdates.officeLocation = data.location
        if (data.phone !== undefined) entraUpdates.mobilePhone = data.phone
        if (data.hireDate !== undefined) entraUpdates.employeeHireDate = data.hireDate
        
        console.log(`[People API] Bidirectional sync triggered for ${existing.email}`)
        console.log(`[People API] Updates to sync:`, JSON.stringify(entraUpdates))
        
        if (Object.keys(entraUpdates).length > 0) {
          const syncResult = await syncPersonToEntra(existing.entraId, entraUpdates)
          if (!syncResult.success) {
            console.warn(`[People API] Failed to sync to Entra: ${syncResult.message}`)
          } else {
            console.log(`[People API] Successfully synced changes to Entra for ${existing.email}`)
          }
        } else {
          console.log(`[People API] No Entra-syncable fields changed for ${existing.email}`)
        }
      } catch (syncError) {
        console.error("[People API] Error syncing to Entra:", syncError)
        // Don't fail the request, just log the error
      }
    }
    
    // Trigger workflow if status changed to onboarding or offboarding
    if (data.status && data.status !== existing.status) {
      if (data.status === "onboarding" || data.status === "offboarding") {
        try {
          // Get session for the user who made the change
          let changedById: string | undefined
          try {
            const session = await requireSession()
            changedById = session.userId
          } catch {
            // If no session, workflow will be created without a startedBy
          }
          
          const workflowResult = await triggerPersonWorkflow({
            personId: record.id,
            orgId: record.orgId,
            newStatus: data.status,
            changedById,
          })
          
          if (workflowResult?.triggered) {
            console.log(`[People API] Triggered ${data.status} workflow for ${record.email}`)
          }
        } catch (workflowError) {
          console.error("[People API] Error triggering workflow:", workflowError)
          // Don't fail the request, just log the error
        }
      }
    }
    
    return NextResponse.json(toApiResponse(record, linkedUser, manager))
  } catch (error) {
    console.error("Error updating person:", error)
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 })
  }
}

/**
 * DELETE /api/people/person/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    
    // Find the person first to get their details for the audit log
    const [existing] = await db
      .select()
      .from(persons)
      .where(isUUID(id) ? eq(persons.id, id) : eq(persons.slug, id))
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }
    
    // Delete the person
    await db
      .delete(persons)
      .where(eq(persons.id, existing.id))
    
    // Audit log the deletion
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("people.directory", "person", {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        team: existing.team,
        status: existing.status,
      })
    }
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting person:", error)
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 })
  }
}
