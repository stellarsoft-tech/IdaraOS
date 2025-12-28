/**
 * Central Workflow Processor
 * 
 * Provides a unified event-driven interface for triggering workflows.
 * This processor should be used from all API routes when relevant events occur.
 * 
 * Usage:
 *   import { processWorkflowEvent } from "@/lib/workflows/processor"
 *   
 *   // When creating/updating a person
 *   await processWorkflowEvent({
 *     type: "person.status_changed",
 *     personId: "...",
 *     personName: "...",
 *     previousStatus: "active",
 *     newStatus: "onboarding",
 *     orgId: "...",
 *     triggeredByUserId: "..."
 *   })
 */

import { triggerPersonWorkflow, getActivePersonWorkflows } from "./engine"

/**
 * Supported workflow events
 */
export type WorkflowEventType = 
  | "person.created"
  | "person.status_changed"
  | "person.deleted"
  | "asset.assigned"
  | "asset.returned"
  | "asset.maintenance_started"
  | "asset.maintenance_completed"

/**
 * Event payload types
 */
export interface PersonCreatedEvent {
  type: "person.created"
  personId: string
  personName: string
  status: string
  orgId: string
  triggeredByUserId?: string
}

export interface PersonStatusChangedEvent {
  type: "person.status_changed"
  personId: string
  personName: string
  previousStatus: string
  newStatus: string
  orgId: string
  triggeredByUserId?: string
}

export interface PersonDeletedEvent {
  type: "person.deleted"
  personId: string
  personName: string
  orgId: string
  triggeredByUserId?: string
}

export interface AssetAssignedEvent {
  type: "asset.assigned"
  assetId: string
  assetName: string
  personId: string
  personName: string
  orgId: string
  triggeredByUserId?: string
}

export interface AssetReturnedEvent {
  type: "asset.returned"
  assetId: string
  assetName: string
  previousPersonId: string
  previousPersonName: string
  orgId: string
  triggeredByUserId?: string
}

export interface AssetMaintenanceStartedEvent {
  type: "asset.maintenance_started"
  assetId: string
  assetName: string
  maintenanceId: string
  orgId: string
  triggeredByUserId?: string
}

export interface AssetMaintenanceCompletedEvent {
  type: "asset.maintenance_completed"
  assetId: string
  assetName: string
  maintenanceId: string
  orgId: string
  triggeredByUserId?: string
}

export type WorkflowEventPayload = 
  | PersonCreatedEvent 
  | PersonStatusChangedEvent 
  | PersonDeletedEvent
  | AssetAssignedEvent
  | AssetReturnedEvent
  | AssetMaintenanceStartedEvent
  | AssetMaintenanceCompletedEvent

/**
 * Result of workflow processing
 */
export interface WorkflowProcessResult {
  success: boolean
  workflowsTriggered: Array<{
    instanceId: string
    templateName?: string
    message?: string
  }>
  errors: string[]
}

/**
 * Process a workflow event and trigger any applicable workflows
 */
export async function processWorkflowEvent(
  event: WorkflowEventPayload
): Promise<WorkflowProcessResult> {
  const result: WorkflowProcessResult = {
    success: true,
    workflowsTriggered: [],
    errors: [],
  }

  try {
    switch (event.type) {
      case "person.created":
        await handlePersonCreated(event, result)
        break
      case "person.status_changed":
        await handlePersonStatusChanged(event, result)
        break
      case "person.deleted":
        // Could trigger cleanup workflows in the future
        console.log(`[WorkflowProcessor] Person deleted: ${event.personName}`)
        break
      case "asset.assigned":
        await handleAssetAssigned(event, result)
        break
      case "asset.returned":
        await handleAssetReturned(event, result)
        break
      case "asset.maintenance_started":
        // Could trigger maintenance workflows in the future
        console.log(`[WorkflowProcessor] Asset maintenance started: ${event.assetName}`)
        break
      case "asset.maintenance_completed":
        // Could trigger post-maintenance workflows in the future
        console.log(`[WorkflowProcessor] Asset maintenance completed: ${event.assetName}`)
        break
      default:
        console.log(`[WorkflowProcessor] No handler for event type: ${(event as { type: string }).type}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    result.success = false
    result.errors.push(errorMessage)
    console.error("[WorkflowProcessor] Error processing event:", error)
  }

  return result
}

/**
 * Handle person created event
 */
async function handlePersonCreated(
  event: PersonCreatedEvent,
  result: WorkflowProcessResult
): Promise<void> {
  console.log(`[WorkflowProcessor] Handling person.created for ${event.personName} with status ${event.status}`)
  
  // Trigger workflow based on initial status
  if (event.status === "onboarding" || event.status === "offboarding") {
    const workflowResult = await triggerPersonWorkflow({
      personId: event.personId,
      orgId: event.orgId,
      newStatus: event.status,
      changedById: event.triggeredByUserId,
    })

    if (workflowResult.triggered && workflowResult.instanceId) {
      result.workflowsTriggered.push({
        instanceId: workflowResult.instanceId,
        message: workflowResult.message,
      })
      console.log(`[WorkflowProcessor] Created ${event.status} workflow for new person ${event.personName}`)
    }
  }
}

/**
 * Handle person status changed event
 */
async function handlePersonStatusChanged(
  event: PersonStatusChangedEvent,
  result: WorkflowProcessResult
): Promise<void> {
  console.log(`[WorkflowProcessor] Handling person.status_changed for ${event.personName}: ${event.previousStatus} -> ${event.newStatus}`)
  
  // Only trigger if status actually changed
  if (event.previousStatus === event.newStatus) {
    return
  }

  // Trigger workflow based on new status
  if (event.newStatus === "onboarding" || event.newStatus === "offboarding") {
    const workflowResult = await triggerPersonWorkflow({
      personId: event.personId,
      orgId: event.orgId,
      newStatus: event.newStatus,
      changedById: event.triggeredByUserId,
    })

    if (workflowResult.triggered && workflowResult.instanceId) {
      result.workflowsTriggered.push({
        instanceId: workflowResult.instanceId,
        message: workflowResult.message,
      })
      console.log(`[WorkflowProcessor] Created ${event.newStatus} workflow for ${event.personName}`)
    }
  }
}

/**
 * Handle asset assigned event
 * Could trigger asset provisioning workflows in the future
 */
async function handleAssetAssigned(
  event: AssetAssignedEvent,
  result: WorkflowProcessResult
): Promise<void> {
  console.log(`[WorkflowProcessor] Handling asset.assigned: ${event.assetName} to ${event.personName}`)
  
  // TODO: Check for asset provisioning workflow template
  // For now, just log the event
}

/**
 * Handle asset returned event
 * Could trigger asset deprovisioning workflows in the future
 */
async function handleAssetReturned(
  event: AssetReturnedEvent,
  result: WorkflowProcessResult
): Promise<void> {
  console.log(`[WorkflowProcessor] Handling asset.returned: ${event.assetName} from ${event.previousPersonName}`)
  
  // TODO: Check for asset deprovisioning workflow template
  // For now, just log the event
}

// Re-export useful functions from engine for convenience
export { getActivePersonWorkflows }
