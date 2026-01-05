/**
 * Workflow Template Detail API Routes
 * GET /api/workflows/templates/[id] - Get template with steps and edges
 * PATCH /api/workflows/templates/[id] - Update template
 * DELETE /api/workflows/templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  workflowTemplates, 
  workflowTemplateSteps, 
  workflowTemplateEdges,
  workflowInstances,
  users,
  persons,
} from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { z } from "zod"

// Update template schema (TODO: use for simple updates without steps/edges)
const _UpdateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  moduleScope: z.string().optional(),
  triggerType: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  isActive: z.boolean().optional(),
  defaultDueDays: z.number().optional(),
  settings: z.record(z.unknown()).optional(),
})

// Step schema for saving the full template
// Note: id can be any string (temp IDs from designer like "step-123") - backend generates real UUIDs
const StepSchema = z.object({
  id: z.string().optional(), // Optional for new steps, accepts any string (temp ID)
  parentStepId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  stepType: z.enum(["task", "notification", "gateway", "group"]).default("task"),
  orderIndex: z.number().default(0),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  assigneeType: z.enum(["specific_user", "role", "dynamic_manager", "dynamic_creator", "unassigned"]).default("unassigned"),
  assigneeConfig: z.record(z.unknown()).optional().nullable(),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  dueOffsetDays: z.number().optional().nullable(),
  dueOffsetFrom: z.string().default("workflow_start"),
  isRequired: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional().nullable(),
})

// Edge schema - accepts temp IDs from designer
const EdgeSchema = z.object({
  id: z.string().optional(), // Optional for new edges, accepts any string
  sourceStepId: z.string(), // Reference to step (can be temp ID)
  targetStepId: z.string(), // Reference to step (can be temp ID)
  conditionType: z.enum(["always", "if_approved", "if_rejected", "conditional"]).default("always"),
  conditionConfig: z.record(z.unknown()).optional().nullable(),
  label: z.string().optional().nullable(),
})

// Full template save schema (includes steps and edges)
const SaveTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  moduleScope: z.string().optional(),
  triggerType: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  isActive: z.boolean().optional(),
  defaultDueDays: z.number().optional(),
  defaultOwnerId: z.string().uuid().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
  steps: z.array(StepSchema).optional(),
  edges: z.array(EdgeSchema).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/workflows/templates/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.workflows.templates.view())
    const orgId = session.orgId
    const { id } = await params
    
    // Get template
    const templates = await db
      .select()
      .from(workflowTemplates)
      .where(and(
        eq(workflowTemplates.id, id),
        eq(workflowTemplates.orgId, orgId)
      ))
      .limit(1)
    
    if (templates.length === 0) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }
    
    const template = templates[0]
    
    // Get steps with default assignee info
    const steps = await db
      .select({
        id: workflowTemplateSteps.id,
        templateId: workflowTemplateSteps.templateId,
        parentStepId: workflowTemplateSteps.parentStepId,
        name: workflowTemplateSteps.name,
        description: workflowTemplateSteps.description,
        stepType: workflowTemplateSteps.stepType,
        orderIndex: workflowTemplateSteps.orderIndex,
        positionX: workflowTemplateSteps.positionX,
        positionY: workflowTemplateSteps.positionY,
        assigneeType: workflowTemplateSteps.assigneeType,
        assigneeConfig: workflowTemplateSteps.assigneeConfig,
        defaultAssigneeId: workflowTemplateSteps.defaultAssigneeId,
        dueOffsetDays: workflowTemplateSteps.dueOffsetDays,
        dueOffsetFrom: workflowTemplateSteps.dueOffsetFrom,
        isRequired: workflowTemplateSteps.isRequired,
        metadata: workflowTemplateSteps.metadata,
        createdAt: workflowTemplateSteps.createdAt,
        updatedAt: workflowTemplateSteps.updatedAt,
        defaultAssigneeName: persons.name,
        defaultAssigneeEmail: persons.email,
      })
      .from(workflowTemplateSteps)
      .leftJoin(persons, eq(workflowTemplateSteps.defaultAssigneeId, persons.id))
      .where(eq(workflowTemplateSteps.templateId, id))
      .orderBy(asc(workflowTemplateSteps.orderIndex))
    
    // Get edges
    const edges = await db
      .select()
      .from(workflowTemplateEdges)
      .where(eq(workflowTemplateEdges.templateId, id))
    
    // Get creator info
    let createdBy = null
    if (template.createdById) {
      const creators = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, template.createdById))
        .limit(1)
      createdBy = creators[0] || null
    }
    
    // Get default owner info
    let defaultOwner = null
    if (template.defaultOwnerId) {
      const owners = await db
        .select({
          id: persons.id,
          name: persons.name,
        })
        .from(persons)
        .where(eq(persons.id, template.defaultOwnerId))
        .limit(1)
      defaultOwner = owners[0] ? { id: owners[0].id, name: owners[0].name || "Unknown" } : null
    }
    
    // Get instance count
    const instancesResult = await db
      .select({ id: workflowInstances.id })
      .from(workflowInstances)
      .where(eq(workflowInstances.templateId, id))
    const instancesCount = instancesResult.length
    
    return NextResponse.json({
      id: template.id,
      orgId: template.orgId,
      name: template.name,
      description: template.description ?? undefined,
      moduleScope: template.moduleScope ?? undefined,
      triggerType: template.triggerType ?? undefined,
      status: template.status,
      isActive: template.isActive,
      defaultDueDays: template.defaultDueDays ?? undefined,
      defaultOwnerId: template.defaultOwnerId ?? undefined,
      defaultOwner,
      settings: template.settings,
      createdById: template.createdById ?? undefined,
      createdBy,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      stepsCount: steps.length,
      instancesCount,
      steps: steps.map(step => ({
        id: step.id,
        templateId: step.templateId,
        parentStepId: step.parentStepId ?? undefined,
        name: step.name,
        description: step.description ?? undefined,
        stepType: step.stepType,
        orderIndex: step.orderIndex,
        positionX: step.positionX,
        positionY: step.positionY,
        assigneeType: step.assigneeType,
        assigneeConfig: step.assigneeConfig,
        defaultAssigneeId: step.defaultAssigneeId ?? undefined,
        defaultAssignee: step.defaultAssigneeId && step.defaultAssigneeName ? {
          id: step.defaultAssigneeId,
          name: step.defaultAssigneeName,
          email: step.defaultAssigneeEmail ?? "",
        } : undefined,
        dueOffsetDays: step.dueOffsetDays ?? undefined,
        dueOffsetFrom: step.dueOffsetFrom ?? "workflow_start",
        isRequired: step.isRequired,
        metadata: step.metadata,
        createdAt: step.createdAt.toISOString(),
        updatedAt: step.updatedAt.toISOString(),
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        templateId: edge.templateId,
        sourceStepId: edge.sourceStepId,
        targetStepId: edge.targetStepId,
        conditionType: edge.conditionType,
        conditionConfig: edge.conditionConfig,
        label: edge.label ?? undefined,
        createdAt: edge.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching workflow template:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflow template" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workflows/templates/[id]
 * Supports both partial updates and full template saves (with steps and edges)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.workflows.templates.edit())
    const orgId = session.orgId
    const { id } = await params
    const body = await request.json()
    
    // Validate
    const parseResult = SaveTemplateSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Check template exists and belongs to org
    const existing = await db
      .select()
      .from(workflowTemplates)
      .where(and(
        eq(workflowTemplates.id, id),
        eq(workflowTemplates.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }
    
    const previousValues = existing[0]
    
    // Update template fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.moduleScope !== undefined) updateData.moduleScope = data.moduleScope
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType
    if (data.status !== undefined) updateData.status = data.status
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.defaultDueDays !== undefined) updateData.defaultDueDays = data.defaultDueDays
    if (data.defaultOwnerId !== undefined) updateData.defaultOwnerId = data.defaultOwnerId
    if (data.settings !== undefined) updateData.settings = data.settings
    
    // Update template
    const result = await db
      .update(workflowTemplates)
      .set(updateData)
      .where(eq(workflowTemplates.id, id))
      .returning()
    
    // If steps are provided, replace all steps
    if (data.steps !== undefined) {
      // Delete existing steps (cascades to edges)
      await db
        .delete(workflowTemplateSteps)
        .where(eq(workflowTemplateSteps.templateId, id))
      
      // Create ID mapping for new steps (temp ID -> real ID)
      const idMapping = new Map<string, string>()
      
      // Insert new steps
      if (data.steps.length > 0) {
        // First pass: insert steps without parent references
        for (const step of data.steps) {
          const tempId = step.id || crypto.randomUUID()
          const insertResult = await db
            .insert(workflowTemplateSteps)
            .values({
              templateId: id,
              parentStepId: null, // Will update in second pass
              name: step.name,
              description: step.description ?? null,
              stepType: step.stepType,
              orderIndex: step.orderIndex,
              positionX: step.positionX,
              positionY: step.positionY,
              assigneeType: step.assigneeType,
              assigneeConfig: step.assigneeConfig ?? null,
              defaultAssigneeId: step.defaultAssigneeId ?? null,
              dueOffsetDays: step.dueOffsetDays ?? null,
              dueOffsetFrom: step.dueOffsetFrom,
              isRequired: step.isRequired,
              metadata: step.metadata ?? null,
            })
            .returning()
          
          idMapping.set(tempId, insertResult[0].id)
        }
        
        // Second pass: update parent references
        for (const step of data.steps) {
          if (step.parentStepId) {
            const tempId = step.id || ""
            const realId = idMapping.get(tempId)
            const realParentId = idMapping.get(step.parentStepId)
            
            if (realId && realParentId) {
              await db
                .update(workflowTemplateSteps)
                .set({ parentStepId: realParentId })
                .where(eq(workflowTemplateSteps.id, realId))
            }
          }
        }
      }
      
      // If edges are provided, insert them with mapped IDs
      if (data.edges !== undefined && data.edges.length > 0) {
        const edgeValues = data.edges.map(edge => ({
          templateId: id,
          sourceStepId: idMapping.get(edge.sourceStepId) || edge.sourceStepId,
          targetStepId: idMapping.get(edge.targetStepId) || edge.targetStepId,
          conditionType: edge.conditionType,
          conditionConfig: edge.conditionConfig ?? null,
          label: edge.label ?? null,
        }))
        
        await db.insert(workflowTemplateEdges).values(edgeValues)
      }
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "workflows.templates",
        "workflow_template",
        id,
        result[0].name,
        previousValues as Record<string, unknown>,
        result[0] as unknown as Record<string, unknown>
      )
    }
    
    // Return updated template with steps and edges
    return GET(request, { params })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error updating workflow template:", error)
    return NextResponse.json(
      { error: "Failed to update workflow template" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workflows/templates/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission(...P.workflows.templates.delete())
    const orgId = session.orgId
    const { id } = await params
    
    // Check template exists and belongs to org
    const existing = await db
      .select()
      .from(workflowTemplates)
      .where(and(
        eq(workflowTemplates.id, id),
        eq(workflowTemplates.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }
    
    // Check if template has instances
    const instances = await db
      .select({ id: workflowInstances.id })
      .from(workflowInstances)
      .where(eq(workflowInstances.templateId, id))
      .limit(1)
    
    if (instances.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete template with existing instances. Archive it instead." },
        { status: 409 }
      )
    }
    
    // Delete template (cascades to steps and edges)
    await db
      .delete(workflowTemplates)
      .where(eq(workflowTemplates.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logDelete("workflows.templates", "workflow_template", {
        id,
        name: existing[0].name,
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error deleting workflow template:", error)
    return NextResponse.json(
      { error: "Failed to delete workflow template" },
      { status: 500 }
    )
  }
}

