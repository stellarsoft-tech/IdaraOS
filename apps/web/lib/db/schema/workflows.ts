/**
 * Workflows Schema - Drizzle ORM table definitions
 * Implements the Template/Instance pattern for reusable workflows
 */

import { pgTable, uuid, text, timestamp, index, boolean, integer, real, jsonb, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { persons } from "./people"
import { users } from "./users"
import { fileCategories } from "./storage"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Workflow template status - whether template is available for use
 */
export const workflowTemplateStatusValues = ["draft", "active", "archived"] as const
export type WorkflowTemplateStatus = (typeof workflowTemplateStatusValues)[number]

/**
 * Step types - determines behavior and rendering
 */
export const workflowStepTypeValues = ["task", "notification", "gateway", "group"] as const
export type WorkflowStepType = (typeof workflowStepTypeValues)[number]

/**
 * Edge condition types - determines when edges are followed
 */
export const workflowEdgeConditionValues = ["always", "if_approved", "if_rejected", "conditional"] as const
export type WorkflowEdgeCondition = (typeof workflowEdgeConditionValues)[number]

/**
 * Workflow instance status - current state of a running workflow
 */
export const workflowInstanceStatusValues = ["pending", "in_progress", "completed", "cancelled", "on_hold"] as const
export type WorkflowInstanceStatus = (typeof workflowInstanceStatusValues)[number]

/**
 * Instance step status - current state of a step within an instance
 */
export const workflowInstanceStepStatusValues = ["pending", "in_progress", "completed", "skipped", "blocked"] as const
export type WorkflowInstanceStepStatus = (typeof workflowInstanceStepStatusValues)[number]

/**
 * Assignee types - how the assignee is determined
 */
export const workflowAssigneeTypeValues = ["specific_user", "role", "dynamic_manager", "dynamic_creator", "unassigned"] as const
export type WorkflowAssigneeType = (typeof workflowAssigneeTypeValues)[number]

// ============================================================================
// WORKFLOW TEMPLATES
// ============================================================================

/**
 * Workflow Templates - Reusable workflow definitions
 * Created by admins, used as blueprints for workflow instances
 */
export const workflowTemplates = pgTable(
  "workflow_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    
    // Basic info
    name: text("name").notNull(),
    description: text("description"),
    
    // Categorization
    moduleScope: text("module_scope"), // e.g., "people", "assets", null for global
    triggerType: text("trigger_type"), // e.g., "onboarding", "offboarding", "manual"
    
    // Template settings
    status: text("status", { enum: workflowTemplateStatusValues }).notNull().default("draft"),
    isActive: boolean("is_active").notNull().default(true),
    
    // Default owner - person from directory who owns instances created from this template
    defaultOwnerId: uuid("default_owner_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Default settings for instances
    defaultDueDays: integer("default_due_days"), // Days from start to complete entire workflow
    
    // JSON settings for additional configuration
    settings: jsonb("settings").$type<{
      allowSkipSteps?: boolean
      requireApproval?: boolean
      notifyOnComplete?: boolean
      [key: string]: unknown
    }>(),
    
    // Audit fields
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workflow_templates_org").on(table.orgId),
    index("idx_workflow_templates_module").on(table.moduleScope),
    index("idx_workflow_templates_status").on(table.status),
    index("idx_workflow_templates_trigger").on(table.triggerType),
  ]
)

// ============================================================================
// WORKFLOW TEMPLATE STEPS
// ============================================================================

/**
 * Workflow Template Steps - Nodes in the workflow graph
 * Supports N-level hierarchy via parent_step_id
 */
export const workflowTemplateSteps = pgTable(
  "workflow_template_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => workflowTemplates.id, { onDelete: "cascade" }),
    
    // Hierarchy - null means root level step
    parentStepId: uuid("parent_step_id").references((): AnyPgColumn => workflowTemplateSteps.id, { onDelete: "cascade" }),
    
    // Basic info
    name: text("name").notNull(),
    description: text("description"),
    
    // Step configuration
    stepType: text("step_type", { enum: workflowStepTypeValues }).notNull().default("task"),
    orderIndex: integer("order_index").notNull().default(0), // Order within parent/root
    
    // Visual designer position
    positionX: real("position_x").notNull().default(0),
    positionY: real("position_y").notNull().default(0),
    
    // Assignee configuration
    assigneeType: text("assignee_type", { enum: workflowAssigneeTypeValues }).notNull().default("unassigned"),
    assigneeConfig: jsonb("assignee_config").$type<{
      userId?: string
      roleId?: string
      roleName?: string
      [key: string]: unknown
    }>(),
    // Default assignee - a specific person from the directory
    defaultAssigneeId: uuid("default_assignee_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Due date configuration
    dueOffsetDays: integer("due_offset_days"), // Days from workflow start or previous step
    dueOffsetFrom: text("due_offset_from").default("workflow_start"), // "workflow_start" or "previous_step"
    
    // Step flags
    isRequired: boolean("is_required").notNull().default(true),
    
    // Attachment configuration
    attachmentsEnabled: boolean("attachments_enabled").notNull().default(true),
    fileCategoryId: uuid("file_category_id").references(() => fileCategories.id, { onDelete: "set null" }),
    filePathPrefix: text("file_path_prefix"), // Optional subfolder path template (e.g., "{instanceName}/documents")
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      icon?: string
      color?: string
      instructions?: string
      attachmentRequired?: boolean
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workflow_template_steps_template").on(table.templateId),
    index("idx_workflow_template_steps_parent").on(table.parentStepId),
    index("idx_workflow_template_steps_order").on(table.templateId, table.orderIndex),
  ]
)

// ============================================================================
// WORKFLOW TEMPLATE EDGES
// ============================================================================

/**
 * Workflow Template Edges - Connections between steps
 * Defines flow/dependencies in the workflow graph
 */
export const workflowTemplateEdges = pgTable(
  "workflow_template_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => workflowTemplates.id, { onDelete: "cascade" }),
    
    // Edge connection
    sourceStepId: uuid("source_step_id").notNull().references(() => workflowTemplateSteps.id, { onDelete: "cascade" }),
    targetStepId: uuid("target_step_id").notNull().references(() => workflowTemplateSteps.id, { onDelete: "cascade" }),
    
    // Edge configuration
    conditionType: text("condition_type", { enum: workflowEdgeConditionValues }).notNull().default("always"),
    conditionConfig: jsonb("condition_config").$type<{
      expression?: string
      field?: string
      operator?: string
      value?: unknown
      [key: string]: unknown
    }>(),
    
    // Visual properties
    label: text("label"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workflow_template_edges_template").on(table.templateId),
    index("idx_workflow_template_edges_source").on(table.sourceStepId),
    index("idx_workflow_template_edges_target").on(table.targetStepId),
  ]
)

// ============================================================================
// WORKFLOW INSTANCES
// ============================================================================

/**
 * Workflow Instances - Running workflows assigned to entities
 * Created when a template is instantiated for a specific entity (e.g., person)
 */
export const workflowInstances = pgTable(
  "workflow_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => workflowTemplates.id, { onDelete: "restrict" }),
    orgId: uuid("org_id").notNull(),
    
    // What this workflow is for
    entityType: text("entity_type").notNull(), // e.g., "person", "asset"
    entityId: uuid("entity_id").notNull(), // ID of the person, asset, etc.
    
    // Instance name (can be customized from template name)
    name: text("name").notNull(),
    
    // Status tracking
    status: text("status", { enum: workflowInstanceStatusValues }).notNull().default("pending"),
    
    // Owner - person responsible for this workflow instance (can be overridden from template default)
    ownerId: uuid("owner_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Timing
    startedAt: timestamp("started_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    
    // Progress tracking (cached for performance)
    totalSteps: integer("total_steps").notNull().default(0),
    completedSteps: integer("completed_steps").notNull().default(0),
    
    // Who started/created this instance
    startedById: uuid("started_by_id").references(() => users.id, { onDelete: "set null" }),
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      notes?: string
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workflow_instances_org").on(table.orgId),
    index("idx_workflow_instances_template").on(table.templateId),
    index("idx_workflow_instances_entity").on(table.entityType, table.entityId),
    index("idx_workflow_instances_status").on(table.status),
    index("idx_workflow_instances_due").on(table.dueAt),
    index("idx_workflow_instances_owner").on(table.ownerId),
  ]
)

// ============================================================================
// WORKFLOW INSTANCE STEPS
// ============================================================================

/**
 * Workflow Instance Steps - Actual tasks to complete
 * Created from template steps when instance is created
 */
export const workflowInstanceSteps = pgTable(
  "workflow_instance_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
    templateStepId: uuid("template_step_id").references(() => workflowTemplateSteps.id, { onDelete: "set null" }),
    
    // Hierarchy (copied from template)
    parentStepId: uuid("parent_step_id").references((): AnyPgColumn => workflowInstanceSteps.id, { onDelete: "cascade" }),
    
    // Step info (can be overridden from template)
    name: text("name").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    
    // Status tracking
    status: text("status", { enum: workflowInstanceStepStatusValues }).notNull().default("pending"),
    
    // Assignment - can be either a user (for system users) or a person (from directory)
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    assignedPersonId: uuid("assigned_person_id").references(() => persons.id, { onDelete: "set null" }),
    
    // Timing
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    
    // Completion tracking
    completedById: uuid("completed_by_id").references(() => users.id, { onDelete: "set null" }),
    
    // Notes and attachments
    notes: text("notes"),
    
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      attachments?: string[]
      [key: string]: unknown
    }>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workflow_instance_steps_instance").on(table.instanceId),
    index("idx_workflow_instance_steps_template_step").on(table.templateStepId),
    index("idx_workflow_instance_steps_parent").on(table.parentStepId),
    index("idx_workflow_instance_steps_status").on(table.status),
    index("idx_workflow_instance_steps_assignee").on(table.assigneeId),
    index("idx_workflow_instance_steps_assigned_person").on(table.assignedPersonId),
    index("idx_workflow_instance_steps_due").on(table.dueAt),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const workflowTemplatesRelations = relations(workflowTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [workflowTemplates.createdById],
    references: [users.id],
  }),
  defaultOwner: one(persons, {
    fields: [workflowTemplates.defaultOwnerId],
    references: [persons.id],
    relationName: "templateDefaultOwner",
  }),
  steps: many(workflowTemplateSteps),
  edges: many(workflowTemplateEdges),
  instances: many(workflowInstances),
}))

