/**
 * Asset Lifecycle Events API Routes
 * GET /api/assets/lifecycle - List all lifecycle events
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { assetLifecycleEvents, assets, users } from "@/lib/db/schema"
import { requireOrgId } from "@/lib/api/context"

interface LifecycleEventResponse {
  id: string
  assetId: string
  asset: {
    id: string
    assetTag: string
    name: string
  }
  eventType: string
  eventDate: string
  details: Record<string, unknown>
  performedBy: {
    id: string
    name: string
    email: string
  } | null
  createdAt: string
}

/**
 * GET /api/assets/lifecycle
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventType = searchParams.get("eventType")
    const assetId = searchParams.get("assetId")
    
    const orgId = await requireOrgId(request)
    
    // Build conditions
    const conditions = [eq(assetLifecycleEvents.orgId, orgId)]
    
    if (eventType) {
      conditions.push(eq(assetLifecycleEvents.eventType, eventType as typeof assetLifecycleEvents.eventType.enumValues[number]))
    }
    
    if (assetId) {
      conditions.push(eq(assetLifecycleEvents.assetId, assetId))
    }
    
    // Fetch events
    const results = await db
      .select()
      .from(assetLifecycleEvents)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(assetLifecycleEvents.eventDate))
      .limit(500)
    
    // Get assets
    const assetIds = [...new Set(results.map(r => r.assetId))]
    const assetsData = assetIds.length > 0
      ? await db
          .select({
            id: assets.id,
            assetTag: assets.assetTag,
            name: assets.name,
          })
          .from(assets)
          .where(inArray(assets.id, assetIds))
      : []
    
    const assetById = new Map(assetsData.map(a => [a.id, a]))
    
    // Get performed by users
    const performedByIds = [...new Set(results.map(r => r.performedById).filter(Boolean) as string[])]
    const performedByUsers = performedByIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, performedByIds))
      : []
    
    const userById = new Map(performedByUsers.map(u => [u.id, u]))
    
    // Transform to response
    const response: LifecycleEventResponse[] = results.map(r => ({
      id: r.id,
      assetId: r.assetId,
      asset: assetById.get(r.assetId) || { id: r.assetId, assetTag: "Unknown", name: "Unknown" },
      eventType: r.eventType,
      eventDate: r.eventDate.toISOString(),
      details: r.details as Record<string, unknown>,
      performedBy: r.performedById ? userById.get(r.performedById) ?? null : null,
      createdAt: r.createdAt.toISOString(),
    }))
    
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching lifecycle events:", error)
    return NextResponse.json(
      { error: "Failed to fetch lifecycle events" },
      { status: 500 }
    )
  }
}

