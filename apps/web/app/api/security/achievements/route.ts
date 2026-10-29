import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { securityAchievements } from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and, ilike, count, desc } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"
import { z } from "zod"

const createAchievementSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    achievementDate: z.string().min(1),
    periodLabel: z.string().optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    evidenceRequired: z.boolean().default(false),
    linkedEvidenceIds: z.array(z.string()).optional().default([]),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.evidenceRequired && (!data.linkedEvidenceIds || data.linkedEvidenceIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one evidence item is required when evidence is marked required",
        path: ["linkedEvidenceIds"],
      })
    }
  })

function toDateString(value: string): string {
  return new Date(value).toISOString().split("T")[0]
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const periodLabel = searchParams.get("periodLabel")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = [eq(securityAchievements.orgId, session.orgId)]

    if (periodLabel) {
      conditions.push(eq(securityAchievements.periodLabel, periodLabel))
    }

    const selectFields = {
      id: securityAchievements.id,
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
    }

    let achievements
    if (search) {
      achievements = await db
        .select(selectFields)
        .from(securityAchievements)
        .where(and(...conditions, ilike(securityAchievements.name, `%${search}%`)))
        .orderBy(desc(securityAchievements.achievementDate))
        .limit(limit)
        .offset(offset)
    } else {
      achievements = await db
        .select(selectFields)
        .from(securityAchievements)
        .where(and(...conditions))
        .orderBy(desc(securityAchievements.achievementDate))
        .limit(limit)
        .offset(offset)
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(securityAchievements)
      .where(and(...conditions))

    return NextResponse.json({
      data: achievements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching achievements:", error)
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createAchievementSchema.parse(body)

    const [achievement] = await db
      .insert(securityAchievements)
      .values({
        orgId: session.orgId,
        name: validatedData.name,
        description: validatedData.description,
        achievementDate: toDateString(validatedData.achievementDate),
        periodLabel: validatedData.periodLabel,
        periodStart: validatedData.periodStart
          ? toDateString(validatedData.periodStart)
          : null,
        periodEnd: validatedData.periodEnd
          ? toDateString(validatedData.periodEnd)
          : null,
        evidenceRequired: validatedData.evidenceRequired,
        linkedEvidenceIds: validatedData.linkedEvidenceIds,
        notes: validatedData.notes,
      })
      .returning()

    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.achievements", "achievement", {
        ...achievement,
        name: achievement.name,
      })
    }

    return NextResponse.json({ data: achievement }, { status: 201 })
  } catch (error) {
    console.error("Error creating achievement:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create achievement" },
      { status: 500 }
    )
  }
}
