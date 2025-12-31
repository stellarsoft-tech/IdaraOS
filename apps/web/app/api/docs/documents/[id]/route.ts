/**
 * Document Detail API Routes
 * GET /api/docs/documents/[id] - Get document by ID or slug
 * PUT /api/docs/documents/[id] - Update document
 * DELETE /api/docs/documents/[id] - Delete document
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  documents,
  documentVersions,
  documentRollouts,
  documentAcknowledgments,
  persons,
  users,
} from "@/lib/db/schema"
import { UpdateDocumentSchema, CreateVersionSchema } from "@/lib/docs/types"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { readDocumentContent, writeDocumentContent, deleteDocumentFile } from "@/lib/docs/mdx"

// UUID regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/docs/documents/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { id } = await context.params
    const includeContent = request.nextUrl.searchParams.get("content") !== "false"
    
    // Find document
    const [doc] = await db
      .select({
        id: documents.id,
        orgId: documents.orgId,
        slug: documents.slug,
        title: documents.title,
        description: documents.description,
        category: documents.category,
        tags: documents.tags,
        status: documents.status,
        currentVersion: documents.currentVersion,
        ownerId: documents.ownerId,
        ownerName: persons.name,
        ownerEmail: persons.email,
        lastReviewedAt: documents.lastReviewedAt,
        nextReviewAt: documents.nextReviewAt,
        reviewFrequencyDays: documents.reviewFrequencyDays,
        showHeader: documents.showHeader,
        showFooter: documents.showFooter,
        showVersionHistory: documents.showVersionHistory,
        linkedControlIds: documents.linkedControlIds,
        linkedFrameworkCodes: documents.linkedFrameworkCodes,
        metadata: documents.metadata,
        createdById: documents.createdById,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        publishedAt: documents.publishedAt,
      })
      .from(documents)
      .leftJoin(persons, eq(documents.ownerId, persons.id))
      .where(
        and(
          eq(documents.orgId, session.orgId),
          isUUID(id) ? eq(documents.id, id) : eq(documents.slug, id)
        )
      )
      .limit(1)
    
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    
    // Get version history
    const versions = await db
      .select({
        id: documentVersions.id,
        version: documentVersions.version,
        changeDescription: documentVersions.changeDescription,
        changeSummary: documentVersions.changeSummary,
        approvedById: documentVersions.approvedById,
        approvedByName: persons.name,
        approvedAt: documentVersions.approvedAt,
        createdAt: documentVersions.createdAt,
      })
      .from(documentVersions)
      .leftJoin(persons, eq(documentVersions.approvedById, persons.id))
      .where(eq(documentVersions.documentId, doc.id))
      .orderBy(desc(documentVersions.createdAt))
    
    // Get acknowledgment stats (only from active rollouts)
    const ackStats = await db
      .select({
        status: documentAcknowledgments.status,
      })
      .from(documentAcknowledgments)
      .innerJoin(documentRollouts, and(
        eq(documentAcknowledgments.rolloutId, documentRollouts.id),
        eq(documentRollouts.isActive, true)
      ))
      .where(eq(documentAcknowledgments.documentId, doc.id))
    
    const acknowledgmentStats = {
      total: ackStats.length,
      pending: ackStats.filter((a) => a.status === "pending").length,
      viewed: ackStats.filter((a) => a.status === "viewed").length,
      acknowledged: ackStats.filter((a) => a.status === "acknowledged").length,
      signed: ackStats.filter((a) => a.status === "signed").length,
    }
    
    // Read content from file
    let content: string | null = null
    if (includeContent) {
      content = await readDocumentContent(doc.slug)
    }
    
    // Build response
    const response = {
      ...doc,
      owner: doc.ownerId
        ? { id: doc.ownerId, name: doc.ownerName, email: doc.ownerEmail }
        : null,
      content,
      versions: versions.map((v) => ({
        ...v,
        approvedBy: v.approvedById
          ? { id: v.approvedById, name: v.approvedByName }
          : null,
      })),
      acknowledgmentStats,
    }
    
    return NextResponse.json({ data: response })
  } catch (error) {
    console.error("Error fetching document:", error)
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 })
  }
}

/**
 * Bump patch version (e.g., "1.0" -> "1.0.1", "1.0.1" -> "1.0.2")
 */
