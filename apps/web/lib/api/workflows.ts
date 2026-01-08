/**
 * Workflows API Client
 * React Query hooks for the Workflows module
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ============================================================================
// Types
// ============================================================================

export interface UserInfo {
  id: string
  name: string
  email: string
}

export interface OwnerInfo {
  id: string
  name: string
}

export interface WorkflowTemplate {
  id: string
  orgId: string
  name: string
  description?: string
  moduleScope?: string
  triggerType?: string
  status: "draft" | "active" | "archived"
  isActive: boolean
  defaultDueDays?: number
  defaultOwnerId?: string
  defaultOwner?: OwnerInfo | null
  settings?: Record<string, unknown>
  createdById?: string
  createdBy?: UserInfo | null
  stepsCount: number
  instancesCount: number
  createdAt: string
  updatedAt: string
}

export interface WorkflowTemplateStep {
  id: string
  templateId: string
  parentStepId?: string
  name: string
  description?: string
  stepType: "task" | "notification" | "gateway" | "group"
  orderIndex: number
  positionX: number
  positionY: number
  assigneeType: "specific_user" | "role" | "dynamic_manager" | "dynamic_creator" | "unassigned"
  assigneeConfig?: Record<string, unknown>
  defaultAssigneeId?: string
  defaultAssignee?: {
    id: string
    name: string
    email: string
  }
  dueOffsetDays?: number
  dueOffsetFrom: string
  isRequired: boolean
  // Attachment configuration
  attachmentsEnabled: boolean
  fileCategoryId?: string
  filePathPrefix?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface WorkflowTemplateEdge {
  id: string
  templateId: string
  sourceStepId: string
  targetStepId: string
  conditionType: "always" | "if_approved" | "if_rejected" | "conditional"
  conditionConfig?: Record<string, unknown>
  label?: string
  createdAt: string
}

export interface WorkflowTemplateDetail extends WorkflowTemplate {
  steps: WorkflowTemplateStep[]
  edges: WorkflowTemplateEdge[]
}

export interface TemplateInfo {
  id: string
  name: string
  moduleScope: string | null
  triggerType: string | null
}

export interface EntityInfo {
  id: string
  name: string
  type: string
  slug?: string
  email?: string
}

export interface WorkflowInstance {
  id: string
  templateId: string
  template: TemplateInfo | null
  orgId: string
  entityType: string
  entityId: string
  entity?: EntityInfo | null
  name: string
  status: "pending" | "in_progress" | "completed" | "cancelled" | "on_hold"
  startedAt?: string
  dueAt?: string
  completedAt?: string
  totalSteps: number
  completedSteps: number
  progress: number
  startedById?: string
  startedBy?: UserInfo | null
  ownerId?: string
  owner?: OwnerInfo | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface PersonInfo {
  id: string
  name: string
  email: string
  avatar?: string | null
}

export interface WorkflowInstanceStep {
  id: string
  instanceId: string
  templateStepId: string
  parentStepId?: string
  name: string
  description?: string
  orderIndex: number
  status: "pending" | "in_progress" | "completed" | "skipped" | "blocked"
  assigneeId?: string
  assignee?: UserInfo | null
  assignedPersonId?: string
  assignedPerson?: PersonInfo | null
  dueAt?: string
  startedAt?: string
  completedAt?: string
  completedById?: string
  completedBy?: UserInfo | null
  notes?: string
  metadata?: Record<string, unknown>
  templateStep?: {
    stepType: string
    assigneeType: string
    isRequired: boolean
    positionX: number
    positionY: number
    // Attachment configuration from template
    attachmentsEnabled: boolean
    fileCategoryId?: string
    filePathPrefix?: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowInstanceDetail extends WorkflowInstance {
  steps: WorkflowInstanceStep[]
}

// Create/Update types

export interface CreateTemplate {
  name: string
  description?: string
  moduleScope?: string
  triggerType?: string
  status?: WorkflowTemplate["status"]
  isActive?: boolean
  defaultDueDays?: number
  settings?: Record<string, unknown>
}

export interface UpdateTemplate {
  name?: string
  description?: string
  moduleScope?: string
  triggerType?: string
  status?: WorkflowTemplate["status"]
  isActive?: boolean
  defaultDueDays?: number
  defaultOwnerId?: string | null
  settings?: Record<string, unknown>
}

export interface SaveTemplateStep {
  id?: string
  parentStepId?: string | null
  name: string
  description?: string
  stepType?: WorkflowTemplateStep["stepType"]
  orderIndex?: number
  positionX?: number
  positionY?: number
  assigneeType?: WorkflowTemplateStep["assigneeType"]
  assigneeConfig?: Record<string, unknown>
  defaultAssigneeId?: string | null
  dueOffsetDays?: number
  dueOffsetFrom?: string
  isRequired?: boolean
  // Attachment configuration
  attachmentsEnabled?: boolean
  fileCategoryId?: string | null
  filePathPrefix?: string | null
  metadata?: Record<string, unknown>
}

export interface SaveTemplateEdge {
  id?: string
  sourceStepId: string
  targetStepId: string
  conditionType?: WorkflowTemplateEdge["conditionType"]
  conditionConfig?: Record<string, unknown>
  label?: string
}

export interface SaveTemplate extends UpdateTemplate {
  steps?: SaveTemplateStep[]
  edges?: SaveTemplateEdge[]
}

export interface CreateInstance {
  templateId: string
  entityType: string
  entityId: string
  name?: string
  dueAt?: string
  metadata?: Record<string, unknown>
}

export interface UpdateInstance {
  status?: WorkflowInstance["status"]
  dueAt?: string
  ownerId?: string | null
  metadata?: Record<string, unknown>
}

export interface UpdateStep {
  status?: WorkflowInstanceStep["status"]
  assigneeId?: string | null
  assignedPersonId?: string | null
  notes?: string
  metadata?: Record<string, unknown>
}

// Filter types

export interface TemplateFilters {
  search?: string
  status?: string
  moduleScope?: string
  triggerType?: string
  activeOnly?: boolean
}

export interface InstanceFilters {
  search?: string
  status?: string
  templateId?: string
  entityType?: string
  entityId?: string
}

// ============================================================================
// Query Keys
// ============================================================================

export const workflowTemplatesKeys = {
  all: ["workflow-templates"] as const,
  lists: () => [...workflowTemplatesKeys.all, "list"] as const,
  list: (filters?: TemplateFilters) => [...workflowTemplatesKeys.lists(), filters] as const,
  details: () => [...workflowTemplatesKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowTemplatesKeys.details(), id] as const,
}

export const workflowInstancesKeys = {
  all: ["workflow-instances"] as const,
  lists: () => [...workflowInstancesKeys.all, "list"] as const,
  list: (filters?: InstanceFilters) => [...workflowInstancesKeys.lists(), filters] as const,
  details: () => [...workflowInstancesKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowInstancesKeys.details(), id] as const,
}

export const workflowStepsKeys = {
  all: ["workflow-steps"] as const,
  details: () => [...workflowStepsKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowStepsKeys.details(), id] as const,
}

// ============================================================================
// API Functions
// ============================================================================

const TEMPLATES_BASE = "/api/workflows/templates"
const INSTANCES_BASE = "/api/workflows/instances"
const STEPS_BASE = "/api/workflows/steps"

// Templates

async function fetchTemplates(filters?: TemplateFilters): Promise<WorkflowTemplate[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) params.set("search", filters.search)
  if (filters?.status) params.set("status", filters.status)
  if (filters?.moduleScope) params.set("moduleScope", filters.moduleScope)
  if (filters?.triggerType) params.set("triggerType", filters.triggerType)
  if (filters?.activeOnly) params.set("activeOnly", "true")
  
  const url = params.toString() ? `${TEMPLATES_BASE}?${params}` : TEMPLATES_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch workflow templates")
  }
  
  return res.json()
}

async function fetchTemplate(id: string): Promise<WorkflowTemplateDetail | null> {
  const res = await fetch(`${TEMPLATES_BASE}/${id}`)
  
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch workflow template")
  
  return res.json()
}

async function createTemplate(data: CreateTemplate): Promise<WorkflowTemplate> {
  const res = await fetch(TEMPLATES_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create workflow template" }))
    throw new Error(error.error || "Failed to create workflow template")
  }
  
  return res.json()
}

async function updateTemplate(id: string, data: SaveTemplate): Promise<WorkflowTemplateDetail> {
  const res = await fetch(`${TEMPLATES_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update workflow template" }))
    throw new Error(error.error || "Failed to update workflow template")
  }
  
  return res.json()
}

async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${TEMPLATES_BASE}/${id}`, { method: "DELETE" })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to delete workflow template" }))
    throw new Error(error.error || "Failed to delete workflow template")
  }
}

// Instances

async function fetchInstances(filters?: InstanceFilters): Promise<WorkflowInstance[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) params.set("search", filters.search)
  if (filters?.status) params.set("status", filters.status)
  if (filters?.templateId) params.set("templateId", filters.templateId)
  if (filters?.entityType) params.set("entityType", filters.entityType)
  if (filters?.entityId) params.set("entityId", filters.entityId)
  
  const url = params.toString() ? `${INSTANCES_BASE}?${params}` : INSTANCES_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch workflow instances")
  }
  
  return res.json()
}

async function fetchInstance(id: string): Promise<WorkflowInstanceDetail | null> {
  const res = await fetch(`${INSTANCES_BASE}/${id}`)
  
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch workflow instance")
  
  return res.json()
}

async function createInstance(data: CreateInstance): Promise<WorkflowInstance> {
  const res = await fetch(INSTANCES_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create workflow instance" }))
    throw new Error(error.error || "Failed to create workflow instance")
  }
  
  return res.json()
}

async function updateInstance(id: string, data: UpdateInstance): Promise<WorkflowInstanceDetail> {
  const res = await fetch(`${INSTANCES_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update workflow instance" }))
    throw new Error(error.error || "Failed to update workflow instance")
  }
  
  return res.json()
}

async function cancelInstance(id: string): Promise<void> {
  const res = await fetch(`${INSTANCES_BASE}/${id}`, { method: "DELETE" })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to cancel workflow instance" }))
    throw new Error(error.error || "Failed to cancel workflow instance")
  }
}

// Steps

async function fetchStep(id: string): Promise<WorkflowInstanceStep | null> {
  const res = await fetch(`${STEPS_BASE}/${id}`)
  
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch workflow step")
  
  return res.json()
}

async function updateStep(id: string, data: UpdateStep): Promise<WorkflowInstanceStep> {
  const res = await fetch(`${STEPS_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update workflow step" }))
    throw new Error(error.error || "Failed to update workflow step")
  }
  
  return res.json()
}

// ============================================================================
// React Query Hooks
// ============================================================================

// Templates

export function useWorkflowTemplatesList(filters?: TemplateFilters) {
  return useQuery({
    queryKey: workflowTemplatesKeys.list(filters),
    queryFn: () => fetchTemplates(filters),
  })
}

export function useWorkflowTemplateDetail(id: string) {
  return useQuery({
    queryKey: workflowTemplatesKeys.detail(id),
    queryFn: () => fetchTemplate(id),
    enabled: !!id,
  })
}

export function useCreateWorkflowTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowTemplatesKeys.lists() })
    },
  })
}

export function useUpdateWorkflowTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SaveTemplate }) => updateTemplate(id, data),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: workflowTemplatesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: workflowTemplatesKeys.detail(template.id) })
    },
  })
}

export function useDeleteWorkflowTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowTemplatesKeys.lists() })
    },
  })
}

// Instances

export function useWorkflowInstancesList(filters?: InstanceFilters) {
  return useQuery({
    queryKey: workflowInstancesKeys.list(filters),
    queryFn: () => fetchInstances(filters),
  })
}

export function useWorkflowInstanceDetail(id: string) {
  return useQuery({
    queryKey: workflowInstancesKeys.detail(id),
    queryFn: () => fetchInstance(id),
    enabled: !!id,
  })
}

export function useCreateWorkflowInstance() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowInstancesKeys.lists() })
    },
  })
}

export function useUpdateWorkflowInstance() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInstance }) => updateInstance(id, data),
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: workflowInstancesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: workflowInstancesKeys.detail(instance.id) })
    },
  })
}

export function useCancelWorkflowInstance() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: cancelInstance,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: workflowInstancesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: workflowInstancesKeys.detail(id) })
    },
  })
}

// Steps

export function useWorkflowStepDetail(id: string) {
  return useQuery({
    queryKey: workflowStepsKeys.detail(id),
    queryFn: () => fetchStep(id),
    enabled: !!id,
  })
}

export function useUpdateWorkflowStep() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStep }) => updateStep(id, data),
    onSuccess: (step) => {
      queryClient.invalidateQueries({ queryKey: workflowStepsKeys.detail(step.id) })
      queryClient.invalidateQueries({ queryKey: workflowInstancesKeys.detail(step.instanceId) })
      queryClient.invalidateQueries({ queryKey: workflowInstancesKeys.lists() })
    },
  })
}

/**
 * Helper hook to complete a step
 */
export function useCompleteWorkflowStep() {
  const updateStep = useUpdateWorkflowStep()
  
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
      updateStep.mutateAsync({ id, data: { status: "completed", notes } }),
  })
}

/**
 * Helper hook to start a step (mark as in_progress)
 */
export function useStartWorkflowStep() {
  const updateStep = useUpdateWorkflowStep()
  
  return useMutation({
    mutationFn: ({ id }: { id: string }) => 
      updateStep.mutateAsync({ id, data: { status: "in_progress" } }),
  })
}

/**
 * Helper hook to assign a step to a user
 */
export function useAssignWorkflowStep() {
  const updateStep = useUpdateWorkflowStep()
  
  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) => 
      updateStep.mutateAsync({ id, data: { assigneeId } }),
  })
}

