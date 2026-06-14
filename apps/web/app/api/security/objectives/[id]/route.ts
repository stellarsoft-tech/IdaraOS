/**
 * Security Objective Detail API
 * Get, update, or delete individual objectives
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  securityObjectives,
  objectiveStatusValues,
  objectivePriorityValues,
  objectiveAchievementStatusValues,
} from "@/lib/db/schema/security"
import { users } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"
import { isAssignableObjectiveOwner } from "@/lib/security/objective-owners"
import { eq, and } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

const updateObjectiveSchema = z.object({
  objectiveId: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  priority: z.enum(objectivePriorityValues).optional(),
  status: z.enum(objectiveStatusValues).optional(),
  targetDate: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  progress: z.coerce.number().min(0).max(100).optional(),
  periodLabel: z.string().optional().nullable(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  achievementStatus: z.enum(objectiveAchievementStatusValues).optional(),
  kpis: z.array(z.string()).optional().nullable(),
  successCriteria: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  linkedRiskIds: z.array(z.string()).optional(),
  linkedControlIds: z.array(z.string()).optional(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  linkedDocumentIds: z.array(z.string()).optional(),
  frameworkCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

function toDateString(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toISOString().split("T")[0]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const [objective] = await db
      .select({
        id: securityObjectives.id,
        orgId: securityObjectives.orgId,
        objectiveId: securityObjectives.objectiveId,
        title: securityObjectives.title,
        description: securityObjectives.description,
        category: securityObjectives.category,
        priority: securityObjectives.priority,
        status: securityObjectives.status,
        progress: securityObjectives.progress,
        targetDate: securityObjectives.targetDate,
        completedAt: securityObjectives.completedAt,
        periodLabel: securityObjectives.periodLabel,
        periodStart: securityObjectives.periodStart,
        periodEnd: securityObjectives.periodEnd,
        achievementStatus: securityObjectives.achievementStatus,
        kpis: securityObjectives.kpis,
        successCriteria: securityObjectives.successCriteria,
        ownerId: securityObjectives.ownerId,
        ownerName: users.name,
        ownerEmail: users.email,
        linkedRiskIds: securityObjectives.linkedRiskIds,
        linkedControlIds: securityObjectives.linkedControlIds,
        linkedEvidenceIds: securityObjectives.linkedEvidenceIds,
        linkedDocumentIds: securityObjectives.linkedDocumentIds,
        frameworkCode: securityObjectives.frameworkCode,
        notes: securityObjectives.notes,
        createdAt: securityObjectives.createdAt,
        updatedAt: securityObjectives.updatedAt,
      })
      .from(securityObjectives)
      .leftJoin(users, eq(securityObjectives.ownerId, users.id))
      .where(and(
        eq(securityObjectives.id, id),
        eq(securityObjectives.orgId, session.orgId)
      ))
      .limit(1)

    if (!objective) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 })
    }

    return NextResponse.json({ data: objective })
  } catch (error) {
    console.error("Error fetching objective:", error)
    return NextResponse.json({ error: "Failed to fetch objective" }, { status: 500 })
  }
}

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
    const validatedData = updateObjectiveSchema.parse(body)

    const [existing] = await db
      .select()
      .from(securityObjectives)
      .where(and(
        eq(securityObjectives.id, id),
        eq(securityObjectives.orgId, session.orgId)
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 })
    }

    if (
      validatedData.ownerId !== undefined &&
      !(await isAssignableObjectiveOwner(session.orgId, validatedData.ownerId))
    ) {
      return NextResponse.json(
        { error: "Owner must be an active platform user" },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(securityObjectives)
      .set({
        ...validatedData.objectiveId !== undefined && { objectiveId: validatedData.objectiveId },
        ...validatedData.title !== undefined && { title: validatedData.title },
        ...validatedData.description !== undefined && { description: validatedData.description },
        ...validatedData.category !== undefined && { category: validatedData.category },
        ...validatedData.priority !== undefined && { priority: validatedData.priority },
        ...validatedData.status !== undefined && { status: validatedData.status },
        ...validatedData.progress !== undefined && { progress: validatedData.progress },
        ...validatedData.targetDate !== undefined && { targetDate: toDateString(validatedData.targetDate) },
        ...validatedData.completedAt !== undefined && {
          completedAt: validatedData.completedAt ? new Date(validatedData.completedAt) : null,
        },
        ...validatedData.periodLabel !== undefined && { periodLabel: validatedData.periodLabel },
        ...validatedData.periodStart !== undefined && { periodStart: toDateString(validatedData.periodStart) },
        ...validatedData.periodEnd !== undefined && { periodEnd: toDateString(validatedData.periodEnd) },
        ...validatedData.achievementStatus !== undefined && { achievementStatus: validatedData.achievementStatus },
        ...validatedData.kpis !== undefined && { kpis: validatedData.kpis },
        ...validatedData.successCriteria !== undefined && { successCriteria: validatedData.successCriteria },
        ...validatedData.ownerId !== undefined && { ownerId: validatedData.ownerId },
        ...validatedData.linkedRiskIds !== undefined && { linkedRiskIds: validatedData.linkedRiskIds },
        ...validatedData.linkedControlIds !== undefined && { linkedControlIds: validatedData.linkedControlIds },
        ...validatedData.linkedEvidenceIds !== undefined && { linkedEvidenceIds: validatedData.linkedEvidenceIds },
        ...validatedData.linkedDocumentIds !== undefined && { linkedDocumentIds: validatedData.linkedDocumentIds },
        ...validatedData.frameworkCode !== undefined && { frameworkCode: validatedData.frameworkCode },
        ...validatedData.notes !== undefined && { notes: validatedData.notes },
        updatedAt: new Date(),
      })
      .where(eq(securityObjectives.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.objectives",
        "objective",
        id,
        updated.title,
        existing,
        updated
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating objective:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update objective" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const [existing] = await db
      .select()
      .from(securityObjectives)
      .where(and(
        eq(securityObjectives.id, id),
        eq(securityObjectives.orgId, session.orgId)
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 })
    }

    await db
      .delete(securityObjectives)
      .where(eq(securityObjectives.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.objectives", "objective", {
        ...existing,
        name: existing.title,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting objective:", error)
    return NextResponse.json({ error: "Failed to delete objective" }, { status: 500 })
  }
}
