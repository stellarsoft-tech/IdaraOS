/**
 * Security Control Detail API
 * Get, update, delete individual controls
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
import { eq, and } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateControlSchema = z.object({
  controlId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  status: z.enum(controlStatusValues).optional(),
  implementationStatus: z.enum(controlImplementationStatusValues).optional(),
  implementationNotes: z.string().optional().nullable(),
  implementedAt: z.string().optional().nullable(),
  lastTestedAt: z.string().optional().nullable(),
  nextReviewAt: z.string().optional().nullable(),
  reviewFrequencyDays: z.number().int().min(1).max(365).optional().nullable(),
  controlType: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

// ============================================================================
// GET - Get Control Detail
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

    // Fetch control with owner
    const [control] = await db
      .select({
        id: securityControls.id,
        orgId: securityControls.orgId,
        controlId: securityControls.controlId,
        title: securityControls.title,
        description: securityControls.description,
        ownerId: securityControls.ownerId,
        ownerName: persons.name,
        ownerEmail: persons.email,
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
      .where(
        and(
          eq(securityControls.id, id),
          eq(securityControls.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!control) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 })
    }

    // Fetch framework mappings
    const mappings = await db
      .select({
        id: securityControlMappings.id,
        standardControlId: securityControlMappings.standardControlId,
        coverageLevel: securityControlMappings.coverageLevel,
        notes: securityControlMappings.notes,
        standardControl: {
          controlId: securityStandardControls.controlId,
          title: securityStandardControls.title,
          frameworkCode: securityStandardControls.frameworkCode,
          category: securityStandardControls.category,
        },
      })
      .from(securityControlMappings)
      .innerJoin(
        securityStandardControls,
        eq(securityControlMappings.standardControlId, securityStandardControls.id)
      )
      .where(eq(securityControlMappings.controlId, id))

    return NextResponse.json({
      data: {
        ...control,
        mappings,
      },
    })
  } catch (error) {
    console.error("Error fetching control:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Update Control
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
    const data = updateControlSchema.parse(body)

    // Check control exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityControls)
      .where(
        and(
          eq(securityControls.id, id),
          eq(securityControls.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 })
    }

    // If changing control ID, check for duplicates
    if (data.controlId && data.controlId !== existing.controlId) {
      const [duplicate] = await db
        .select({ id: securityControls.id })
        .from(securityControls)
        .where(
          and(
            eq(securityControls.orgId, session.orgId),
            eq(securityControls.controlId, data.controlId)
          )
        )
        .limit(1)

      if (duplicate) {
        return NextResponse.json(
          { error: "A control with this ID already exists" },
          { status: 409 }
        )
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.controlId !== undefined) updateData.controlId = data.controlId
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId
    if (data.status !== undefined) updateData.status = data.status
    if (data.implementationStatus !== undefined) updateData.implementationStatus = data.implementationStatus
    if (data.implementationNotes !== undefined) updateData.implementationNotes = data.implementationNotes
    if (data.implementedAt !== undefined) updateData.implementedAt = data.implementedAt ? new Date(data.implementedAt) : null
    if (data.lastTestedAt !== undefined) updateData.lastTestedAt = data.lastTestedAt
    if (data.nextReviewAt !== undefined) updateData.nextReviewAt = data.nextReviewAt
    if (data.reviewFrequencyDays !== undefined) updateData.reviewFrequencyDays = data.reviewFrequencyDays
    if (data.controlType !== undefined) updateData.controlType = data.controlType
    if (data.category !== undefined) updateData.category = data.category
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    // Update control
    const [updated] = await db
      .update(securityControls)
      .set(updateData)
      .where(eq(securityControls.id, id))
      .returning()

    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.controls",
        "control",
        id,
        updated.title,
        existing,
        updated
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating control:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete Control
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

    // Check control exists and belongs to org
    const [existing] = await db
      .select()
      .from(securityControls)
      .where(
        and(
          eq(securityControls.id, id),
          eq(securityControls.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 })
    }

    // Delete control (cascades to mappings)
    await db.delete(securityControls).where(eq(securityControls.id, id))

    // Audit log
    const auditDel = await getAuditLogger()
    if (auditDel) {
      await auditDel.logDelete("security.controls", "control", {
        ...existing,
        name: existing.title,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting control:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

