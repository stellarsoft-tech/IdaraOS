/**
 * Security Evidence Links API
 * Manage links between evidence and controls
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityEvidence, 
  securityEvidenceLinks,
  securityControls
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and } from "drizzle-orm"
import { createSimpleAuditLog } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createLinkSchema = z.object({
  controlId: z.string().uuid(),
  notes: z.string().optional(),
})

// ============================================================================
// GET - List Links for Evidence
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

    // Verify evidence belongs to org
    const [evidence] = await db
      .select({ id: securityEvidence.id })
      .from(securityEvidence)
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

    // Fetch links with control details
    const links = await db
      .select({
        id: securityEvidenceLinks.id,
        evidenceId: securityEvidenceLinks.evidenceId,
        controlId: securityEvidenceLinks.controlId,
        notes: securityEvidenceLinks.notes,
        createdAt: securityEvidenceLinks.createdAt,
        control: {
          controlId: securityControls.controlId,
          title: securityControls.title,
          status: securityControls.status,
          implementationStatus: securityControls.implementationStatus,
        },
      })
      .from(securityEvidenceLinks)
      .innerJoin(securityControls, eq(securityEvidenceLinks.controlId, securityControls.id))
      .where(eq(securityEvidenceLinks.evidenceId, id))

    return NextResponse.json({ data: links })
  } catch (error) {
    console.error("Error fetching evidence links:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create Link
// ============================================================================

export async function POST(
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
    const data = createLinkSchema.parse(body)

    // Verify evidence belongs to org
    const [evidence] = await db
      .select({ id: securityEvidence.id, title: securityEvidence.title })
      .from(securityEvidence)
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

    // Verify control exists and belongs to org
    const [control] = await db
      .select({ id: securityControls.id, controlId: securityControls.controlId })
      .from(securityControls)
      .where(
        and(
          eq(securityControls.id, data.controlId),
          eq(securityControls.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!control) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 })
    }

    // Check for existing link
    const [existingLink] = await db
      .select({ id: securityEvidenceLinks.id })
      .from(securityEvidenceLinks)
      .where(
        and(
          eq(securityEvidenceLinks.evidenceId, id),
          eq(securityEvidenceLinks.controlId, data.controlId)
        )
      )
      .limit(1)

    if (existingLink) {
      return NextResponse.json(
        { error: "This evidence is already linked to this control" },
        { status: 409 }
      )
    }

    // Create link
    const [link] = await db
      .insert(securityEvidenceLinks)
      .values({
        evidenceId: id,
        controlId: data.controlId,
        notes: data.notes,
      })
      .returning()

    // Audit log
    await createSimpleAuditLog({
      action: "create",
      entityType: "security_evidence_link",
      entityId: link.id,
      userId: session.userId,
      orgId: session.orgId,
      newValues: { 
        evidenceTitle: evidence.title,
        controlId: control.controlId,
      },
    })

    return NextResponse.json({ data: link }, { status: 201 })
  } catch (error) {
    console.error("Error creating evidence link:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete Link
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
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get("linkId")

    if (!linkId) {
      return NextResponse.json({ error: "linkId is required" }, { status: 400 })
    }

    // Verify evidence belongs to org
    const [evidence] = await db
      .select({ id: securityEvidence.id })
      .from(securityEvidence)
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

    // Delete link
    const [deleted] = await db
      .delete(securityEvidenceLinks)
      .where(
        and(
          eq(securityEvidenceLinks.id, linkId),
          eq(securityEvidenceLinks.evidenceId, id)
        )
      )
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    // Audit log
    await createSimpleAuditLog({
      action: "delete",
      entityType: "security_evidence_link",
      entityId: linkId,
      userId: session.userId,
      orgId: session.orgId,
      oldValues: deleted,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting evidence link:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

