/**
 * Security Control Mappings API
 * Manage mappings between org controls and standard framework controls
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityControls, 
  securityControlMappings,
  securityStandardControls
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and } from "drizzle-orm"
import { createSimpleAuditLog } from "@/lib/audit"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createMappingSchema = z.object({
  standardControlId: z.string().uuid(),
  coverageLevel: z.enum(["full", "partial"]).optional().default("full"),
  notes: z.string().optional(),
})

const deleteMappingSchema = z.object({
  mappingId: z.string().uuid(),
})

// ============================================================================
// GET - List Mappings for Control
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

    // Verify control belongs to org
    const [control] = await db
      .select({ id: securityControls.id })
      .from(securityControls)
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

    // Fetch mappings with standard control details
    const mappings = await db
      .select({
        id: securityControlMappings.id,
        controlId: securityControlMappings.controlId,
        standardControlId: securityControlMappings.standardControlId,
        coverageLevel: securityControlMappings.coverageLevel,
        notes: securityControlMappings.notes,
        createdAt: securityControlMappings.createdAt,
        standardControl: {
          controlId: securityStandardControls.controlId,
          frameworkCode: securityStandardControls.frameworkCode,
          category: securityStandardControls.category,
          subcategory: securityStandardControls.subcategory,
          title: securityStandardControls.title,
          description: securityStandardControls.description,
        },
      })
      .from(securityControlMappings)
      .innerJoin(
        securityStandardControls,
        eq(securityControlMappings.standardControlId, securityStandardControls.id)
      )
      .where(eq(securityControlMappings.controlId, id))

    return NextResponse.json({ data: mappings })
  } catch (error) {
    console.error("Error fetching control mappings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create Mapping
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
    const data = createMappingSchema.parse(body)

    // Verify control belongs to org
    const [control] = await db
      .select({ id: securityControls.id, controlId: securityControls.controlId })
      .from(securityControls)
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

    // Verify standard control exists
    const [standardControl] = await db
      .select({ id: securityStandardControls.id })
      .from(securityStandardControls)
      .where(eq(securityStandardControls.id, data.standardControlId))
      .limit(1)

    if (!standardControl) {
      return NextResponse.json({ error: "Standard control not found" }, { status: 404 })
    }

    // Check for existing mapping
    const [existingMapping] = await db
      .select({ id: securityControlMappings.id })
      .from(securityControlMappings)
      .where(
        and(
          eq(securityControlMappings.controlId, id),
          eq(securityControlMappings.standardControlId, data.standardControlId)
        )
      )
      .limit(1)

    if (existingMapping) {
      return NextResponse.json(
        { error: "This mapping already exists" },
        { status: 409 }
      )
    }

    // Create mapping
    const [mapping] = await db
      .insert(securityControlMappings)
      .values({
        orgId: session.orgId,
        controlId: id,
        standardControlId: data.standardControlId,
        coverageLevel: data.coverageLevel,
        notes: data.notes,
      })
      .returning()

    // Audit log
    await createSimpleAuditLog({
      action: "create",
      entityType: "security_control_mapping",
      entityId: mapping.id,
      userId: session.userId,
      orgId: session.orgId,
      newValues: { ...mapping, controlId: control.controlId },
    })

    return NextResponse.json({ data: mapping }, { status: 201 })
  } catch (error) {
    console.error("Error creating control mapping:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete Mapping
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
    const mappingId = searchParams.get("mappingId")

    if (!mappingId) {
      return NextResponse.json({ error: "mappingId is required" }, { status: 400 })
    }

    // Verify control belongs to org
    const [control] = await db
      .select({ id: securityControls.id })
      .from(securityControls)
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

    // Delete mapping
    const [deleted] = await db
      .delete(securityControlMappings)
      .where(
        and(
          eq(securityControlMappings.id, mappingId),
          eq(securityControlMappings.controlId, id)
        )
      )
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 })
    }

    // Audit log
    await createSimpleAuditLog({
      action: "delete",
      entityType: "security_control_mapping",
      entityId: mappingId,
      userId: session.userId,
      orgId: session.orgId,
      oldValues: deleted,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting control mapping:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

