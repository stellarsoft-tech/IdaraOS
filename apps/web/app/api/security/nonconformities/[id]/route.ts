import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"

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

const updateNcSchema = z.object({
  ncId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(ncStatusValues).optional(),
  severity: z.enum(ncSeverityValues).optional(),
  source: z.enum(ncSourceValues).optional(),
  documentCategory: z.enum(documentCategoryValues).optional().nullable(),
  linkedDocumentId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  rootCauseAnalysis: z.string().optional().nullable(),
  correctiveAction: z.string().optional().nullable(),
  correctiveActionDueDate: z.string().optional().nullable(),
  effectivenessReview: z.string().optional().nullable(),
  detectedAt: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  closedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

function toDateString(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toISOString().split("T")[0]
}

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const owner = users

    const [record] = await db
      .select({
        id: securityNonconformities.id,
        orgId: securityNonconformities.orgId,
        ncId: securityNonconformities.ncId,
        title: securityNonconformities.title,
        description: securityNonconformities.description,
        status: securityNonconformities.status,
        severity: securityNonconformities.severity,
        source: securityNonconformities.source,
        documentCategory: securityNonconformities.documentCategory,
        linkedDocumentId: securityNonconformities.linkedDocumentId,
        linkedDocumentTitle: documents.title,
        linkedDocumentSlug: documents.slug,
        ownerId: securityNonconformities.ownerId,
        ownerName: owner.name,
        ownerEmail: owner.email,
        linkedEvidenceIds: securityNonconformities.linkedEvidenceIds,
        rootCauseAnalysis: securityNonconformities.rootCauseAnalysis,
        correctiveAction: securityNonconformities.correctiveAction,
        correctiveActionDueDate: securityNonconformities.correctiveActionDueDate,
        effectivenessReview: securityNonconformities.effectivenessReview,
        effectivenessVerifiedAt: securityNonconformities.effectivenessVerifiedAt,
        detectedAt: securityNonconformities.detectedAt,
        dueDate: securityNonconformities.dueDate,
        closedAt: securityNonconformities.closedAt,
        notes: securityNonconformities.notes,
        createdAt: securityNonconformities.createdAt,
        updatedAt: securityNonconformities.updatedAt,
      })
      .from(securityNonconformities)
      .leftJoin(owner, eq(securityNonconformities.ownerId, owner.id))
      .leftJoin(documents, eq(securityNonconformities.linkedDocumentId, documents.id))
      .where(and(eq(securityNonconformities.id, id), eq(securityNonconformities.orgId, session.orgId)))
      .limit(1)

    if (!record) {
      return NextResponse.json({ error: "Nonconformity not found" }, { status: 404 })
    }

    return NextResponse.json({ data: record })
  } catch (error) {
    console.error("Error fetching nonconformity:", error)
    return NextResponse.json({ error: "Failed to fetch nonconformity" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validated = updateNcSchema.parse(body)

    const [existing] = await db
      .select()
      .from(securityNonconformities)
      .where(and(eq(securityNonconformities.id, id), eq(securityNonconformities.orgId, session.orgId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Nonconformity not found" }, { status: 404 })
    }

    if (validated.ownerId !== undefined && !(await isAssignableObjectiveOwner(session.orgId, validated.ownerId))) {
      return NextResponse.json({ error: "Owner must be an active platform user" }, { status: 400 })
    }

    const nextCategory = validated.documentCategory !== undefined
      ? validated.documentCategory
      : existing.documentCategory
    const nextDocId = validated.linkedDocumentId !== undefined
      ? validated.linkedDocumentId
      : existing.linkedDocumentId

    const docError = await validateLinkedDocument(session.orgId, nextCategory, nextDocId)
    if (docError) {
      return NextResponse.json({ error: docError }, { status: 400 })
    }

    const closing = validated.status === "closed" && existing.status !== "closed"

    const [updated] = await db
      .update(securityNonconformities)
      .set({
        ...validated.ncId !== undefined && { ncId: validated.ncId },
        ...validated.title !== undefined && { title: validated.title },
        ...validated.description !== undefined && { description: validated.description },
        ...validated.status !== undefined && { status: validated.status },
        ...validated.severity !== undefined && { severity: validated.severity },
        ...validated.source !== undefined && { source: validated.source },
        ...validated.documentCategory !== undefined && { documentCategory: validated.documentCategory },
        ...validated.linkedDocumentId !== undefined && { linkedDocumentId: validated.linkedDocumentId },
        ...validated.ownerId !== undefined && { ownerId: validated.ownerId },
        ...validated.linkedEvidenceIds !== undefined && { linkedEvidenceIds: validated.linkedEvidenceIds },
        ...validated.rootCauseAnalysis !== undefined && { rootCauseAnalysis: validated.rootCauseAnalysis },
        ...validated.correctiveAction !== undefined && { correctiveAction: validated.correctiveAction },
        ...validated.correctiveActionDueDate !== undefined && {
          correctiveActionDueDate: toDateString(validated.correctiveActionDueDate),
        },
        ...validated.effectivenessReview !== undefined && { effectivenessReview: validated.effectivenessReview },
        ...validated.detectedAt !== undefined && { detectedAt: toDateString(validated.detectedAt) },
        ...validated.dueDate !== undefined && { dueDate: toDateString(validated.dueDate) },
        ...validated.closedAt !== undefined && {
          closedAt: validated.closedAt ? new Date(validated.closedAt) : null,
        },
        ...validated.notes !== undefined && { notes: validated.notes },
        ...(closing && validated.closedAt === undefined && { closedAt: new Date() }),
        ...(validated.status === "verification" && session.userId && {
          effectivenessVerifiedAt: new Date(),
          effectivenessVerifiedById: session.userId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(securityNonconformities.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate("security.nonconformities", "nonconformity", id, updated.title, existing, updated)
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating nonconformity:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update nonconformity" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const [existing] = await db
      .select()
      .from(securityNonconformities)
      .where(and(eq(securityNonconformities.id, id), eq(securityNonconformities.orgId, session.orgId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Nonconformity not found" }, { status: 404 })
    }

    await db.delete(securityNonconformities).where(eq(securityNonconformities.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.nonconformities", "nonconformity", { id, name: existing.title })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting nonconformity:", error)
    return NextResponse.json({ error: "Failed to delete nonconformity" }, { status: 500 })
  }
}
