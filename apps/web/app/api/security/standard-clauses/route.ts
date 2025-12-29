/**
 * Standard Clauses API
 * Get ISMS clause definitions (reference data)
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { securityStandardClauses } from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, asc } from "drizzle-orm"

// ============================================================================
// GET - List Standard Clauses
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const frameworkCode = searchParams.get("framework") || "iso-27001"

    // Fetch clauses for the specified framework
    const clauses = await db
      .select()
      .from(securityStandardClauses)
      .where(eq(securityStandardClauses.frameworkCode, frameworkCode))
      .orderBy(asc(securityStandardClauses.sortOrder))

    // Build hierarchical structure
    const clauseMap = new Map<string, typeof clauses[0] & { children: typeof clauses }>()
    const rootClauses: (typeof clauses[0] & { children: typeof clauses })[] = []

    // First pass: create map with children arrays
    clauses.forEach(clause => {
      clauseMap.set(clause.clauseId, { ...clause, children: [] })
    })

    // Second pass: build hierarchy
    clauses.forEach(clause => {
      const clauseWithChildren = clauseMap.get(clause.clauseId)!
      if (clause.parentClauseId) {
        const parent = clauseMap.get(clause.parentClauseId)
        if (parent) {
          parent.children.push(clauseWithChildren)
        } else {
          rootClauses.push(clauseWithChildren)
        }
      } else {
        rootClauses.push(clauseWithChildren)
      }
    })

    return NextResponse.json({
      data: clauses,
      hierarchy: rootClauses,
      total: clauses.length,
    })
  } catch (error) {
    console.error("Error fetching standard clauses:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

