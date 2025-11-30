/**
 * People Detail API Routes
 * GET /api/people/person/[id] - Get person by ID or slug
 * PUT /api/people/person/[id] - Update person
 * DELETE /api/people/person/[id] - Delete person
 */

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { persons } from "@/lib/db/schema"
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

function toApiResponse(record: typeof persons.$inferSelect) {
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
    
    return NextResponse.json(toApiResponse(record))
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
    
    // Build update object
    const updateData: Partial<typeof persons.$inferInsert> = {}
    
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
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(toApiResponse(existing))
    }
    
    const [record] = await db
      .update(persons)
      .set(updateData)
      .where(eq(persons.id, existing.id))
      .returning()
    
    return NextResponse.json(toApiResponse(record))
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
