/**
 * Workflow Engine
 * 
 * Handles automatic workflow instance creation and management.
 * Triggered when certain events occur in the system, like:
 * - Person status changes (onboarding, offboarding)
 * - Asset assignment changes
 */

import { eq, and, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  workflowTemplates,
  workflowTemplateSteps,
  workflowInstances,
  workflowInstanceSteps,
  persons,
} from "@/lib/db/schema"
import { peopleSettings } from "@/lib/db/schema/people-settings"

interface PersonWorkflowTriggerParams {
  personId: string
  orgId: string
  newStatus: "onboarding" | "offboarding"
  changedById?: string
}

interface WorkflowTriggerResult {
  triggered: boolean
  instanceId?: string
  message?: string
}

/**
 * Trigger a workflow when a person's status changes
 */
export async function triggerPersonWorkflow(
  params: PersonWorkflowTriggerParams
): Promise<WorkflowTriggerResult> {
  const { personId, orgId, newStatus, changedById } = params
  
  console.log(`[Workflow Engine] Checking workflow trigger for person ${personId}, status: ${newStatus}`)
  
  // Get people settings to check if auto-workflow is enabled
  const [settings] = await db
    .select()
    .from(peopleSettings)
    .where(eq(peopleSettings.orgId, orgId))
    .limit(1)
  
  if (!settings) {
    console.log("[Workflow Engine] No people settings found for org")
    return { triggered: false, message: "No settings configured" }
  }
  
  // Check if auto-workflow is enabled for this status type
  const triggerType = newStatus === "onboarding" ? "person_onboarding" : "person_offboarding"
  let templateId: string | null = null
  
  if (newStatus === "onboarding") {
    if (!settings.autoOnboardingWorkflow) {
      console.log("[Workflow Engine] Auto onboarding workflow not enabled")
      return { triggered: false, message: "Auto onboarding workflow not enabled" }
    }
    templateId = settings.defaultOnboardingWorkflowTemplateId
  } else if (newStatus === "offboarding") {
    if (!settings.autoOffboardingWorkflow) {
      console.log("[Workflow Engine] Auto offboarding workflow not enabled")
      return { triggered: false, message: "Auto offboarding workflow not enabled" }
    }
    templateId = settings.defaultOffboardingWorkflowTemplateId
  }
  
  if (!templateId) {
    console.log(`[Workflow Engine] No default ${newStatus} workflow template configured`)
    return { triggered: false, message: `No default ${newStatus} workflow template configured` }
  }
  
  // Get the template
  const [template] = await db
    .select()
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.id, templateId),
        eq(workflowTemplates.orgId, orgId),
        eq(workflowTemplates.status, "active"),
        eq(workflowTemplates.isActive, true)
      )
    )
    .limit(1)
  
  if (!template) {
    console.log(`[Workflow Engine] Workflow template ${templateId} not found or inactive`)
    return { triggered: false, message: "Workflow template not found or inactive" }
  }
  
  // Get the person for naming the instance
  const [person] = await db
    .select()
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1)
  
  if (!person) {
    console.log(`[Workflow Engine] Person ${personId} not found`)
    return { triggered: false, message: "Person not found" }
  }
  
  // Get all template steps
  const templateSteps = await db
    .select()
    .from(workflowTemplateSteps)
    .where(eq(workflowTemplateSteps.templateId, template.id))
    .orderBy(asc(workflowTemplateSteps.orderIndex))
  
  // Calculate due date
  const now = new Date()
  const dueAt = template.defaultDueDays
    ? new Date(now.getTime() + template.defaultDueDays * 24 * 60 * 60 * 1000)
    : null
  
  // Create the workflow instance
  const [instance] = await db
    .insert(workflowInstances)
    .values({
      templateId: template.id,
      orgId,
      entityType: "person",
      entityId: personId,
      name: `${template.name} - ${person.name}`,
      status: "in_progress",
      startedAt: now,
      dueAt,
      totalSteps: templateSteps.length,
      completedSteps: 0,
      startedById: changedById || null,
      ownerId: template.defaultOwnerId || null, // Carry over owner from template
      metadata: {
        personName: person.name,
        personEmail: person.email,
        triggerType,
        triggeredAt: now.toISOString(),
      },
    })
    .returning()
  
  console.log(`[Workflow Engine] Created workflow instance ${instance.id}`)
  
  // Create instance steps from template steps
  if (templateSteps.length > 0) {
    const instanceStepsData = templateSteps.map((step, index) => {
      // Calculate step due date based on offset
      let stepDueAt: Date | null = null
      if (step.dueOffsetDays) {
        if (step.dueOffsetFrom === "workflow_start" || !step.dueOffsetFrom) {
          stepDueAt = new Date(now.getTime() + step.dueOffsetDays * 24 * 60 * 60 * 1000)
        }
        // For "previous_step_completion", we'd need to update this when the previous step completes
      }
      
      return {
        instanceId: instance.id,
        templateStepId: step.id,
        name: step.name,
        description: step.description,
        orderIndex: step.orderIndex,
        status: index === 0 ? "in_progress" as const : "pending" as const,
        assignedPersonId: step.defaultAssigneeId,
        dueAt: stepDueAt,
        metadata: {
          stepType: step.stepType,
          assigneeType: step.assigneeType,
          assigneeConfig: step.assigneeConfig,
          isRequired: step.isRequired,
        },
      }
    })
    
    await db.insert(workflowInstanceSteps).values(instanceStepsData)
    console.log(`[Workflow Engine] Created ${instanceStepsData.length} instance steps`)
  }
  
  return {
    triggered: true,
    instanceId: instance.id,
    message: `Created ${newStatus} workflow instance`,
  }
}

