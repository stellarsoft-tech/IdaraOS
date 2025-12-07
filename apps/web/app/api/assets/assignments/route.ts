/**
 * Asset Assignments API Routes
 * GET /api/assets/assignments - List all current assignments
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, isNull, and, desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { assetAssignments, assets, persons, users } from "@/lib/db/schema"
import { requireOrgId } from "@/lib/api/context"

interface AssignmentResponse {
  id: string
  assetId: string
  asset: {
    id: string
    assetTag: string
    name: string
    model: string | null
    status: string
    source: string
    syncEnabled: boolean
  }
  personId: string
  person: {
    id: string
    name: string
    email: string
    slug: string
  }
  assignedAt: string
  returnedAt: string | null
  assignedBy: {
    id: string
    name: string
    email: string
  } | null
  notes: string | null
}

/**
 * GET /api/assets/assignments
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeReturned = searchParams.get("includeReturned") === "true"
    const personId = searchParams.get("personId")
    const assetId = searchParams.get("assetId")
    
    const orgId = await requireOrgId(request)
    
    // Build conditions
    const conditions = [eq(assets.orgId, orgId)]
    
    if (!includeReturned) {
      conditions.push(isNull(assetAssignments.returnedAt))
    }
    
    if (personId) {
      conditions.push(eq(assetAssignments.personId, personId))
    }
    
    if (assetId) {
      conditions.push(eq(assetAssignments.assetId, assetId))
    }
    
    // Fetch assignments with joined data
    const results = await db
      .select({
        assignment: assetAssignments,
        asset: {
          id: assets.id,
          assetTag: assets.assetTag,
          name: assets.name,
          model: assets.model,
          status: assets.status,
          source: assets.source,
          syncEnabled: assets.syncEnabled,
        },
        person: {
          id: persons.id,
          name: persons.name,
          email: persons.email,
          slug: persons.slug,
        },
      })
      .from(assetAssignments)
      .innerJoin(assets, eq(assetAssignments.assetId, assets.id))
      .innerJoin(persons, eq(assetAssignments.personId, persons.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(assetAssignments.assignedAt))
    
    // Get assigned by users
    const assignedByIds = [...new Set(results.map(r => r.assignment.assignedById).filter(Boolean) as string[])]
    
    const assignedByUsers = assignedByIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, assignedByIds))
      : []
    
    const userById = new Map(assignedByUsers.map(u => [u.id, u]))
    
    // Transform to response
    const response: AssignmentResponse[] = results.map(r => ({
      id: r.assignment.id,
      assetId: r.assignment.assetId,
      asset: r.asset,
      personId: r.assignment.personId,
      person: r.person,
      assignedAt: r.assignment.assignedAt.toISOString(),
      returnedAt: r.assignment.returnedAt?.toISOString() ?? null,
      assignedBy: r.assignment.assignedById ? userById.get(r.assignment.assignedById) ?? null : null,
      notes: r.assignment.notes,
    }))
    
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching assignments:", error)
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    )
  }
}

