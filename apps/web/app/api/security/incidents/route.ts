import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, count, desc, eq, ilike } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  securityIncidents,
  incidentStatusValues,
  incidentSeverityValues,
  incidentClassificationValues,
  incidentPublicationStatusValues,
} from "@/lib/db/schema/security"
import { users } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"
import { getAuditLogger } from "@/lib/api/context"
import { isAssignableObjectiveOwner } from "@/lib/security/objective-owners"

const createIncidentSchema = z.object({
  incidentId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  classification: z.enum(incidentClassificationValues).default("incident"),
  severity: z.enum(incidentSeverityValues).default("p3"),
  status: z.enum(incidentStatusValues).default("draft"),
  ownerId: z.string().uuid().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  impactDescription: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const severity = searchParams.get("severity")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 500)
    const offset = (page - 1) * limit

    const conditions = [eq(securityIncidents.orgId, session.orgId)]
    if (status) conditions.push(eq(securityIncidents.status, status as typeof incidentStatusValues[number]))
    if (severity) conditions.push(eq(securityIncidents.severity, severity as typeof incidentSeverityValues[number]))
    if (search) conditions.push(ilike(securityIncidents.title, `%${search}%`))

    const owner = users
    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: securityIncidents.id,
          incidentId: securityIncidents.incidentId,
          title: securityIncidents.title,
          description: securityIncidents.description,
          classification: securityIncidents.classification,
          severity: securityIncidents.severity,
          status: securityIncidents.status,
          publicationStatus: securityIncidents.publicationStatus,
          currentVersion: securityIncidents.currentVersion,
          ownerId: securityIncidents.ownerId,
          ownerName: owner.name,
          ownerEmail: owner.email,
          linkedEvidenceIds: securityIncidents.linkedEvidenceIds,
          detectedAt: securityIncidents.detectedAt,
          reportedAt: securityIncidents.reportedAt,
          resolvedAt: securityIncidents.resolvedAt,
          closedAt: securityIncidents.closedAt,
          publishedAt: securityIncidents.publishedAt,
          createdAt: securityIncidents.createdAt,
          updatedAt: securityIncidents.updatedAt,
        })
        .from(securityIncidents)
        .leftJoin(owner, eq(securityIncidents.ownerId, owner.id))
        .where(and(...conditions))
        .orderBy(desc(securityIncidents.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(securityIncidents).where(and(...conditions)),
    ])

    const total = Number(totalResult[0]?.total || 0)
    return NextResponse.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Error fetching incidents:", error)
    return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validated = createIncidentSchema.parse(body)

    const [existing] = await db
      .select({ id: securityIncidents.id })
      .from(securityIncidents)
      .where(and(
        eq(securityIncidents.orgId, session.orgId),
        eq(securityIncidents.incidentId, validated.incidentId)
      ))
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: "An incident with this ID already exists" }, { status: 400 })
    }

    if (!(await isAssignableObjectiveOwner(session.orgId, validated.ownerId))) {
      return NextResponse.json({ error: "Owner must be an active platform user" }, { status: 400 })
    }

    const [incident] = await db
      .insert(securityIncidents)
      .values({
        orgId: session.orgId,
        incidentId: validated.incidentId,
        title: validated.title,
        description: validated.description,
        classification: validated.classification,
        severity: validated.severity,
        status: validated.status,
        ownerId: validated.ownerId,
        reportedById: session.userId,
        linkedEvidenceIds: validated.linkedEvidenceIds,
        impactDescription: validated.impactDescription,
        notes: validated.notes,
      })
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.incidents", "incident", { ...incident, name: incident.title })
    }

    return NextResponse.json({ data: incident }, { status: 201 })
  } catch (error) {
    console.error("Error creating incident:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 })
  }
}
