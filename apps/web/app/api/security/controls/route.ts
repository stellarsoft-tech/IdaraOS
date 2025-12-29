/**
 * Security Controls API
 * CRUD operations for organization security controls
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityControls, 
  securityControlMappings,
  securityStandardControls,
  controlStatusValues,
  controlImplementationStatusValues
} from "@/lib/db/schema/security"
import { persons } from "@/lib/db/schema/people"
import { getSession } from "@/lib/auth/session"
import { eq, and, desc, ilike, or, sql, count } from "drizzle-orm"
import { createSimpleAuditLog } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createControlSchema = z.object({
  controlId: z.string().min(1, "Control ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional().nullable(),
  status: z.enum(controlStatusValues).optional().default("active"),
  implementationStatus: z.enum(controlImplementationStatusValues).optional().default("not_implemented"),
  implementationNotes: z.string().optional(),
  controlType: z.string().optional(),
  category: z.string().optional(),
  reviewFrequencyDays: z.number().int().min(1).max(365).optional(),
  nextReviewAt: z.string().optional(),
})

const updateControlSchema = createControlSchema.partial().extend({
  lastTestedAt: z.string().optional(),
  implementedAt: z.string().optional(),
})

const querySchema = z.object({
  search: z.string().optional(),
  status: z.enum(controlStatusValues).optional(),
  implementationStatus: z.enum(controlImplementationStatusValues).optional(),
  ownerId: z.string().uuid().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

// ============================================================================
// GET - List Controls
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      implementationStatus: searchParams.get("implementationStatus") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
      category: searchParams.get("category") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    })

    const offset = (query.page - 1) * query.limit

    // Build where conditions
    const conditions = [eq(securityControls.orgId, session.orgId)]
    
    if (query.search) {
      conditions.push(
        or(
          ilike(securityControls.title, `%${query.search}%`),
          ilike(securityControls.controlId, `%${query.search}%`),
          ilike(securityControls.description, `%${query.search}%`)
        )!
      )
    }
    
    if (query.status) {
      conditions.push(eq(securityControls.status, query.status))
    }
    
    if (query.implementationStatus) {
      conditions.push(eq(securityControls.implementationStatus, query.implementationStatus))
    }
    
    if (query.ownerId) {
      conditions.push(eq(securityControls.ownerId, query.ownerId))
    }
    
    if (query.category) {
      conditions.push(eq(securityControls.category, query.category))
    }

    // Fetch controls with owner
    const controls = await db
      .select({
        id: securityControls.id,
        controlId: securityControls.controlId,
        title: securityControls.title,
        description: securityControls.description,
        ownerId: securityControls.ownerId,
        ownerName: persons.name,
        status: securityControls.status,
        implementationStatus: securityControls.implementationStatus,
        implementationNotes: securityControls.implementationNotes,
        implementedAt: securityControls.implementedAt,
        lastTestedAt: securityControls.lastTestedAt,
        nextReviewAt: securityControls.nextReviewAt,
        reviewFrequencyDays: securityControls.reviewFrequencyDays,
        controlType: securityControls.controlType,
        category: securityControls.category,
        metadata: securityControls.metadata,
        createdAt: securityControls.createdAt,
        updatedAt: securityControls.updatedAt,
      })
      .from(securityControls)
      .leftJoin(persons, eq(securityControls.ownerId, persons.id))
      .where(and(...conditions))
      .orderBy(desc(securityControls.createdAt))
      .limit(query.limit)
      .offset(offset)

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(securityControls)
      .where(and(...conditions))

    // Get framework mappings for each control with framework codes
    const controlsWithMappings = await Promise.all(
      controls.map(async (control) => {
        const mappings = await db
          .select({
            id: securityControlMappings.id,
            standardControlId: securityControlMappings.standardControlId,
            coverageLevel: securityControlMappings.coverageLevel,
            frameworkCode: securityStandardControls.frameworkCode,
          })
          .from(securityControlMappings)
          .innerJoin(
            securityStandardControls,
            eq(securityControlMappings.standardControlId, securityStandardControls.id)
          )
          .where(eq(securityControlMappings.controlId, control.id))
        
        // Get unique framework codes
        const frameworkCodes = [...new Set(mappings.map(m => m.frameworkCode))]
        
        return {
          ...control,
          mappingsCount: mappings.length,
          frameworkCodes,
          mappings,
        }
      })
    )

    return NextResponse.json({
      data: controlsWithMappings,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    console.error("Error fetching controls:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create Control
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createControlSchema.parse(body)

    // Check for duplicate control ID
    const existing = await db
      .select({ id: securityControls.id })
      .from(securityControls)
      .where(
        and(
          eq(securityControls.orgId, session.orgId),
          eq(securityControls.controlId, data.controlId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A control with this ID already exists" },
        { status: 409 }
      )
    }

    // Create control
    const [control] = await db
      .insert(securityControls)
      .values({
        orgId: session.orgId,
        controlId: data.controlId,
        title: data.title,
        description: data.description,
        ownerId: data.ownerId,
        status: data.status,
        implementationStatus: data.implementationStatus,
        implementationNotes: data.implementationNotes,
        controlType: data.controlType,
        category: data.category,
        reviewFrequencyDays: data.reviewFrequencyDays,
        nextReviewAt: data.nextReviewAt,
      })
      .returning()

    // Audit log
    await createSimpleAuditLog({
      action: "create",
      entityType: "security_control",
      entityId: control.id,
      userId: session.userId,
      orgId: session.orgId,
      newValues: control,
    })

    return NextResponse.json({ data: control }, { status: 201 })
  } catch (error) {
    console.error("Error creating control:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

