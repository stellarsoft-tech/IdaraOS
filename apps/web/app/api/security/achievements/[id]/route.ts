/**
 * Security Achievement Detail API
 * Get, update, or delete individual achievements
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { securityAchievements } from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"

const updateAchievementSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    achievementDate: z.string().optional(),
    periodLabel: z.string().optional().nullable(),
    periodStart: z.string().optional().nullable(),
    periodEnd: z.string().optional().nullable(),
    evidenceRequired: z.boolean().optional(),
    linkedEvidenceIds: z.array(z.string()).optional(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.evidenceRequired === true &&
      data.linkedEvidenceIds !== undefined &&
      data.linkedEvidenceIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one evidence item is required when evidence is marked required",
        path: ["linkedEvidenceIds"],
      })
    }
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

    const [achievement] = await db
      .select({
        id: securityAchievements.id,
        orgId: securityAchievements.orgId,
        name: securityAchievements.name,
        description: securityAchievements.description,
        achievementDate: securityAchievements.achievementDate,
        periodLabel: securityAchievements.periodLabel,
        periodStart: securityAchievements.periodStart,
        periodEnd: securityAchievements.periodEnd,
        evidenceRequired: securityAchievements.evidenceRequired,
        linkedEvidenceIds: securityAchievements.linkedEvidenceIds,
        notes: securityAchievements.notes,
        createdAt: securityAchievements.createdAt,
        updatedAt: securityAchievements.updatedAt,
      })
      .from(securityAchievements)
      .where(and(
        eq(securityAchievements.id, id),
        eq(securityAchievements.orgId, session.orgId)
      ))
      .limit(1)

    if (!achievement) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 })
    }

    return NextResponse.json({ data: achievement })
  } catch (error) {
    console.error("Error fetching achievement:", error)
    return NextResponse.json({ error: "Failed to fetch achievement" }, { status: 500 })
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
    const validatedData = updateAchievementSchema.parse(body)

    const [existing] = await db
      .select()
      .from(securityAchievements)
      .where(and(
        eq(securityAchievements.id, id),
        eq(securityAchievements.orgId, session.orgId)
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 })
    }

    const nextEvidenceRequired =
      validatedData.evidenceRequired ?? existing.evidenceRequired
    const nextLinkedEvidenceIds =
      validatedData.linkedEvidenceIds ?? existing.linkedEvidenceIds ?? []

    if (nextEvidenceRequired && nextLinkedEvidenceIds.length === 0) {
      return NextResponse.json(
        { error: "At least one evidence item is required when evidence is marked required" },
        { status: 400 }
      )
    }

    let achievementDateUpdate: string | undefined
    if (validatedData.achievementDate !== undefined) {
      const parsed = toDateString(validatedData.achievementDate)
      if (!parsed) {
        return NextResponse.json(
          { error: "Achievement date is required" },
          { status: 400 }
        )
      }
      achievementDateUpdate = parsed
    }

    const [updated] = await db
      .update(securityAchievements)
      .set({
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(achievementDateUpdate !== undefined && { achievementDate: achievementDateUpdate }),
        ...(validatedData.periodLabel !== undefined && { periodLabel: validatedData.periodLabel }),
        ...(validatedData.periodStart !== undefined && {
          periodStart: toDateString(validatedData.periodStart),
        }),
        ...(validatedData.periodEnd !== undefined && {
          periodEnd: toDateString(validatedData.periodEnd),
        }),
        ...(validatedData.evidenceRequired !== undefined && {
          evidenceRequired: validatedData.evidenceRequired,
        }),
        ...(validatedData.linkedEvidenceIds !== undefined && {
          linkedEvidenceIds: validatedData.linkedEvidenceIds,
        }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
        updatedAt: new Date(),
      })
      .where(eq(securityAchievements.id, id))
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "security.achievements",
        "achievement",
        id,
        updated.name,
        existing,
        updated
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating achievement:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update achievement" }, { status: 500 })
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
      .from(securityAchievements)
      .where(and(
        eq(securityAchievements.id, id),
        eq(securityAchievements.orgId, session.orgId)
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 })
    }

    await db
      .delete(securityAchievements)
      .where(eq(securityAchievements.id, id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("security.achievements", "achievement", {
        ...existing,
        name: existing.name,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting achievement:", error)
    return NextResponse.json({ error: "Failed to delete achievement" }, { status: 500 })
  }
}
