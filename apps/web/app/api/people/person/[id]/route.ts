/**
 * People Detail API Routes
 * GET /api/people/person/[id] - Get person by ID or slug
 * PUT /api/people/person/[id] - Update person
 * DELETE /api/people/person/[id] - Delete person
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { persons, users } from "@/lib/db/schema"
import { UpdatePersonSchema } from "@/lib/generated/people/person/types"

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
  linkedUser?: LinkedUserInfo | null
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
    manager_id: record.managerId,
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
    // Linked user info
    linkedUser: linkedUser || null,
    hasLinkedUser: !!linkedUser,
    hasEntraLink,
    // Sync tracking
    ...syncInfo,
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
    
    return NextResponse.json(toApiResponse(record, linkedUser))
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
    
    const data = parseResult.data
    
    // Fields that are managed by sync and should not be updated when syncEnabled
    const syncManagedFields = ["name", "email", "role", "team", "location", "phone", "startDate"]
    
    // Build update object
    const updateData: Partial<typeof persons.$inferInsert> = {}
    
    // If sync is enabled, only allow updating non-sync-managed fields
    if (existing.syncEnabled) {
      // Only allow updating: status, endDate, bio, avatar
      if (data.status !== undefined) updateData.status = data.status
      if (data.endDate !== undefined) updateData.endDate = data.endDate || null
      if (data.bio !== undefined) updateData.bio = data.bio || null
      
      // Warn if trying to update sync-managed fields
      const attemptedSyncFields = syncManagedFields.filter(
        field => (data as any)[field] !== undefined
      )
      if (attemptedSyncFields.length > 0) {
        console.warn(
          `[People API] Ignoring sync-managed fields for ${existing.email}: ${attemptedSyncFields.join(", ")}`
        )
      }
    } else {
      // Not synced - allow all updates
      if (data.name !== undefined) {
        updateData.name = data.name
        updateData.slug = slugify(data.name)
      }
      if (data.email !== undefined) updateData.email = data.email
      if (data.role !== undefined) updateData.role = data.role
      if (data.team !== undefined) updateData.team = data.team || null
      if (data.status !== undefined) updateData.status = data.status
      if (data.startDate !== undefined) updateData.startDate = data.startDate
      if (data.endDate !== undefined) updateData.endDate = data.endDate || null
      if (data.phone !== undefined) updateData.phone = data.phone || null
      if (data.location !== undefined) updateData.location = data.location || null
      if (data.bio !== undefined) updateData.bio = data.bio || null
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
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(toApiResponse(existing, linkedUser))
    }
    
    updateData.updatedAt = new Date()
    
    const [record] = await db
      .update(persons)
      .set(updateData)
      .where(eq(persons.id, existing.id))
      .returning()
    
    return NextResponse.json(toApiResponse(record, linkedUser))
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
    
    const result = await db
      .delete(persons)
      .where(isUUID(id) ? eq(persons.id, id) : eq(persons.slug, id))
      .returning({ id: persons.id })
    
    if (result.length === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting person:", error)
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 })
  }
}
