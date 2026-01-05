/**
 * Workflow Instances API Routes
 * GET /api/workflows/instances - List all instances
 * POST /api/workflows/instances - Create an instance from template
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, ilike, and, desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  workflowInstances, 
  workflowInstanceSteps,
  workflowTemplates, 
  workflowTemplateSteps, 
  users,
  persons 
} from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Create instance schema
const CreateInstanceSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  entityType: z.string().min(1, "Entity type is required"),
  entityId: z.string().uuid("Invalid entity ID"),
  name: z.string().optional(), // If not provided, uses template name
  dueAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Template info type
interface TemplateInfo {
  id: string
  name: string
  moduleScope: string | null
  triggerType: string | null
}

// Entity info type
interface EntityInfo {
  id: string
  name: string
  type: string
}

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
  record: typeof workflowInstances.$inferSelect,
  template?: TemplateInfo | null,
  entity?: EntityInfo | null,
  startedBy?: UserInfo | null,
  owner?: OwnerInfo | null
) {
  return {
    id: record.id,
    templateId: record.templateId,
    template: template || null,
    orgId: record.orgId,
    entityType: record.entityType,
    entityId: record.entityId,
    entity: entity || null,
    name: record.name,
    status: record.status,
    startedAt: record.startedAt?.toISOString() ?? undefined,
    dueAt: record.dueAt?.toISOString() ?? undefined,
    completedAt: record.completedAt?.toISOString() ?? undefined,
    totalSteps: record.totalSteps,
    completedSteps: record.completedSteps,
    progress: record.totalSteps > 0 ? Math.round((record.completedSteps / record.totalSteps) * 100) : 0,
    startedById: record.startedById ?? undefined,
    startedBy: startedBy || null,
    ownerId: record.ownerId ?? undefined,
    owner: owner || null,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * GET /api/workflows/instances
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const templateId = searchParams.get("templateId")
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")
    
    // Get orgId from authenticated session
    const session = await requirePermission(...P.workflows.instances.view())
    const orgId = session.orgId
    
    // Build query - always filter by organization
    const conditions = [eq(workflowInstances.orgId, orgId)]
    
    if (search) {
      const searchCondition = ilike(workflowInstances.name, `%${search}%`)
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    
    if (status) {
      const statuses = status.split(",")
      conditions.push(inArray(workflowInstances.status, statuses as ("pending" | "in_progress" | "completed" | "cancelled" | "on_hold")[]))
    }
    
    if (templateId) {
      conditions.push(eq(workflowInstances.templateId, templateId))
    }
    
    if (entityType) {
      conditions.push(eq(workflowInstances.entityType, entityType))
    }
    
    if (entityId) {
      conditions.push(eq(workflowInstances.entityId, entityId))
    }
    
    // Execute query with conditions
    const results = await db
      .select()
      .from(workflowInstances)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(workflowInstances.createdAt))
    
    // Get templates for all instances
    const templateIds = [...new Set(results.map(i => i.templateId))]
    
    const templates = templateIds.length > 0
      ? await db
          .select({
            id: workflowTemplates.id,
            name: workflowTemplates.name,
            moduleScope: workflowTemplates.moduleScope,
            triggerType: workflowTemplates.triggerType,
          })
          .from(workflowTemplates)
          .where(inArray(workflowTemplates.id, templateIds))
      : []

    const templateById = new Map<string, TemplateInfo>()
    for (const tmpl of templates) {
      templateById.set(tmpl.id, tmpl)
    }
    
    // Get entity info for person entities
    const personEntityIds = results
      .filter(i => i.entityType === "person")
      .map(i => i.entityId)
    
    const personEntities = personEntityIds.length > 0
      ? await db
          .select({
            id: persons.id,
            name: persons.name,
          })
          .from(persons)
          .where(inArray(persons.id, personEntityIds))
      : []
    
    const entityById = new Map<string, EntityInfo>()
    for (const person of personEntities) {
      entityById.set(person.id, { ...person, type: "person" })
    }
    
    // Get users who started instances
    const userIds = [...new Set(results.map(i => i.startedById).filter(Boolean) as string[])]
    
    const usersList = userIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : []
    
    const userById = new Map<string, UserInfo>()
    for (const user of usersList) {
      userById.set(user.id, user)
    }
    
    // Get owners for all instances
    const ownerIds = [...new Set(results.map(i => i.ownerId).filter(Boolean) as string[])]
    
    const ownersList = ownerIds.length > 0
      ? await db
          .select({
            id: persons.id,
            name: persons.name,
          })
          .from(persons)
          .where(inArray(persons.id, ownerIds))
      : []
    
    const ownerById = new Map<string, OwnerInfo>()
    for (const owner of ownersList) {
      ownerById.set(owner.id, { id: owner.id, name: owner.name || "Unknown" })
    }
    
    return NextResponse.json(
      results.map(instance => 
        toApiResponse(
          instance, 
          templateById.get(instance.templateId),
          entityById.get(instance.entityId),
          instance.startedById ? userById.get(instance.startedById) : null,
          instance.ownerId ? ownerById.get(instance.ownerId) : null
        )
      )
    )
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching workflow instances:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflow instances" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflows/instances
 * Creates an instance from a template, copying all steps
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate
    const parseResult = CreateInstanceSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    const session = await requirePermission(...P.workflows.instances.create())
    const orgId = session.orgId
    
    // Get template
    const templates = await db
      .select()
      .from(workflowTemplates)
      .where(and(
        eq(workflowTemplates.id, data.templateId),
        eq(workflowTemplates.orgId, orgId),
        eq(workflowTemplates.isActive, true)
      ))
      .limit(1)
    
    if (templates.length === 0) {
      return NextResponse.json(
        { error: "Template not found or inactive" },
        { status: 404 }
      )
    }
    
    const template = templates[0]
    
    // Get template steps
    const templateSteps = await db
      .select()
      .from(workflowTemplateSteps)
      .where(eq(workflowTemplateSteps.templateId, template.id))
    
    // Calculate due date
    let dueAt: Date | undefined
    if (data.dueAt) {
      dueAt = new Date(data.dueAt)
    } else if (template.defaultDueDays) {
      dueAt = new Date()
      dueAt.setDate(dueAt.getDate() + template.defaultDueDays)
    }
    
    // Create instance
    const now = new Date()
    const instanceResult = await db
      .insert(workflowInstances)
      .values({
        templateId: template.id,
        orgId,
        entityType: data.entityType,
        entityId: data.entityId,
        name: data.name || template.name,
        status: "in_progress",
        startedAt: now,
        dueAt: dueAt ?? null,
        totalSteps: templateSteps.filter(s => !s.parentStepId).length, // Count root steps only
        completedSteps: 0,
        startedById: session.userId,
        metadata: data.metadata ?? null,
      })
      .returning()
    
    const instance = instanceResult[0]
    
    // Create instance steps from template steps
    // Map template step IDs to instance step IDs for parent references
    const stepIdMapping = new Map<string, string>()
    
    // First pass: create all steps without parent references
    for (const templateStep of templateSteps) {
      // Calculate step due date
      let stepDueAt: Date | undefined
      if (templateStep.dueOffsetDays) {
        stepDueAt = new Date(now)
        stepDueAt.setDate(stepDueAt.getDate() + templateStep.dueOffsetDays)
      }
      
      // Resolve assignee based on assignee type
      // assigneeId = system user ID, assignedPersonId = directory person ID
      let assigneeId: string | null = null
      let assignedPersonId: string | null = null
      
      if (templateStep.assigneeType === "specific_user") {
        // Use defaultAssigneeId if set (person from directory)
        if (templateStep.defaultAssigneeId) {
          assignedPersonId = templateStep.defaultAssigneeId
        } else if (templateStep.assigneeConfig) {
          // Fallback to assigneeConfig.userId (system user)
          assigneeId = (templateStep.assigneeConfig as { userId?: string }).userId ?? null
        }
      } else if (templateStep.assigneeType === "dynamic_creator") {
        assigneeId = session.userId
      }
      // TODO: Handle dynamic_manager by looking up the entity's manager
      
      const instanceStepResult = await db
        .insert(workflowInstanceSteps)
        .values({
          instanceId: instance.id,
          templateStepId: templateStep.id,
          parentStepId: null, // Will update in second pass
          name: templateStep.name,
          description: templateStep.description,
          orderIndex: templateStep.orderIndex,
          status: "pending",
          assigneeId,
          assignedPersonId,
          dueAt: stepDueAt ?? null,
          metadata: templateStep.metadata,
        })
        .returning()
      
      stepIdMapping.set(templateStep.id, instanceStepResult[0].id)
    }
    
    // Second pass: update parent references
    for (const templateStep of templateSteps) {
      if (templateStep.parentStepId) {
        const instanceStepId = stepIdMapping.get(templateStep.id)
        const parentInstanceStepId = stepIdMapping.get(templateStep.parentStepId)
        
        if (instanceStepId && parentInstanceStepId) {
          await db
            .update(workflowInstanceSteps)
            .set({ parentStepId: parentInstanceStepId })
            .where(eq(workflowInstanceSteps.id, instanceStepId))
        }
      }
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("workflows.instances", "workflow_instance", {
        id: instance.id,
        name: instance.name,
        templateId: instance.templateId,
        templateName: template.name,
        entityType: instance.entityType,
        entityId: instance.entityId,
      })
    }
    
    return NextResponse.json(toApiResponse(instance, {
      id: template.id,
      name: template.name,
      moduleScope: template.moduleScope,
      triggerType: template.triggerType,
    }), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error creating workflow instance:", error)
    return NextResponse.json(
      { error: "Failed to create workflow instance" },
      { status: 500 }
    )
  }
}

