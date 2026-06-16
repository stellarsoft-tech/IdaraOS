import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, count, desc, eq, ilike } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  securityNonconformities,
  ncStatusValues,
  ncSeverityValues,
  ncSourceValues,
} from "@/lib/db/schema/security"
import { documentCategoryValues } from "@/lib/db/schema/docs"
import { documents, users } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"
import { getAuditLogger } from "@/lib/api/context"
import { isAssignableObjectiveOwner } from "@/lib/security/objective-owners"

const createNcSchema = z.object({
  ncId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(ncStatusValues).default("open"),
  severity: z.enum(ncSeverityValues).default("minor"),
  source: z.enum(ncSourceValues).default("other"),
  documentCategory: z.enum(documentCategoryValues).optional().nullable(),
  linkedDocumentId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  rootCauseAnalysis: z.string().optional(),
  correctiveAction: z.string().optional(),
  correctiveActionDueDate: z.string().optional().nullable(),
  detectedAt: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional(),
})

async function validateLinkedDocument(
  orgId: string,
  documentCategory: string | null | undefined,
  linkedDocumentId: string | null | undefined
): Promise<string | null> {
  if (!linkedDocumentId) return null
  const [doc] = await db
    .select({ id: documents.id, category: documents.category })
    .from(documents)
    .where(and(eq(documents.id, linkedDocumentId), eq(documents.orgId, orgId)))
    .limit(1)
  if (!doc) return "Linked document not found"
  if (documentCategory && doc.category !== documentCategory) {
    return "Linked document does not match the selected document type"
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const documentCategory = searchParams.get("documentCategory")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 500)
    const offset = (page - 1) * limit

    const conditions = [eq(securityNonconformities.orgId, session.orgId)]
    if (status) conditions.push(eq(securityNonconformities.status, status as typeof ncStatusValues[number]))
    if (documentCategory) {
      conditions.push(eq(securityNonconformities.documentCategory, documentCategory as typeof documentCategoryValues[number]))
    }
    if (search) conditions.push(ilike(securityNonconformities.title, `%${search}%`))

    const owner = users
    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: securityNonconformities.id,
          ncId: securityNonconformities.ncId,
          title: securityNonconformities.title,
          description: securityNonconformities.description,
          status: securityNonconformities.status,
          severity: securityNonconformities.severity,
          source: securityNonconformities.source,
          documentCategory: securityNonconformities.documentCategory,
          linkedDocumentId: securityNonconformities.linkedDocumentId,
          linkedDocumentTitle: documents.title,
          ownerId: securityNonconformities.ownerId,
          ownerName: owner.name,
          ownerEmail: owner.email,
          linkedEvidenceIds: securityNonconformities.linkedEvidenceIds,
          correctiveActionDueDate: securityNonconformities.correctiveActionDueDate,
          dueDate: securityNonconformities.dueDate,
          createdAt: securityNonconformities.createdAt,
          updatedAt: securityNonconformities.updatedAt,
        })
        .from(securityNonconformities)
        .leftJoin(owner, eq(securityNonconformities.ownerId, owner.id))
        .leftJoin(documents, eq(securityNonconformities.linkedDocumentId, documents.id))
        .where(and(...conditions))
        .orderBy(desc(securityNonconformities.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(securityNonconformities).where(and(...conditions)),
    ])

    const total = Number(totalResult[0]?.total || 0)
    return NextResponse.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Error fetching nonconformities:", error)
    return NextResponse.json({ error: "Failed to fetch nonconformities" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validated = createNcSchema.parse(body)

    const [existing] = await db
      .select({ id: securityNonconformities.id })
      .from(securityNonconformities)
      .where(and(
        eq(securityNonconformities.orgId, session.orgId),
        eq(securityNonconformities.ncId, validated.ncId)
      ))
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: "A nonconformity with this ID already exists" }, { status: 400 })
    }

    if (!(await isAssignableObjectiveOwner(session.orgId, validated.ownerId))) {
      return NextResponse.json({ error: "Owner must be an active platform user" }, { status: 400 })
    }

    const docError = await validateLinkedDocument(
      session.orgId,
      validated.documentCategory,
      validated.linkedDocumentId
    )
    if (docError) {
      return NextResponse.json({ error: docError }, { status: 400 })
    }

    const [record] = await db
      .insert(securityNonconformities)
      .values({
        orgId: session.orgId,
        ncId: validated.ncId,
        title: validated.title,
        description: validated.description,
        status: validated.status,
        severity: validated.severity,
        source: validated.source,
        documentCategory: validated.documentCategory,
        linkedDocumentId: validated.linkedDocumentId,
        ownerId: validated.ownerId,
        linkedEvidenceIds: validated.linkedEvidenceIds,
        rootCauseAnalysis: validated.rootCauseAnalysis,
        correctiveAction: validated.correctiveAction,
        correctiveActionDueDate: validated.correctiveActionDueDate
          ? new Date(validated.correctiveActionDueDate).toISOString().split("T")[0]
          : null,
        detectedAt: validated.detectedAt
          ? new Date(validated.detectedAt).toISOString().split("T")[0]
          : null,
        dueDate: validated.dueDate
          ? new Date(validated.dueDate).toISOString().split("T")[0]
          : null,
        notes: validated.notes,
      })
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.nonconformities", "nonconformity", { ...record, name: record.title })
    }

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    console.error("Error creating nonconformity:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create nonconformity" }, { status: 500 })
  }
}
