/**
 * Security Evidence API
 * CRUD operations for compliance evidence/artifacts
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityEvidence, 
  securityEvidenceLinks,
  securityControls,
  evidenceTypeValues,
  evidenceStatusValues
} from "@/lib/db/schema/security"
import { users } from "@/lib/db/schema/users"
import { getSession } from "@/lib/auth/session"
import { eq, and, desc, ilike, or, count } from "drizzle-orm"
import { createSimpleAuditLog } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createEvidenceSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(evidenceTypeValues).default("document"),
  status: z.enum(evidenceStatusValues).default("current"),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  externalUrl: z.string().url().optional(),
  externalSystem: z.string().optional(),
  collectedAt: z.string(),
  validUntil: z.string().optional(),
  tags: z.array(z.string()).optional(),
  controlIds: z.array(z.string().uuid()).optional(), // Controls to link
})

const updateEvidenceSchema = createEvidenceSchema.partial()

const querySchema = z.object({
  search: z.string().optional(),
  type: z.enum(evidenceTypeValues).optional(),
  status: z.enum(evidenceStatusValues).optional(),
  controlId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

// ============================================================================
// GET - List Evidence
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
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      controlId: searchParams.get("controlId") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    })

    const offset = (query.page - 1) * query.limit

    // Build where conditions
    const conditions = [eq(securityEvidence.orgId, session.orgId)]
    
    if (query.search) {
      conditions.push(
        or(
          ilike(securityEvidence.title, `%${query.search}%`),
          ilike(securityEvidence.description, `%${query.search}%`)
        )!
      )
    }
    
    if (query.type) {
      conditions.push(eq(securityEvidence.type, query.type))
    }
    
    if (query.status) {
      conditions.push(eq(securityEvidence.status, query.status))
    }

    // Fetch evidence with collector info
    const evidence = await db
      .select({
        id: securityEvidence.id,
        title: securityEvidence.title,
        description: securityEvidence.description,
        type: securityEvidence.type,
        status: securityEvidence.status,
        fileUrl: securityEvidence.fileUrl,
        fileName: securityEvidence.fileName,
        fileSize: securityEvidence.fileSize,
        mimeType: securityEvidence.mimeType,
        externalUrl: securityEvidence.externalUrl,
        externalSystem: securityEvidence.externalSystem,
        collectedAt: securityEvidence.collectedAt,
        validUntil: securityEvidence.validUntil,
        collectedById: securityEvidence.collectedById,
        collectedByName: users.name,
        tags: securityEvidence.tags,
        createdAt: securityEvidence.createdAt,
        updatedAt: securityEvidence.updatedAt,
      })
      .from(securityEvidence)
      .leftJoin(users, eq(securityEvidence.collectedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(securityEvidence.collectedAt))
      .limit(query.limit)
      .offset(offset)

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(securityEvidence)
      .where(and(...conditions))

    // Get linked controls count for each evidence
    const evidenceWithCounts = await Promise.all(
      evidence.map(async (item) => {
        const [{ controlsCount }] = await db
          .select({ controlsCount: count() })
          .from(securityEvidenceLinks)
          .where(eq(securityEvidenceLinks.evidenceId, item.id))
        
        return {
          ...item,
          controlsCount,
        }
      })
    )

    // Filter by controlId if specified
    let filteredEvidence = evidenceWithCounts
    if (query.controlId) {
      const linkedEvidenceIds = await db
        .select({ evidenceId: securityEvidenceLinks.evidenceId })
        .from(securityEvidenceLinks)
        .where(eq(securityEvidenceLinks.controlId, query.controlId))

      const linkedIds = new Set(linkedEvidenceIds.map(e => e.evidenceId))
      filteredEvidence = evidenceWithCounts.filter(e => linkedIds.has(e.id))
    }

    return NextResponse.json({
      data: filteredEvidence,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    console.error("Error fetching evidence:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create Evidence
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createEvidenceSchema.parse(body)

    // Create evidence
    const [evidence] = await db
      .insert(securityEvidence)
      .values({
        orgId: session.orgId,
        title: data.title,
        description: data.description,
        type: data.type,
        status: data.status,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        externalUrl: data.externalUrl,
        externalSystem: data.externalSystem,
        collectedAt: data.collectedAt,
        validUntil: data.validUntil,
        collectedById: session.userId,
        tags: data.tags,
      })
      .returning()

    // Link to controls if specified
    if (data.controlIds && data.controlIds.length > 0) {
      // Verify controls belong to org
      const controls = await db
        .select({ id: securityControls.id })
        .from(securityControls)
        .where(
          and(
            eq(securityControls.orgId, session.orgId)
          )
        )

      const validControlIds = new Set(controls.map(c => c.id))
      const linksToCreate = data.controlIds
        .filter(id => validControlIds.has(id))
        .map(controlId => ({
          evidenceId: evidence.id,
          controlId,
        }))

      if (linksToCreate.length > 0) {
        await db.insert(securityEvidenceLinks).values(linksToCreate)
      }
    }

    // Audit log
    await createSimpleAuditLog({
      action: "create",
      entityType: "security_evidence",
      entityId: evidence.id,
      userId: session.userId,
      orgId: session.orgId,
      newValues: evidence,
    })

    return NextResponse.json({ data: evidence }, { status: 201 })
  } catch (error) {
    console.error("Error creating evidence:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

