/**
 * Documents API Routes
 * GET /api/docs/documents - List documents
 * POST /api/docs/documents - Create document
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, or, ilike, inArray, desc, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { documents, documentRollouts, documentAcknowledgments, persons, users } from "@/lib/db/schema"
import { CreateDocumentSchema } from "@/lib/docs/types"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { writeDocumentContent } from "@/lib/docs/mdx"

/**
 * GET /api/docs/documents
 * List documents with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const ownerId = searchParams.get("ownerId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit
    
    // Build where conditions
    const conditions = [eq(documents.orgId, session.orgId)]
    
    if (search) {
      conditions.push(
        or(
          ilike(documents.title, `%${search}%`),
          ilike(documents.description, `%${search}%`),
          ilike(documents.slug, `%${search}%`)
        )!
      )
    }
    
    if (status) {
      const statuses = status.split(",")
      conditions.push(inArray(documents.status, statuses as typeof documents.status.enumValues))
    }
    
    if (category) {
      const categories = category.split(",")
      conditions.push(inArray(documents.category, categories as typeof documents.category.enumValues))
    }
    
    if (ownerId) {
      conditions.push(eq(documents.ownerId, ownerId))
    }
    
    // Query documents with owner info
    const [docsResult, countResult] = await Promise.all([
      db
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
          metadata: documents.metadata,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
          publishedAt: documents.publishedAt,
        })
        .from(documents)
        .leftJoin(persons, eq(documents.ownerId, persons.id))
        .where(and(...conditions))
        .orderBy(desc(documents.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(and(...conditions)),
    ])
    
    // Get rollout counts for each document
    const docIds = docsResult.map((d) => d.id)
    const rolloutCounts = docIds.length > 0
      ? await db
          .select({
            documentId: documentRollouts.documentId,
            count: sql<number>`count(*)`,
          })
          .from(documentRollouts)
          .where(and(
            inArray(documentRollouts.documentId, docIds),
            eq(documentRollouts.isActive, true)
          ))
          .groupBy(documentRollouts.documentId)
      : []
    
    // Build response
    const rolloutCountMap = new Map(rolloutCounts.map((r) => [r.documentId, r.count]))
    
    const data = docsResult.map((doc) => ({
      ...doc,
      owner: doc.ownerId
        ? { id: doc.ownerId, name: doc.ownerName, email: doc.ownerEmail }
        : null,
      rolloutCount: rolloutCountMap.get(doc.id) || 0,
    }))
    
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }
}

/**
 * POST /api/docs/documents
 * Create a new document
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    
    // Validate request body
    const parseResult = CreateDocumentSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Check if slug already exists
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.orgId, session.orgId), eq(documents.slug, data.slug)))
      .limit(1)
    
    if (existing) {
      return NextResponse.json(
        { error: "A document with this slug already exists" },
        { status: 409 }
      )
    }
    
    // Always write MDX content to file (even if empty, to create the file)
    const contentToWrite = data.content ?? ""
    console.log(`[Docs] Creating document file: content/docs/${data.slug}.mdx`)
    const written = await writeDocumentContent(data.slug, contentToWrite)
    if (!written) {
      console.error(`[Docs] Failed to write document file: ${data.slug}`)
      return NextResponse.json(
        { error: "Failed to write document content" },
        { status: 500 }
      )
    }
    console.log(`[Docs] Successfully wrote document file: ${data.slug}.mdx`)
    
    // Create document record
    const [created] = await db
      .insert(documents)
      .values({
        orgId: session.orgId,
        slug: data.slug,
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags,
        status: data.status,
        currentVersion: data.currentVersion,
        ownerId: data.ownerId,
        nextReviewAt: data.nextReviewAt || null,
        reviewFrequencyDays: data.reviewFrequencyDays,
        showHeader: data.showHeader,
        showFooter: data.showFooter,
        showVersionHistory: data.showVersionHistory,
        linkedControlIds: data.linkedControlIds,
        linkedFrameworkCodes: data.linkedFrameworkCodes,
        metadata: data.metadata,
        createdById: session.userId,
        publishedAt: data.status === "published" ? new Date() : null,
      })
      .returning()
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("docs.documents", "document", {
        id: created.id,
        slug: created.slug,
        title: created.title,
        status: created.status,
      })
    }
    
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error("Error creating document:", error)
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 })
  }
}

