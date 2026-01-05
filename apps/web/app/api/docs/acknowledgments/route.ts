/**
 * Document Acknowledgments API Routes
 * GET /api/docs/acknowledgments - List acknowledgments
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { documents, documentRollouts, documentAcknowledgments, users } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

/**
 * GET /api/docs/acknowledgments
 * List acknowledgments with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(...P.docs.acknowledgments.view())
    
    const searchParams = request.nextUrl.searchParams
    const documentId = searchParams.get("documentId")
    const rolloutId = searchParams.get("rolloutId")
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit
    
    // Build conditions
    const conditions = []
    
    if (documentId) {
      conditions.push(eq(documentAcknowledgments.documentId, documentId))
    }
    
    if (rolloutId) {
      conditions.push(eq(documentAcknowledgments.rolloutId, rolloutId))
    }
    
    if (status) {
      const statuses = status.split(",")
      conditions.push(inArray(documentAcknowledgments.status, statuses as typeof documentAcknowledgments.status.enumValues))
    }
    
    // Query acknowledgments with user and document info
    const acksResult = await db
      .select({
        id: documentAcknowledgments.id,
        documentId: documentAcknowledgments.documentId,
        documentTitle: documents.title,
        documentSlug: documents.slug,
        documentCategory: documents.category,
        rolloutId: documentAcknowledgments.rolloutId,
        userId: documentAcknowledgments.userId,
        userName: users.name,
        userEmail: users.email,
        personId: documentAcknowledgments.personId,
        status: documentAcknowledgments.status,
        versionAcknowledged: documentAcknowledgments.versionAcknowledged,
        viewedAt: documentAcknowledgments.viewedAt,
        acknowledgedAt: documentAcknowledgments.acknowledgedAt,
        signedAt: documentAcknowledgments.signedAt,
        notes: documentAcknowledgments.notes,
        createdAt: documentAcknowledgments.createdAt,
        updatedAt: documentAcknowledgments.updatedAt,
      })
      .from(documentAcknowledgments)
      .innerJoin(documents, and(
        eq(documentAcknowledgments.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .innerJoin(users, eq(documentAcknowledgments.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(documentAcknowledgments.createdAt))
      .limit(limit)
      .offset(offset)
    
    return NextResponse.json({ data: acksResult })
  } catch (error) {
    console.error("Error fetching acknowledgments:", error)
    return NextResponse.json({ error: "Failed to fetch acknowledgments" }, { status: 500 })
  }
}

