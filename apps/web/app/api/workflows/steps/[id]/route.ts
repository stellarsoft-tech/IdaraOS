/**
 * Workflow Instance Step API Routes
 * GET /api/workflows/steps/[id] - Get step details
 * PATCH /api/workflows/steps/[id] - Update step (complete, assign, etc.)
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { 
  workflowInstanceSteps,
  workflowInstances,
  workflowTemplateSteps,
  users 
} from "@/lib/db/schema"
import { requireOrgId, getAuditLogger, requireSession } from "@/lib/api/context"
import { z } from "zod"

// Update step schema
const UpdateStepSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped", "blocked"]).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Helper to update instance progress counts
 */
async function updateInstanceProgress(instanceId: string) {
  // Count completed steps (root level only)
  const completedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowInstanceSteps)
    .where(and(
      eq(workflowInstanceSteps.instanceId, instanceId),
      eq(workflowInstanceSteps.status, "completed"),
      sql`${workflowInstanceSteps.parentStepId} IS NULL`
    ))
  
  const completedCount = completedResult[0]?.count || 0
  
  // Get total steps count
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowInstanceSteps)
    .where(and(
      eq(workflowInstanceSteps.instanceId, instanceId),
      sql`${workflowInstanceSteps.parentStepId} IS NULL`
    ))
  
  const totalCount = totalResult[0]?.count || 0
  
  // Update instance
  await db
    .update(workflowInstances)
    .set({
      completedSteps: completedCount,
      totalSteps: totalCount,
      updatedAt: new Date(),
      // Auto-complete instance if all steps are done
      ...(completedCount >= totalCount && totalCount > 0 ? {
        status: "completed" as const,
        completedAt: new Date(),
      } : {}),
    })
    .where(eq(workflowInstances.id, instanceId))
}

/**
 * GET /api/workflows/steps/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = await requireOrgId(request)
    
    // Get step with instance check
    const steps = await db
      .select({
        step: workflowInstanceSteps,
        instance: workflowInstances,
        templateStep: workflowTemplateSteps,
      })
      .from(workflowInstanceSteps)
      .leftJoin(workflowInstances, eq(workflowInstanceSteps.instanceId, workflowInstances.id))
      .leftJoin(workflowTemplateSteps, eq(workflowInstanceSteps.templateStepId, workflowTemplateSteps.id))
      .where(eq(workflowInstanceSteps.id, id))
      .limit(1)
    
    if (steps.length === 0 || !steps[0].instance) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      )
    }
    
    const { step, instance, templateStep } = steps[0]
    
    // Check org access
    if (instance.orgId !== orgId) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      )
    }
    
    // Get assignee
    let assignee = null
    if (step.assigneeId) {
      const assignees = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, step.assigneeId))
        .limit(1)
      assignee = assignees[0] || null
    }
    
    // Get completed by user
    let completedBy = null
    if (step.completedById) {
      const completers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, step.completedById))
        .limit(1)
      completedBy = completers[0] || null
    }
    
    return NextResponse.json({
      id: step.id,
      instanceId: step.instanceId,
      templateStepId: step.templateStepId,
      parentStepId: step.parentStepId ?? undefined,
      name: step.name,
      description: step.description ?? undefined,
      orderIndex: step.orderIndex,
      status: step.status,
      assigneeId: step.assigneeId ?? undefined,
      assignee,
      dueAt: step.dueAt?.toISOString() ?? undefined,
      startedAt: step.startedAt?.toISOString() ?? undefined,
      completedAt: step.completedAt?.toISOString() ?? undefined,
      completedById: step.completedById ?? undefined,
      completedBy,
      notes: step.notes ?? undefined,
      metadata: step.metadata,
      templateStep: templateStep ? {
        stepType: templateStep.stepType,
        assigneeType: templateStep.assigneeType,
        isRequired: templateStep.isRequired,
        positionX: templateStep.positionX,
        positionY: templateStep.positionY,
        metadata: templateStep.metadata,
      } : null,
      instance: {
        id: instance.id,
        name: instance.name,
        status: instance.status,
        entityType: instance.entityType,
        entityId: instance.entityId,
      },
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error fetching workflow step:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflow step" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workflows/steps/[id]
 * Update step status, assignee, notes, etc.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const parseResult = UpdateStepSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    const session = await requireSession()
    const orgId = session.orgId
    
    // Get step with instance check
    const existing = await db
      .select({
        step: workflowInstanceSteps,
        instance: workflowInstances,
      })
      .from(workflowInstanceSteps)
      .leftJoin(workflowInstances, eq(workflowInstanceSteps.instanceId, workflowInstances.id))
      .where(eq(workflowInstanceSteps.id, id))
      .limit(1)
    
    if (existing.length === 0 || !existing[0].instance) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      )
    }
    
    const { step: previousStep, instance } = existing[0]
    
    // Check org access
    if (instance.orgId !== orgId) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      )
    }
    
    // Check instance is not completed/cancelled
    if (instance.status === "completed" || instance.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot update steps on a completed or cancelled workflow" },
        { status: 400 }
      )
    }
    
    // Build update
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    
    if (data.status !== undefined) {
      updateData.status = data.status
      
      // Handle status-specific updates
      if (data.status === "in_progress" && previousStep.status === "pending") {
        updateData.startedAt = new Date()
      }
      
      if (data.status === "completed" && previousStep.status !== "completed") {
        updateData.completedAt = new Date()
        updateData.completedById = session.userId
      }
      
      // Clear completion info if reverting from completed
      if (data.status !== "completed" && previousStep.status === "completed") {
        updateData.completedAt = null
        updateData.completedById = null
      }
    }
    
    if (data.assigneeId !== undefined) {
      updateData.assigneeId = data.assigneeId
    }
    
    if (data.notes !== undefined) {
      updateData.notes = data.notes
    }
    
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata
    }
    
    // Update step
    const result = await db
      .update(workflowInstanceSteps)
      .set(updateData)
      .where(eq(workflowInstanceSteps.id, id))
      .returning()
    
    // Update instance progress if status changed
    if (data.status !== undefined) {
      await updateInstanceProgress(instance.id)
    }
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logUpdate(
        "workflows.steps",
        "workflow_instance_step",
        id,
        result[0].name,
        previousStep as Record<string, unknown>,
        result[0] as unknown as Record<string, unknown>
      )
    }
    
    // Return updated step
    return GET(request, { params })
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    console.error("Error updating workflow step:", error)
    return NextResponse.json(
      { error: "Failed to update workflow step" },
      { status: 500 }
    )
  }
}