/**
 * Check if a person has an active workflow
 */
export async function getActivePersonWorkflows(personId: string, orgId: string) {
  return db
    .select({
      id: workflowInstances.id,
      name: workflowInstances.name,
      status: workflowInstances.status,
      totalSteps: workflowInstances.totalSteps,
      completedSteps: workflowInstances.completedSteps,
      dueAt: workflowInstances.dueAt,
      startedAt: workflowInstances.startedAt,
    })
    .from(workflowInstances)
    .where(
      and(
        eq(workflowInstances.entityType, "person"),
        eq(workflowInstances.entityId, personId),
        eq(workflowInstances.orgId, orgId)
      )
    )
    .orderBy(asc(workflowInstances.createdAt))
}

/**
 * Update workflow instance step status
 * Handles automatic progression logic
 */
export async function updateWorkflowStepStatus(
  stepId: string,
  newStatus: "pending" | "in_progress" | "completed" | "skipped" | "failed",
  completedById?: string,
  notes?: string
) {
  const now = new Date()
  
  // Get the step
  const [step] = await db
    .select()
    .from(workflowInstanceSteps)
    .where(eq(workflowInstanceSteps.id, stepId))
    .limit(1)
  
  if (!step) {
    throw new Error("Step not found")
  }
  
  // Update the step
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  }
  
  if (newStatus === "in_progress" && !step.startedAt) {
    updateData.startedAt = now
  }
  
  if (newStatus === "completed" || newStatus === "skipped") {
    updateData.completedAt = now
    updateData.completedById = completedById || null
    if (notes) {
      updateData.notes = notes
    }
  }
  
  await db
    .update(workflowInstanceSteps)
    .set(updateData)
    .where(eq(workflowInstanceSteps.id, stepId))
  
  // If step was completed, update the workflow instance progress
  if (newStatus === "completed" || newStatus === "skipped") {
    // Count completed steps
    const completedSteps = await db
      .select()
      .from(workflowInstanceSteps)
      .where(
        and(
          eq(workflowInstanceSteps.instanceId, step.instanceId),
          eq(workflowInstanceSteps.status, "completed")
        )
      )
    
    const skippedSteps = await db
      .select()
      .from(workflowInstanceSteps)
      .where(
        and(
          eq(workflowInstanceSteps.instanceId, step.instanceId),
          eq(workflowInstanceSteps.status, "skipped")
        )
      )
    
    const totalCompleted = completedSteps.length + skippedSteps.length
    
    // Get the instance to check total steps
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, step.instanceId))
      .limit(1)
    
    if (instance) {
      const instanceUpdate: Record<string, unknown> = {
        completedSteps: totalCompleted,
        updatedAt: now,
      }
      
      // If all steps are completed, mark the workflow as completed
      if (totalCompleted >= instance.totalSteps) {
        instanceUpdate.status = "completed"
        instanceUpdate.completedAt = now
      }
      
      await db
        .update(workflowInstances)
        .set(instanceUpdate)
        .where(eq(workflowInstances.id, step.instanceId))
      
      // Find and activate the next pending step
      if (totalCompleted < instance.totalSteps) {
        const [nextStep] = await db
          .select()
          .from(workflowInstanceSteps)
          .where(
            and(
              eq(workflowInstanceSteps.instanceId, step.instanceId),
              eq(workflowInstanceSteps.status, "pending")
            )
          )
          .orderBy(asc(workflowInstanceSteps.orderIndex))
          .limit(1)
        
        if (nextStep) {
          await db
            .update(workflowInstanceSteps)
            .set({ status: "in_progress", startedAt: now, updatedAt: now })
            .where(eq(workflowInstanceSteps.id, nextStep.id))
        }
      }
    }
  }
  
  return { success: true }
}
