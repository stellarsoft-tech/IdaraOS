/**
 * Security Evidence Detail API
 * Get, update, delete individual evidence items
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
import { eq, and } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateEvidenceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(evidenceTypeValues).optional(),
  status: z.enum(evidenceStatusValues).optional(),
  fileUrl: z.string().url().optional().nullable(),
  fileName: z.string().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  externalUrl: z.string().url().optional().nullable(),
  externalSystem: z.string().optional().nullable(),
  collectedAt: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

// ============================================================================
// GET - Get Evidence Detail
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Fetch evidence with collector info
    const [evidence] = await db
      .select({
        id: securityEvidence.id,
        orgId: securityEvidence.orgId,
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
        metadata: securityEvidence.metadata,
        createdAt: securityEvidence.createdAt,
        updatedAt: securityEvidence.updatedAt,
      })
      .from(securityEvidence)
      .leftJoin(users, eq(securityEvidence.collectedById, users.id))
      .where(
        and(
          eq(securityEvidence.id, id),
          eq(securityEvidence.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 })
    }

    // Fetch linked controls
    const linkedControls = await db
      .select({
        id: securityEvidenceLinks.id,
        controlId: securityControls.id,
        controlIdCode: securityControls.controlId,
        controlTitle: securityControls.title,
        notes: securityEvidenceLinks.notes,
      })
      .from(securityEvidenceLinks)
      .innerJoin(securityControls, eq(securityEvidenceLinks.controlId, securityControls.id))
      .where(eq(securityEvidenceLinks.evidenceId, id))

    return NextResponse.json({
      data: {
        ...evidence,
        linkedControls,
      },
    })
  } catch (error) {
    console.error("Error fetching evidence:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Update Evidence
// ============================================================================

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
    const data = updateEvidenceSchema.parse(body)

    // Check evidence exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityEvidence)
      .where(
        and(
          eq(securityEvidence.id, id),
          eq(securityEvidence.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.status !== undefined) updateData.status = data.status
    if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl
    if (data.fileName !== undefined) updateData.fileName = data.fileName
    if (data.fileSize !== undefined) updateData.fileSize = data.fileSize
    if (data.mimeType !== undefined) updateData.mimeType = data.mimeType
    if (data.externalUrl !== undefined) updateData.externalUrl = data.externalUrl
    if (data.externalSystem !== undefined) updateData.externalSystem = data.externalSystem
    if (data.collectedAt !== undefined) updateData.collectedAt = data.collectedAt
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil
    if (data.tags !== undefined) updateData.tags = data.tags

    // Update evidence
    const [updated] = await db
      .update(securityEvidence)
      .set(updateData)
      .where(eq(securityEvidence.id, id))
      .returning()

    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.evidence",
        "evidence",
        id,
        updated.title,
        existing,
        updated
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating evidence:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete Evidence
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check evidence exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityEvidence)
      .where(
        and(
          eq(securityEvidence.id, id),
          eq(securityEvidence.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 })
    }

    // Delete evidence (cascades to links)
    await db.delete(securityEvidence).where(eq(securityEvidence.id, id))

    // Audit log
    const auditDel = await getAuditLogger()
    if (auditDel) {
      await auditDel.logDelete("security.evidence", "evidence", {
        ...existing,
        name: existing.title,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting evidence:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

