/**
 * My Documents API Route
 * GET /api/docs/my-documents - Get current user's pending documents
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, or, sql, inArray, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { documents, documentRollouts, documentAcknowledgments } from "@/lib/db/schema"
import { requireSession } from "@/lib/api/context"

/**
 * GET /api/docs/my-documents
 * Get documents that the current user needs to review/acknowledge
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status") // pending, completed, all
    const includeOptional = searchParams.get("includeOptional") === "true"
    
    // Build conditions based on status filter
    const statusConditions = []
    
    if (status === "pending" || !status) {
      statusConditions.push(inArray(documentAcknowledgments.status, ["pending", "viewed"]))
    } else if (status === "completed") {
      statusConditions.push(inArray(documentAcknowledgments.status, ["acknowledged", "signed"]))
    }
    // For "all", we don't add status conditions
    
    // Query acknowledgments for current user
    const myDocsQuery = await db
      .select({
        // Document info
        documentId: documents.id,
        documentSlug: documents.slug,
        documentTitle: documents.title,
        documentDescription: documents.description,
        documentCategory: documents.category,
        documentVersion: documents.currentVersion,
        documentStatus: documents.status,
        // Rollout info
        rolloutId: documentRollouts.id,
        rolloutName: documentRollouts.name,
        requirement: documentRollouts.requirement,
        dueDate: documentRollouts.dueDate,
        // Acknowledgment info
        acknowledgmentId: documentAcknowledgments.id,
        acknowledgmentStatus: documentAcknowledgments.status,
        versionAcknowledged: documentAcknowledgments.versionAcknowledged,
        viewedAt: documentAcknowledgments.viewedAt,
        acknowledgedAt: documentAcknowledgments.acknowledgedAt,
        signedAt: documentAcknowledgments.signedAt,
      })
      .from(documentAcknowledgments)
      .innerJoin(documents, and(
        eq(documentAcknowledgments.documentId, documents.id),
        eq(documents.orgId, session.orgId),
        eq(documents.status, "published") // Only show published documents
      ))
      .innerJoin(documentRollouts, and(
        eq(documentAcknowledgments.rolloutId, documentRollouts.id),
        eq(documentRollouts.isActive, true)
      ))
      .where(and(
        eq(documentAcknowledgments.userId, session.userId),
        includeOptional
          ? undefined
          : inArray(documentRollouts.requirement, ["required", "required_with_signature"]),
        statusConditions.length > 0 ? or(...statusConditions) : undefined
      ))
      .orderBy(
        // Order by: overdue first, then by due date
        sql`CASE WHEN ${documentRollouts.dueDate} < CURRENT_DATE THEN 0 ELSE 1 END`,
        documentRollouts.dueDate
      )
    
    // Calculate overdue status
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const data = myDocsQuery.map((doc) => ({
      documentId: doc.documentId,
      documentSlug: doc.documentSlug,
      documentTitle: doc.documentTitle,
      documentDescription: doc.documentDescription,
      documentCategory: doc.documentCategory,
      documentVersion: doc.documentVersion,
      rolloutId: doc.rolloutId,
      rolloutName: doc.rolloutName,
      requirement: doc.requirement,
      dueDate: doc.dueDate,
      acknowledgmentId: doc.acknowledgmentId,
      acknowledgmentStatus: doc.acknowledgmentStatus,
      versionAcknowledged: doc.versionAcknowledged,
      viewedAt: doc.viewedAt,
      acknowledgedAt: doc.acknowledgedAt,
      signedAt: doc.signedAt,
      isOverdue: doc.dueDate
        ? new Date(doc.dueDate) < today && !["acknowledged", "signed"].includes(doc.acknowledgmentStatus)
        : false,
      needsSignature: doc.requirement === "required_with_signature" && doc.acknowledgmentStatus !== "signed",
    }))
    
    // Aggregate stats
    const stats = {
      total: data.length,
      pending: data.filter((d) => d.acknowledgmentStatus === "pending").length,
      viewed: data.filter((d) => d.acknowledgmentStatus === "viewed").length,
      acknowledged: data.filter((d) => d.acknowledgmentStatus === "acknowledged").length,
      signed: data.filter((d) => d.acknowledgmentStatus === "signed").length,
      overdue: data.filter((d) => d.isOverdue).length,
    }
    
    return NextResponse.json({ data, stats })
  } catch (error) {
    console.error("Error fetching my documents:", error)
    return NextResponse.json({ error: "Failed to fetch my documents" }, { status: 500 })
  }
}