function bumpPatchVersion(version: string): string {
  const parts = version.split(".")
  if (parts.length === 2) {
    // e.g., "1.0" -> "1.0.1"
    return `${parts[0]}.${parts[1]}.1`
  } else if (parts.length >= 3) {
    // e.g., "1.0.1" -> "1.0.2"
    const patch = parseInt(parts[2], 10) || 0
    return `${parts[0]}.${parts[1]}.${patch + 1}`
  }
  return `${version}.1`
}

/**
 * PUT /api/docs/documents/[id]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { id } = await context.params
    const body = await request.json()
    
    // Validate request body
    const parseResult = UpdateDocumentSchema.safeParse(body)
    if (!parseResult.success) {
      console.error("Document update validation error:", parseResult.error.flatten())
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Find existing document
    const [existing] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.orgId, session.orgId),
          isUUID(id) ? eq(documents.id, id) : eq(documents.slug, id)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    
    // Check if slug is being changed and if new slug already exists
    if (data.slug && data.slug !== existing.slug) {
      const [slugExists] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.orgId, session.orgId), eq(documents.slug, data.slug)))
        .limit(1)
      
      if (slugExists) {
        return NextResponse.json(
          { error: "A document with this slug already exists" },
          { status: 409 }
        )
      }
    }
    
    // Read existing content to detect changes
    const existingContent = await readDocumentContent(existing.slug)
    const contentChanged = data.content !== undefined && data.content !== existingContent
    
    // Write content to file if provided
    if (data.content !== undefined) {
      const slug = data.slug || existing.slug
      const written = await writeDocumentContent(slug, data.content || "")
      if (!written) {
        return NextResponse.json(
          { error: "Failed to write document content" },
          { status: 500 }
        )
      }
    }
    
    // Determine if status is changing to published
    const isPublishing = data.status === "published" && existing.status !== "published"
    
    // Prepare update data
    const updateData: Record<string, unknown> = {
      ...data,
      content: undefined, // Don't store content in DB
      updatedAt: new Date(),
      nextReviewAt: data.nextReviewAt || existing.nextReviewAt,
    }
    
    // Handle publishedAt
    if (isPublishing) {
      updateData.publishedAt = new Date()
    } else if (data.publishedAt) {
      updateData.publishedAt = new Date(data.publishedAt)
    } else {
      updateData.publishedAt = existing.publishedAt
    }
    
    // Determine if we need to auto-create a version
    // Auto-version: Published doc + content changed + version not manually changed
    const isManualVersionBump = data.currentVersion && data.currentVersion !== existing.currentVersion
    const shouldAutoVersion = existing.status === "published" && contentChanged && !isManualVersionBump
    
    // If auto-versioning, bump the patch version
    if (shouldAutoVersion) {
      updateData.currentVersion = bumpPatchVersion(existing.currentVersion)
    }
    
    // Update document
    const [updated] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, existing.id))
      .returning()
    
    // Create version record for manual version bump
    if (isManualVersionBump) {
      await db.insert(documentVersions).values({
        documentId: existing.id,
        version: data.currentVersion!,
        changeDescription: body.changeDescription || `Updated to version ${data.currentVersion}`,
        changeSummary: body.changeSummary,
        contentSnapshot: data.content || existingContent || undefined,
        createdById: session.userId,
      })
    }
    // Create version record for auto-versioning (content change on published doc)
    else if (shouldAutoVersion) {
      await db.insert(documentVersions).values({
        documentId: existing.id,
        version: updated.currentVersion,
        changeDescription: body.changeDescription || "Content updated",
        changeSummary: body.changeSummary || "Automatic version from content update",
        contentSnapshot: data.content || undefined,
        createdById: session.userId,
      })
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "docs.documents",
        "document",
        updated.id,
        updated.title,
        { title: existing.title, status: existing.status },
        { title: updated.title, status: updated.status }
      )
    }
    
    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating document:", error)
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}

/**
 * DELETE /api/docs/documents/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { id } = await context.params
    
    // Find existing document
    const [existing] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.orgId, session.orgId),
          isUUID(id) ? eq(documents.id, id) : eq(documents.slug, id)
        )
      )
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    
    // Delete the document (cascades to versions, rollouts, acknowledgments)
    await db.delete(documents).where(eq(documents.id, existing.id))
    
    // Delete the content file
    await deleteDocumentFile(existing.slug)
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("docs.documents", "document", {
        id: existing.id,
        slug: existing.slug,
        title: existing.title,
      })
    }
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}