export const workflowTemplateStepsRelations = relations(workflowTemplateSteps, ({ one, many }) => ({
  template: one(workflowTemplates, {
    fields: [workflowTemplateSteps.templateId],
    references: [workflowTemplates.id],
  }),
  parentStep: one(workflowTemplateSteps, {
    fields: [workflowTemplateSteps.parentStepId],
    references: [workflowTemplateSteps.id],
    relationName: "parentStep",
  }),
  childSteps: many(workflowTemplateSteps, {
    relationName: "parentStep",
  }),
  outgoingEdges: many(workflowTemplateEdges, {
    relationName: "sourceStep",
  }),
  incomingEdges: many(workflowTemplateEdges, {
    relationName: "targetStep",
  }),
  defaultAssignee: one(persons, {
    fields: [workflowTemplateSteps.defaultAssigneeId],
    references: [persons.id],
    relationName: "stepDefaultAssignee",
  }),
  fileCategory: one(fileCategories, {
    fields: [workflowTemplateSteps.fileCategoryId],
    references: [fileCategories.id],
    relationName: "stepFileCategory",
  }),
  instanceSteps: many(workflowInstanceSteps),
}))

export const workflowTemplateEdgesRelations = relations(workflowTemplateEdges, ({ one }) => ({
  template: one(workflowTemplates, {
    fields: [workflowTemplateEdges.templateId],
    references: [workflowTemplates.id],
  }),
  sourceStep: one(workflowTemplateSteps, {
    fields: [workflowTemplateEdges.sourceStepId],
    references: [workflowTemplateSteps.id],
    relationName: "sourceStep",
  }),
  targetStep: one(workflowTemplateSteps, {
    fields: [workflowTemplateEdges.targetStepId],
    references: [workflowTemplateSteps.id],
    relationName: "targetStep",
  }),
}))

