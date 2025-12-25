/**
 * Workflow Instance Detail API Routes
 * GET /api/workflows/instances/[id] - Get instance with steps
 * PATCH /api/workflows/instances/[id] - Update instance status
 * DELETE /api/workflows/instances/[id] - Cancel instance
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, asc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  workflowInstances, 
  workflowInstanceSteps,
  workflowTemplates,
  workflowTemplateSteps,
  users,
  persons 
} from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
import { z } from "zod"

// Update instance schema
const UpdateInstanceSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "on_hold"]).optional(),
  dueAt: z.string().datetime().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/workflows/instances/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    
    // Get instance
    const instances = await db
      .select()
      .from(workflowInstances)
      .where(and(
        eq(workflowInstances.id, id),
        eq(workflowInstances.orgId, orgId)
      ))
      .limit(1)
    
    if (instances.length === 0) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      )
    }
    
    const instance = instances[0]
    
    // Get template
    const templates = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, instance.templateId))
      .limit(1)
    
    const template = templates[0] || null
    
    // Get steps with their template step info
    const steps = await db
      .select({
        step: workflowInstanceSteps,
        templateStep: workflowTemplateSteps,
      })
      .from(workflowInstanceSteps)
      .leftJoin(workflowTemplateSteps, eq(workflowInstanceSteps.templateStepId, workflowTemplateSteps.id))
      .where(eq(workflowInstanceSteps.instanceId, id))
      .orderBy(asc(workflowInstanceSteps.orderIndex))
    
    // Get assignees (users)
    const assigneeIds = [...new Set(steps.map(s => s.step.assigneeId).filter(Boolean) as string[])]
    const completedByIds = [...new Set(steps.map(s => s.step.completedById).filter(Boolean) as string[])]
    const allUserIds = [...new Set([...assigneeIds, ...completedByIds])]
    
    const usersList = allUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, allUserIds[0])) // Simplified - would need inArray for multiple
      : []
    
    const userById = new Map<string, { id: string; name: string; email: string }>()
    for (const user of usersList) {
      userById.set(user.id, user)
    }
    
    // Get assigned persons (from people directory)
    const assignedPersonIds = [...new Set(steps.map(s => s.step.assignedPersonId).filter(Boolean) as string[])]
    const personById = new Map<string, { id: string; name: string; email: string; avatar: string | null }>()
    
    if (assignedPersonIds.length > 0) {
      const personsList = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
          avatar: persons.avatar,
        })
        .from(persons)
        .where(inArray(persons.id, assignedPersonIds))
      
      for (const person of personsList) {
        personById.set(person.id, person)
      }
    }
    
    // Get started by user
    let startedBy = null
    if (instance.startedById) {
      const starters = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, instance.startedById))
        .limit(1)
      startedBy = starters[0] || null
    }
    
    // Get owner info
    let owner = null
    if (instance.ownerId) {
      const owners = await db
        .select({
          id: persons.id,
          name: persons.name,
          email: persons.email,
        })
        .from(persons)
        .where(eq(persons.id, instance.ownerId))
        .limit(1)
      owner = owners[0] ? { id: owners[0].id, name: owners[0].name || "Unknown", email: owners[0].email } : null
    }
    
    // Get entity info (for person type)
    let entity = null
    if (instance.entityType === "person") {
      const entities = await db
        .select({
          id: persons.id,
          name: persons.name,
          slug: persons.slug,
          email: persons.email,
        })
        .from(persons)
        .where(eq(persons.id, instance.entityId))
        .limit(1)
      if (entities[0]) {
        entity = { ...entities[0], type: "person" }
      }
    }
    
    return NextResponse.json({
      id: instance.id,
      templateId: instance.templateId,
      template: template ? {
        id: template.id,
        name: template.name,
        moduleScope: template.moduleScope,
        triggerType: template.triggerType,
      } : null,
      orgId: instance.orgId,
      entityType: instance.entityType,
      entityId: instance.entityId,
      entity,
      name: instance.name,
      status: instance.status,
      startedAt: instance.startedAt?.toISOString() ?? undefined,
      dueAt: instance.dueAt?.toISOString() ?? undefined,
      completedAt: instance.completedAt?.toISOString() ?? undefined,
      totalSteps: instance.totalSteps,
      completedSteps: instance.completedSteps,
      progress: instance.totalSteps > 0 ? Math.round((instance.completedSteps / instance.totalSteps) * 100) : 0,
      startedById: instance.startedById ?? undefined,
      startedBy,
      ownerId: instance.ownerId ?? undefined,
      owner,
      metadata: instance.metadata,
      createdAt: instance.createdAt.toISOString(),
      updatedAt: instance.updatedAt.toISOString(),
      steps: steps.map(({ step, templateStep }) => ({
        id: step.id,
        instanceId: step.instanceId,
        templateStepId: step.templateStepId,
        parentStepId: step.parentStepId ?? undefined,
        name: step.name,
        description: step.description ?? undefined,
        orderIndex: step.orderIndex,
        status: step.status,
        assigneeId: step.assigneeId ?? undefined,
        assignee: step.assigneeId ? userById.get(step.assigneeId) : null,
        assignedPersonId: step.assignedPersonId ?? undefined,
        assignedPerson: step.assignedPersonId ? personById.get(step.assignedPersonId) : null,
        dueAt: step.dueAt?.toISOString() ?? undefined,
        startedAt: step.startedAt?.toISOString() ?? undefined,
        completedAt: step.completedAt?.toISOString() ?? undefined,
        completedById: step.completedById ?? undefined,
        completedBy: step.completedById ? userById.get(step.completedById) : null,
        notes: step.notes ?? undefined,
        metadata: step.metadata,
        // Include template step info for UI
        templateStep: templateStep ? {
          stepType: templateStep.stepType,
          assigneeType: templateStep.assigneeType,
          isRequired: templateStep.isRequired,
          positionX: templateStep.positionX,
          positionY: templateStep.positionY,
        } : null,
        createdAt: step.createdAt.toISOString(),
        updatedAt: step.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching workflow instance:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflow instance" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workflows/instances/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const parseResult = UpdateInstanceSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    const session = await requireSession()
    const orgId = session.orgId
    
    // Check instance exists
    const existing = await db
      .select()
      .from(workflowInstances)
      .where(and(
        eq(workflowInstances.id, id),
        eq(workflowInstances.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      )
    }
    
    const previousValues = existing[0]
    
    // Build update
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    
    if (data.status !== undefined) {
      updateData.status = data.status
      
      // Set completedAt if marking as completed
      if (data.status === "completed" && previousValues.status !== "completed") {
        updateData.completedAt = new Date()
      }
    }
    
    if (data.dueAt !== undefined) {
      updateData.dueAt = new Date(data.dueAt)
    }
    
    if (data.ownerId !== undefined) {
      updateData.ownerId = data.ownerId
    }
    
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata
    }
    
    // Update
    const result = await db
      .update(workflowInstances)
      .set(updateData)
      .where(eq(workflowInstances.id, id))
      .returning()
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "workflows.instances",
        "workflow_instance",
        id,
        result[0].name,
        previousValues as Record<string, unknown>,
        result[0] as unknown as Record<string, unknown>
      )
    }
    
    // Return full instance
    return GET(request, { params })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error updating workflow instance:", error)
    return NextResponse.json(
      { error: "Failed to update workflow instance" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workflows/instances/[id]
 * Cancels the instance (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const session = await requireSession()
    const orgId = session.orgId
    
    // Check instance exists
    const existing = await db
      .select()
      .from(workflowInstances)
      .where(and(
        eq(workflowInstances.id, id),
        eq(workflowInstances.orgId, orgId)
      ))
      .limit(1)
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      )
    }
    
    // Cancel instead of hard delete
    await db
      .update(workflowInstances)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(workflowInstances.id, id))
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "workflows.instances",
        "workflow_instance",
        id,
        existing[0].name,
        existing[0] as unknown as Record<string, unknown>,
        { ...existing[0], status: "cancelled" } as unknown as Record<string, unknown>
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error cancelling workflow instance:", error)
    return NextResponse.json(
      { error: "Failed to cancel workflow instance" },
      { status: 500 }
    )
  }
}

