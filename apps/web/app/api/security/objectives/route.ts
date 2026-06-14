import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { 
  securityObjectives,
  objectiveStatusValues,
  objectivePriorityValues,
  objectiveAchievementStatusValues,
} from "@/lib/db/schema/security"
import { getSession } from "@/lib/auth/session"
import { eq, and, ilike, count, desc } from "drizzle-orm"
import { getAuditLogger } from "@/lib/api/context"
import { persons } from "@/lib/db/schema"
import { z } from "zod"

const createObjectiveSchema = z.object({
  objectiveId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(objectivePriorityValues).default("medium"),
  status: z.enum(objectiveStatusValues).default("not_started"),
  targetDate: z.string().optional(),
  progress: z.coerce.number().min(0).max(100).default(0),
  periodLabel: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  achievementStatus: z.enum(objectiveAchievementStatusValues).default("not_measured"),
  kpis: z.array(z.string()).optional(),
  successCriteria: z.string().optional(),
  ownerId: z.string().uuid().optional().nullable(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  linkedDocumentIds: z.array(z.string()).optional(),
  frameworkCode: z.string().optional(),
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
    const priority = searchParams.get("priority")
    const achievementStatus = searchParams.get("achievementStatus")
    const periodLabel = searchParams.get("periodLabel")
    const frameworkCode = searchParams.get("frameworkCode")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    // Build conditions
    const conditions = [eq(securityObjectives.orgId, session.orgId)]
    
    if (status) {
      conditions.push(eq(securityObjectives.status, status as typeof objectiveStatusValues[number]))
    }
    
    if (priority) {
      conditions.push(eq(securityObjectives.priority, priority as typeof objectivePriorityValues[number]))
    }

    if (achievementStatus) {
      conditions.push(eq(securityObjectives.achievementStatus, achievementStatus as typeof objectiveAchievementStatusValues[number]))
    }

    if (periodLabel) {
      conditions.push(eq(securityObjectives.periodLabel, periodLabel))
    }

    if (frameworkCode) {
      conditions.push(eq(securityObjectives.frameworkCode, frameworkCode))
    }

    const selectFields = {
      id: securityObjectives.id,
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
      ownerName: persons.name,
      ownerEmail: persons.email,
      linkedEvidenceIds: securityObjectives.linkedEvidenceIds,
      linkedDocumentIds: securityObjectives.linkedDocumentIds,
      frameworkCode: securityObjectives.frameworkCode,
      createdAt: securityObjectives.createdAt,
      updatedAt: securityObjectives.updatedAt,
    }

    // Get objectives with owner info
    const objectivesQuery = db
      .select(selectFields)
      .from(securityObjectives)
      .leftJoin(persons, eq(securityObjectives.ownerId, persons.id))
      .where(and(...conditions))
      .orderBy(desc(securityObjectives.createdAt))
      .limit(limit)
      .offset(offset)

    // Apply search filter if provided
    let objectives
    if (search) {
      objectives = await db
        .select(selectFields)
        .from(securityObjectives)
        .leftJoin(persons, eq(securityObjectives.ownerId, persons.id))
        .where(and(
          ...conditions,
          ilike(securityObjectives.title, `%${search}%`)
        ))
        .orderBy(desc(securityObjectives.createdAt))
        .limit(limit)
        .offset(offset)
    } else {
      objectives = await objectivesQuery
    }

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(securityObjectives)
      .where(and(...conditions))

    return NextResponse.json({
      data: objectives,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching objectives:", error)
    return NextResponse.json(
      { error: "Failed to fetch objectives" },
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
    const validatedData = createObjectiveSchema.parse(body)

    // Check if objective with this ID already exists
    const [existing] = await db
      .select({ id: securityObjectives.id })
      .from(securityObjectives)
      .where(and(
        eq(securityObjectives.orgId, session.orgId),
        eq(securityObjectives.objectiveId, validatedData.objectiveId)
      ))
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: "An objective with this ID already exists" },
        { status: 400 }
      )
    }

    const [objective] = await db
      .insert(securityObjectives)
      .values({
        orgId: session.orgId,
        objectiveId: validatedData.objectiveId,
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        priority: validatedData.priority,
        status: validatedData.status,
        progress: validatedData.progress,
        targetDate: validatedData.targetDate ? new Date(validatedData.targetDate).toISOString().split("T")[0] : null,
        periodLabel: validatedData.periodLabel,
        periodStart: validatedData.periodStart ? new Date(validatedData.periodStart).toISOString().split("T")[0] : null,
        periodEnd: validatedData.periodEnd ? new Date(validatedData.periodEnd).toISOString().split("T")[0] : null,
        achievementStatus: validatedData.achievementStatus,
        kpis: validatedData.kpis,
        successCriteria: validatedData.successCriteria,
        ownerId: validatedData.ownerId,
        linkedEvidenceIds: validatedData.linkedEvidenceIds,
        linkedDocumentIds: validatedData.linkedDocumentIds,
        frameworkCode: validatedData.frameworkCode,
      })
      .returning()

    // Log the creation
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("security.objectives", "objective", {
        ...objective,
        name: objective.title,
      })
    }

    return NextResponse.json({ data: objective }, { status: 201 })
  } catch (error) {
    console.error("Error creating objective:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create objective" },
      { status: 500 }
    )
  }
}

