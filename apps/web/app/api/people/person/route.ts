/**
 * People API Routes
 * GET /api/people/person - List all people
 * POST /api/people/person - Create a person
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, or, inArray, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { persons, users } from "@/lib/db/schema"
import { CreatePersonSchema } from "@/lib/generated/people/person/types"

// Generate slug from name
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

// Transform DB record to API response
function toApiResponse(
  record: typeof persons.$inferSelect,
  linkedUser?: LinkedUserInfo | null
) {
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
    assignedAssets: 0, // TODO: Compute from assets table
    // Linked user info
    linkedUser: linkedUser || null,
    hasLinkedUser: !!linkedUser,
    hasEntraLink: linkedUser?.hasEntraLink || false,
  }
}

/**
 * GET /api/people/person
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const team = searchParams.get("team")
    
    // TODO: Get org_id from auth session
    // const orgId = await getOrgIdFromSession(request)
    
    // Build query
    let query = db.select().from(persons)
    
    // Apply filters using Drizzle's query builder
    const conditions = []
    
    if (search) {
      conditions.push(
        or(
          ilike(persons.name, `%${search}%`),
          ilike(persons.email, `%${search}%`),
          ilike(persons.role, `%${search}%`)
        )
      )
    }
    
    if (status) {
      const statuses = status.split(",")
      conditions.push(inArray(persons.status, statuses as any))
    }
    
    if (team) {
      const teams = team.split(",")
      conditions.push(inArray(persons.team, teams))
    }
    
    // Execute query with conditions
    const results = conditions.length > 0
      ? await query.where(conditions.length === 1 ? conditions[0] : or(...conditions)).orderBy(asc(persons.name))
      : await query.orderBy(asc(persons.name))
    
    // Get linked users for all people
    const personIds = results.map(p => p.id)
    
    const linkedUsers = personIds.length > 0
      ? await db
          .select({
            id: users.id,
            personId: users.personId,
            name: users.name,
            email: users.email,
            status: users.status,
            entraId: users.entraId,
          })
          .from(users)
          .where(inArray(users.personId, personIds))
      : []

    // Create lookup map for linked users
    const userByPersonId = new Map<string, LinkedUserInfo>()
    for (const user of linkedUsers) {
      if (user.personId) {
        userByPersonId.set(user.personId, {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          hasEntraLink: !!user.entraId,
        })
      }
    }
    
    return NextResponse.json(
      results.map(person => toApiResponse(person, userByPersonId.get(person.id)))
    )
  } catch (error) {
    console.error("Error fetching people:", error)
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/people/person
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate
    const parseResult = CreatePersonSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    const slug = slugify(data.name)
    
    // TODO: Get org_id from auth session
    const orgId = "00000000-0000-0000-0000-000000000001" // Demo org for now
    
    // Check duplicate email
    const existing = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.email, data.email))
      .limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A person with this email already exists" },
        { status: 409 }
      )
    }
    
    // Insert
    const [record] = await db
      .insert(persons)
      .values({
        orgId,
        slug,
        name: data.name,
        email: data.email,
        role: data.role,
        team: data.team ?? null,
        startDate: data.startDate,
        phone: data.phone ?? null,
        location: data.location ?? null,
        status: "onboarding",
      })
      .returning()
    
    return NextResponse.json(toApiResponse(record), { status: 201 })
  } catch (error) {
    console.error("Error creating person:", error)
    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    )
  }
}
