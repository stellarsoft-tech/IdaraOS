/**
 * Statement of Applicability (SoA) API
 * Manage SoA items for a specific framework
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { 
  securityFrameworks,
  securitySoaItems,
  securityStandardControls,
  securityControls,
  soaApplicabilityValues,
  controlImplementationStatusValues
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and, asc } from "drizzle-orm"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const querySchema = z.object({
  category: z.string().optional(),
  applicability: z.enum(soaApplicabilityValues).optional(),
  implementationStatus: z.enum(controlImplementationStatusValues).optional(),
})

// ============================================================================
// GET - Get SoA Items for Framework
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ frameworkId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { frameworkId } = await params
    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      category: searchParams.get("category") || undefined,
      applicability: searchParams.get("applicability") || undefined,
      implementationStatus: searchParams.get("implementationStatus") || undefined,
    })

    // Verify framework belongs to org
    const [framework] = await db
      .select({ id: securityFrameworks.id, code: securityFrameworks.code })
      .from(securityFrameworks)
      .where(
        and(
          eq(securityFrameworks.id, frameworkId),
          eq(securityFrameworks.orgId, session.orgId)
        )
      )
      .limit(1)

    if (!framework) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 })
    }

    // Fetch SoA items with standard control and org control details
    const soaItems = await db
      .select({
        id: securitySoaItems.id,
        frameworkId: securitySoaItems.frameworkId,
        standardControlId: securitySoaItems.standardControlId,
        controlId: securitySoaItems.controlId,
        applicability: securitySoaItems.applicability,
        justification: securitySoaItems.justification,
        implementationStatus: securitySoaItems.implementationStatus,
        notes: securitySoaItems.notes,
        createdAt: securitySoaItems.createdAt,
        updatedAt: securitySoaItems.updatedAt,
        // Standard control details
        standardControl: {
          controlId: securityStandardControls.controlId,
          category: securityStandardControls.category,
          subcategory: securityStandardControls.subcategory,
          title: securityStandardControls.title,
          description: securityStandardControls.description,
          isRequired: securityStandardControls.isRequired,
        },
      })
      .from(securitySoaItems)
      .innerJoin(
        securityStandardControls,
        eq(securitySoaItems.standardControlId, securityStandardControls.id)
      )
      .where(eq(securitySoaItems.frameworkId, frameworkId))
      .orderBy(asc(securityStandardControls.sortOrder))

    // Apply filters
    let filteredItems = soaItems
    if (query.category) {
      filteredItems = filteredItems.filter(item => item.standardControl.category === query.category)
    }
    if (query.applicability) {
      filteredItems = filteredItems.filter(item => item.applicability === query.applicability)
    }
    if (query.implementationStatus) {
      filteredItems = filteredItems.filter(item => item.implementationStatus === query.implementationStatus)
    }

    // Get org control details for items that have them
    // IMPORTANT: Derive implementation status from org control if mapped
    const itemsWithOrgControl = await Promise.all(
      filteredItems.map(async (item) => {
        if (item.controlId) {
          const [orgControl] = await db
            .select({
              id: securityControls.id,
              controlId: securityControls.controlId,
              title: securityControls.title,
              implementationStatus: securityControls.implementationStatus,
            })
            .from(securityControls)
            .where(eq(securityControls.id, item.controlId))
            .limit(1)
          
          if (orgControl) {
            // Derive implementation status from org control (single source of truth)
            return {
              ...item,
              implementationStatus: orgControl.implementationStatus, // Override with org control status
              orgControl,
            }
          }
        }
        return { ...item, orgControl: null }
      })
    )

    // Group by category
    const categories = [...new Set(soaItems.map(item => item.standardControl.category))]
    const grouped = categories.reduce((acc, category) => {
      acc[category] = itemsWithOrgControl.filter(item => item.standardControl.category === category)
      return acc
    }, {} as Record<string, typeof itemsWithOrgControl>)

    // Calculate summary based on derived statuses (from org controls where applicable)
    return NextResponse.json({
      data: itemsWithOrgControl,
      grouped,
      categories,
      summary: {
        total: itemsWithOrgControl.length,
        applicable: itemsWithOrgControl.filter(i => i.applicability === "applicable").length,
        notApplicable: itemsWithOrgControl.filter(i => i.applicability === "not_applicable").length,
        implemented: itemsWithOrgControl.filter(i => 
          i.implementationStatus === "implemented" || i.implementationStatus === "effective"
        ).length,
        partial: itemsWithOrgControl.filter(i => i.implementationStatus === "partially_implemented").length,
        notImplemented: itemsWithOrgControl.filter(i => 
          i.implementationStatus === "not_implemented" && i.applicability === "applicable"
        ).length,
      },
    })
  } catch (error) {
    console.error("Error fetching SoA items:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

