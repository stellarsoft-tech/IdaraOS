/**
 * Standard Controls API
 * Read-only access to pre-loaded framework standard controls
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { securityStandardControls } from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, asc } from "drizzle-orm"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const querySchema = z.object({
  framework: z.string().optional(),
  category: z.string().optional(),
})

// ============================================================================
// GET - List Standard Controls
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      framework: searchParams.get("framework") || undefined,
      category: searchParams.get("category") || undefined,
    })

    // Build query
    let queryBuilder = db
      .select()
      .from(securityStandardControls)

    if (query.framework) {
      queryBuilder = queryBuilder.where(
        eq(securityStandardControls.frameworkCode, query.framework)
      ) as typeof queryBuilder
    }

    if (query.category) {
      queryBuilder = queryBuilder.where(
        eq(securityStandardControls.category, query.category)
      ) as typeof queryBuilder
    }

    const controls = await queryBuilder.orderBy(asc(securityStandardControls.sortOrder))

    // Group by category for easier consumption
    const grouped = controls.reduce((acc, control) => {
      if (!acc[control.category]) {
        acc[control.category] = []
      }
      acc[control.category].push(control)
      return acc
    }, {} as Record<string, typeof controls>)

    return NextResponse.json({ 
      data: controls,
      grouped,
      frameworks: [...new Set(controls.map(c => c.frameworkCode))],
      categories: Object.keys(grouped),
    })
  } catch (error) {
    console.error("Error fetching standard controls:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

