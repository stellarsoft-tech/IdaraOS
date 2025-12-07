/**
 * Asset Maintenance API Routes
 * GET /api/assets/maintenance - List all maintenance records
 * POST /api/assets/maintenance - Create a maintenance record
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { assetMaintenanceRecords, assets, users, persons, assetLifecycleEvents } from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
import { z } from "zod"

// Create maintenance schema
const CreateMaintenanceSchema = z.object({
  assetId: z.string().uuid("Invalid asset ID"),
  type: z.enum(["scheduled", "repair", "upgrade"]),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
  description: z.string().optional(),
  scheduledDate: z.string().optional(),
  completedDate: z.string().optional(),
  cost: z.string().optional(),
  vendor: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

interface MaintenanceResponse {
  id: string
  assetId: string
  asset: {
    id: string
    assetTag: string
    name: string
  } | null
  type: string
  status: string
  description: string | null
  scheduledDate: string | null
  completedDate: string | null
  cost: string | null
  vendor: string | null
  performedBy: {
    id: string
    name: string
    email: string
  } | null
  assignedToId: string | null
  assignedTo: {
    id: string
    name: string
    email: string
    slug: string
  } | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * GET /api/assets/maintenance
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const assetId = searchParams.get("assetId")
    
    const orgId = await requireOrgId(request)
    
    // Build conditions
    const conditions = [eq(assetMaintenanceRecords.orgId, orgId)]
    
    if (status) {
      const statuses = status.split(",")
      conditions.push(inArray(assetMaintenanceRecords.status, statuses as typeof assetMaintenanceRecords.status.enumValues))
    }
    
    if (type) {
      conditions.push(eq(assetMaintenanceRecords.type, type as typeof assetMaintenanceRecords.type.enumValues[number]))
    }
    
    if (assetId) {
      conditions.push(eq(assetMaintenanceRecords.assetId, assetId))
    }
    
    // Fetch records
    const results = await db
      .select()
      .from(assetMaintenanceRecords)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(assetMaintenanceRecords.createdAt))
    
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
    
    // Get assigned to persons
    const assignedToIds = [...new Set(results.map(r => r.assignedToId).filter(Boolean) as string[])]
    const assignedToPersons = assignedToIds.length > 0
      ? await db
          .select({
            id: persons.id,
            name: persons.name,
            email: persons.email,
            slug: persons.slug,
          })
          .from(persons)
          .where(inArray(persons.id, assignedToIds))
      : []
    
    const personById = new Map(assignedToPersons.map(p => [p.id, p]))
    
    // Transform to response
    const response: MaintenanceResponse[] = results.map(r => ({
      id: r.id,
      assetId: r.assetId,
      asset: assetById.get(r.assetId) ?? null,
      type: r.type,
      status: r.status,
      description: r.description,
      scheduledDate: r.scheduledDate,
      completedDate: r.completedDate,
      cost: r.cost,
      vendor: r.vendor,
      performedBy: r.performedById ? userById.get(r.performedById) ?? null : null,
      assignedToId: r.assignedToId,
      assignedTo: r.assignedToId ? personById.get(r.assignedToId) ?? null : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
    
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching maintenance records:", error)
    return NextResponse.json(
      { error: "Failed to fetch maintenance records" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/assets/maintenance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate
    const parseResult = CreateMaintenanceSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const session = await requireSession()
    const orgId = session.orgId
    const data = parseResult.data
    
    // Check asset exists and belongs to org
    const assetResult = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, data.assetId),
        eq(assets.orgId, orgId)
      ))
      .limit(1)
    
    if (assetResult.length === 0) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      )
    }
    
    const asset = assetResult[0]
    
    // Validate assignedToId if provided
    if (data.assignedToId) {
      const personResult = await db
        .select()
        .from(persons)
        .where(and(
          eq(persons.id, data.assignedToId),
          eq(persons.orgId, orgId)
        ))
        .limit(1)
      
      if (personResult.length === 0) {
        return NextResponse.json(
          { error: "Assigned person not found" },
          { status: 400 }
        )
      }
    }
    
    // Insert maintenance record
    const result = await db
      .insert(assetMaintenanceRecords)
      .values({
        orgId,
        assetId: data.assetId,
        type: data.type,
        status: data.status,
        description: data.description ?? null,
        scheduledDate: data.scheduledDate && data.scheduledDate !== "" 
          ? data.scheduledDate 
          : null,
        completedDate: data.completedDate && data.completedDate !== "" 
          ? data.completedDate 
          : null,
        cost: data.cost ?? null,
        vendor: data.vendor ?? null,
        performedById: session.userId,
        assignedToId: data.assignedToId ?? null,
        notes: data.notes ?? null,
      })
      .returning()
    
    const record = result[0]
    
    // If status is in_progress or the asset needs to be marked as maintenance
    if (data.status === "in_progress" && asset.status !== "maintenance") {
      await db
        .update(assets)
        .set({ status: "maintenance", updatedAt: new Date() })
        .where(eq(assets.id, data.assetId))
      
      // Add lifecycle event
      await db.insert(assetLifecycleEvents).values({
        orgId,
        assetId: data.assetId,
        eventType: "maintenance",
        details: {
          maintenanceId: record.id,
          type: data.type,
          description: data.description,
        },
        performedById: session.userId,
      })
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("assets.maintenance", "maintenance", {
        id: record.id,
        assetId: record.assetId,
        type: record.type,
        status: record.status,
      })
    }
    
    return NextResponse.json({
      id: record.id,
      assetId: record.assetId,
      type: record.type,
      status: record.status,
      description: record.description,
      scheduledDate: record.scheduledDate,
      completedDate: record.completedDate,
      cost: record.cost,
      vendor: record.vendor,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error creating maintenance record:", error)
    return NextResponse.json(
      { error: "Failed to create maintenance record" },
      { status: 500 }
    )
  }
}

