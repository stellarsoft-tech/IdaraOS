/**
 * Assets API Routes
 * GET /api/assets - List all assets
 * POST /api/assets - Create an asset
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, or, and, inArray, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { assets, assetCategories, persons, assetLifecycleEvents } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Create asset schema
const CreateAssetSchema = z.object({
  assetTag: z.string().min(1, "Asset tag is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["available", "assigned", "maintenance", "retired", "disposed"]).default("available"),
  serialNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.string().optional(),
  warrantyEnd: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
})

// Category info type
interface CategoryInfo {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
}

// Assignee info type
interface AssigneeInfo {
  id: string
  name: string
  email: string
  slug: string
}

// Transform DB record to API response
function toApiResponse(
  record: typeof assets.$inferSelect,
  category?: CategoryInfo | null,
  assignee?: AssigneeInfo | null
) {
  return {
    id: record.id,
    assetTag: record.assetTag,
    name: record.name,
    description: record.description ?? undefined,
    categoryId: record.categoryId,
    category: category || null,
    status: record.status,
    serialNumber: record.serialNumber ?? undefined,
    manufacturer: record.manufacturer ?? undefined,
    model: record.model ?? undefined,
    purchaseDate: record.purchaseDate ?? undefined,
    purchaseCost: record.purchaseCost ?? undefined,
    warrantyEnd: record.warrantyEnd ?? undefined,
    location: record.location ?? undefined,
    assignedToId: record.assignedToId,
    assignedTo: assignee || null,
    assignedAt: record.assignedAt?.toISOString() ?? undefined,
    source: record.source,
    intuneDeviceId: record.intuneDeviceId ?? undefined,
    intuneComplianceState: record.intuneComplianceState ?? undefined,
    intuneEnrollmentType: record.intuneEnrollmentType ?? undefined,
    intuneLastSyncAt: record.intuneLastSyncAt?.toISOString() ?? undefined,
    syncEnabled: record.syncEnabled,
    notes: record.notes ?? undefined,
    customFields: record.customFields,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * GET /api/assets
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const categoryId = searchParams.get("categoryId")
    const location = searchParams.get("location")
    const assignedToId = searchParams.get("assignedToId")
    const source = searchParams.get("source")
    
    // Authorization check
    const session = await requirePermission(...P.assets.inventory.view())
    const orgId = session.orgId
    
    // Build query - always filter by organization
    const conditions = [eq(assets.orgId, orgId)]
    
    if (search) {
      const searchCondition = or(
        ilike(assets.name, `%${search}%`),
        ilike(assets.assetTag, `%${search}%`),
        ilike(assets.serialNumber, `%${search}%`),
        ilike(assets.model, `%${search}%`),
        ilike(assets.manufacturer, `%${search}%`)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    if (status) {
      const statuses = status.split(",")
      conditions.push(inArray(assets.status, statuses as typeof assets.status.enumValues))
    }
    
    if (categoryId) {
      conditions.push(eq(assets.categoryId, categoryId))
    }
    
    if (location) {
      conditions.push(ilike(assets.location, `%${location}%`))
    }
    
    if (assignedToId) {
      if (assignedToId === "unassigned") {
        // This would need a different approach with is null
      } else {
        conditions.push(eq(assets.assignedToId, assignedToId))
      }
    }
    
    if (source) {
      conditions.push(eq(assets.source, source as typeof assets.source.enumValues[number]))
    }
    
    // Execute query with conditions
    const results = await db
      .select()
      .from(assets)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(assets.assetTag))
    
    // Get categories for all assets
    const categoryIds = [...new Set(results.map(a => a.categoryId).filter(Boolean) as string[])]
    
    const categories = categoryIds.length > 0
      ? await db
          .select({
            id: assetCategories.id,
            name: assetCategories.name,
            slug: assetCategories.slug,
            icon: assetCategories.icon,
            color: assetCategories.color,
          })
          .from(assetCategories)
          .where(inArray(assetCategories.id, categoryIds))
      : []

    // Create lookup map for categories
    const categoryById = new Map<string, CategoryInfo>()
    for (const cat of categories) {
      categoryById.set(cat.id, cat)
    }
    
    // Get assignees for all assets
    const assigneeIds = [...new Set(results.map(a => a.assignedToId).filter(Boolean) as string[])]
    
    const assignees = assigneeIds.length > 0
      ? await db
          .select({
            id: persons.id,
            name: persons.name,
            email: persons.email,
            slug: persons.slug,
          })
          .from(persons)
          .where(inArray(persons.id, assigneeIds))
      : []

    // Create lookup map for assignees
    const assigneeById = new Map<string, AssigneeInfo>()
    for (const person of assignees) {
      assigneeById.set(person.id, person)
    }
    
    return NextResponse.json(
      results.map(asset => 
        toApiResponse(
          asset, 
          asset.categoryId ? categoryById.get(asset.categoryId) : null,
          asset.assignedToId ? assigneeById.get(asset.assignedToId) : null
        )
      )
    )
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error fetching assets:", error)
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/assets
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check
    const session = await requirePermission(...P.assets.inventory.create())
    const orgId = session.orgId
    
    const body = await request.json()
    
    // Validate
    const parseResult = CreateAssetSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Check duplicate asset tag
    const existing = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(
        eq(assets.orgId, orgId),
        eq(assets.assetTag, data.assetTag)
      ))
      .limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An asset with this tag already exists" },
        { status: 409 }
      )
    }
    
    // Insert asset
    const result = await db
      .insert(assets)
      .values({
        orgId,
        assetTag: data.assetTag,
        name: data.name,
        description: data.description ?? null,
        categoryId: data.categoryId ?? null,
        status: data.status,
        serialNumber: data.serialNumber ?? null,
        manufacturer: data.manufacturer ?? null,
        model: data.model ?? null,
        purchaseDate: data.purchaseDate ?? null,
        purchaseCost: data.purchaseCost ?? null,
        warrantyEnd: data.warrantyEnd ?? null,
        location: data.location ?? null,
        notes: data.notes ?? null,
        source: "manual",
      })
      .returning()
    const record = result[0]
    
    // Create acquired lifecycle event - use purchase date if provided
    const acquiredDate = data.purchaseDate 
      ? new Date(data.purchaseDate)
      : new Date()
    
    await db.insert(assetLifecycleEvents).values({
      orgId,
      assetId: record.id,
      eventType: "acquired",
      eventDate: acquiredDate,
      details: {
        source: "manual",
        purchaseDate: data.purchaseDate,
        purchaseCost: data.purchaseCost,
      },
      performedById: session.userId,
    })
    
    // Audit log the creation
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("assets.inventory", "asset", {
        id: record.id,
        assetTag: record.assetTag,
        name: record.name,
        categoryId: record.categoryId,
        status: record.status,
        serialNumber: record.serialNumber,
        manufacturer: record.manufacturer,
        model: record.model,
        location: record.location,
      })
    }
    
    return NextResponse.json(toApiResponse(record), { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    
    console.error("Error creating asset:", error)
    return NextResponse.json(
      { error: "Failed to create asset" },
      { status: 500 }
    )
  }
}