export const workflowInstancesRelations = relations(workflowInstances, ({ one, many }) => ({
  template: one(workflowTemplates, {
    fields: [workflowInstances.templateId],
    references: [workflowTemplates.id],
  }),
  startedBy: one(users, {
    fields: [workflowInstances.startedById],
    references: [users.id],
  }),
  owner: one(persons, {
    fields: [workflowInstances.ownerId],
    references: [persons.id],
    relationName: "instanceOwner",
  }),
  steps: many(workflowInstanceSteps),
}))

export const workflowInstanceStepsRelations = relations(workflowInstanceSteps, ({ one, many }) => ({
  instance: one(workflowInstances, {
    fields: [workflowInstanceSteps.instanceId],
    references: [workflowInstances.id],
  }),
  templateStep: one(workflowTemplateSteps, {
    fields: [workflowInstanceSteps.templateStepId],
    references: [workflowTemplateSteps.id],
  }),
  parentStep: one(workflowInstanceSteps, {
    fields: [workflowInstanceSteps.parentStepId],
    references: [workflowInstanceSteps.id],
    relationName: "parentInstanceStep",
  }),
  childSteps: many(workflowInstanceSteps, {
    relationName: "parentInstanceStep",
  }),
  assignee: one(users, {
    fields: [workflowInstanceSteps.assigneeId],
    references: [users.id],
    relationName: "stepAssignee",
  }),
  assignedPerson: one(persons, {
    fields: [workflowInstanceSteps.assignedPersonId],
    references: [persons.id],
    relationName: "stepAssignedPerson",
  }),
  completedBy: one(users, {
    fields: [workflowInstanceSteps.completedById],
    references: [users.id],
    relationName: "stepCompletedBy",
  }),
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect
export type NewWorkflowTemplate = typeof workflowTemplates.$inferInsert

export type WorkflowTemplateStep = typeof workflowTemplateSteps.$inferSelect
export type NewWorkflowTemplateStep = typeof workflowTemplateSteps.$inferInsert

export type WorkflowTemplateEdge = typeof workflowTemplateEdges.$inferSelect
export type NewWorkflowTemplateEdge = typeof workflowTemplateEdges.$inferInsert

export type WorkflowInstance = typeof workflowInstances.$inferSelect
export type NewWorkflowInstance = typeof workflowInstances.$inferInsert

export type WorkflowInstanceStep = typeof workflowInstanceSteps.$inferSelect
export type NewWorkflowInstanceStep = typeof workflowInstanceSteps.$inferInsert

