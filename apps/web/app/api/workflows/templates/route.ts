/**
 * Workflow Templates API Routes
 * GET /api/workflows/templates - List all templates
 * POST /api/workflows/templates - Create a template
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, or, and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  workflowTemplates, 
  workflowTemplateSteps,
  users,
  persons,
} from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Create template schema
const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  moduleScope: z.string().optional(),
  triggerType: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  isActive: z.boolean().default(true),
  defaultDueDays: z.number().optional(),
  defaultOwnerId: z.string().uuid().optional().nullable(),
  settings: z.record(z.unknown()).optional(),
})

// User info type
interface UserInfo {
  id: string
  name: string
  email: string
}

// Owner info type
interface OwnerInfo {
  id: string
  name: string
}

// Transform DB record to API response
function toApiResponse(
  record: typeof workflowTemplates.$inferSelect,
  createdBy?: UserInfo | null,
  defaultOwner?: OwnerInfo | null,
  stepsCount?: number,
  instancesCount?: number
) {
  return {
    id: record.id,
    orgId: record.orgId,
    name: record.name,
    description: record.description ?? undefined,
    moduleScope: record.moduleScope ?? undefined,
    triggerType: record.triggerType ?? undefined,
    status: record.status,
    isActive: record.isActive,
    defaultDueDays: record.defaultDueDays ?? undefined,
    defaultOwnerId: record.defaultOwnerId ?? undefined,
    defaultOwner: defaultOwner || null,
    settings: record.settings,
    createdById: record.createdById ?? undefined,
    createdBy: createdBy || null,
    stepsCount: stepsCount ?? 0,
    instancesCount: instancesCount ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * GET /api/workflows/templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const moduleScope = searchParams.get("moduleScope")
    const triggerType = searchParams.get("triggerType")
    const activeOnly = searchParams.get("activeOnly") === "true"
    
    // Get orgId from authenticated session
    const session = await requirePermission(...P.workflows.templates.view())
    const orgId = session.orgId
    
    // Build query - always filter by organization
    const conditions = [eq(workflowTemplates.orgId, orgId)]
    
    if (search) {
      const searchCondition = or(
        ilike(workflowTemplates.name, `%${search}%`),
        ilike(workflowTemplates.description, `%${search}%`)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    if (status) {
      conditions.push(eq(workflowTemplates.status, status as "draft" | "active" | "archived"))
    }
    
    if (moduleScope) {
      conditions.push(eq(workflowTemplates.moduleScope, moduleScope))
    }
    
    if (triggerType) {
      conditions.push(eq(workflowTemplates.triggerType, triggerType))
    }
    
    if (activeOnly) {
      conditions.push(eq(workflowTemplates.isActive, true))
    }
    
    // Execute query with conditions
    const results = await db
      .select()
      .from(workflowTemplates)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(workflowTemplates.updatedAt))
    
    // Get creators for all templates
    const creatorIds = [...new Set(results.map(t => t.createdById).filter(Boolean) as string[])]
    
    const creators = creatorIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(or(...creatorIds.map(id => eq(users.id, id))))
      : []

    // Create lookup map for creators
    const creatorById = new Map<string, UserInfo>()
    for (const user of creators) {
      creatorById.set(user.id, user)
    }
    
    // Get default owners for all templates
    const ownerIds = [...new Set(results.map(t => t.defaultOwnerId).filter(Boolean) as string[])]
    
    const owners = ownerIds.length > 0
      ? await db
          .select({
            id: persons.id,
            name: persons.name,
          })
          .from(persons)
          .where(or(...ownerIds.map(id => eq(persons.id, id))))
      : []

    // Create lookup map for owners
    const ownerById = new Map<string, OwnerInfo>()
    for (const owner of owners) {
      ownerById.set(owner.id, { id: owner.id, name: owner.name || "Unknown" })
    }
    
    // Get step counts for all templates
    const templateIds = results.map(t => t.id)
    const stepCounts = templateIds.length > 0
      ? await db
          .select({
            templateId: workflowTemplateSteps.templateId,
          })
          .from(workflowTemplateSteps)
          .where(or(...templateIds.map(id => eq(workflowTemplateSteps.templateId, id))))
      : []

    // Count steps per template
    const stepsCountByTemplate = new Map<string, number>()
    for (const step of stepCounts) {
      const current = stepsCountByTemplate.get(step.templateId) || 0
      stepsCountByTemplate.set(step.templateId, current + 1)
    }
    
    return NextResponse.json(
      results.map(template => 
        toApiResponse(
          template, 
          template.createdById ? creatorById.get(template.createdById) : null,
          template.defaultOwnerId ? ownerById.get(template.defaultOwnerId) : null,
          stepsCountByTemplate.get(template.id) || 0,
          0 // TODO: Add instance counts if needed
        )
      )
    )
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching workflow templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflow templates" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflows/templates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate
    const parseResult = CreateTemplateSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Get session for user ID
    const session = await requirePermission(...P.workflows.templates.create())
    const orgId = session.orgId
    
    // Insert template
    const result = await db
      .insert(workflowTemplates)
      .values({
        orgId,
        name: data.name,
        description: data.description ?? null,
        moduleScope: data.moduleScope ?? null,
        triggerType: data.triggerType ?? null,
        status: data.status,
        isActive: data.isActive,
        defaultDueDays: data.defaultDueDays ?? null,
        defaultOwnerId: data.defaultOwnerId ?? null,
        settings: data.settings ?? null,
        createdById: session.userId,
      })
      .returning()
    const record = result[0]
    
    // Audit log the creation
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("workflows.templates", "workflow_template", {
        id: record.id,
        name: record.name,
        moduleScope: record.moduleScope,
        triggerType: record.triggerType,
        status: record.status,
      })
    }
    
    return NextResponse.json(toApiResponse(record, null, null), { status: 201 })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error creating workflow template:", error)
    return NextResponse.json(
      { error: "Failed to create workflow template" },
      { status: 500 }
    )
  }
}

