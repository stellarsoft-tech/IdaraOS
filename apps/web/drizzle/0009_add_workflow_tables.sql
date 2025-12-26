-- Migration: Add Workflow Tables
-- Creates the workflow template and instance tables for the workflow engine

-- ============================================================================
-- WORKFLOW TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "module_scope" text,
  "trigger_type" text,
  "status" text NOT NULL DEFAULT 'draft',
  "is_active" boolean NOT NULL DEFAULT true,
  "default_owner_id" uuid REFERENCES "people_persons"("id") ON DELETE SET NULL,
  "default_due_days" integer,
  "settings" jsonb,
  "created_by_id" uuid REFERENCES "core_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflow_templates_org" ON "workflow_templates"("org_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_templates_module" ON "workflow_templates"("module_scope");
CREATE INDEX IF NOT EXISTS "idx_workflow_templates_status" ON "workflow_templates"("status");
CREATE INDEX IF NOT EXISTS "idx_workflow_templates_trigger" ON "workflow_templates"("trigger_type");

-- ============================================================================
-- WORKFLOW TEMPLATE STEPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "workflow_template_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE CASCADE,
  "parent_step_id" uuid REFERENCES "workflow_template_steps"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "step_type" text NOT NULL DEFAULT 'task',
  "order_index" integer NOT NULL DEFAULT 0,
  "position_x" real NOT NULL DEFAULT 0,
  "position_y" real NOT NULL DEFAULT 0,
  "assignee_type" text NOT NULL DEFAULT 'unassigned',
  "assignee_config" jsonb,
  "default_assignee_id" uuid REFERENCES "people_persons"("id") ON DELETE SET NULL,
  "due_offset_days" integer,
  "due_offset_from" text DEFAULT 'workflow_start',
  "is_required" boolean NOT NULL DEFAULT true,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflow_template_steps_template" ON "workflow_template_steps"("template_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_template_steps_parent" ON "workflow_template_steps"("parent_step_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_template_steps_order" ON "workflow_template_steps"("template_id", "order_index");

-- ============================================================================
-- WORKFLOW TEMPLATE EDGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "workflow_template_edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE CASCADE,
  "source_step_id" uuid NOT NULL REFERENCES "workflow_template_steps"("id") ON DELETE CASCADE,
  "target_step_id" uuid NOT NULL REFERENCES "workflow_template_steps"("id") ON DELETE CASCADE,
  "condition_type" text NOT NULL DEFAULT 'always',
  "condition_config" jsonb,
  "label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflow_template_edges_template" ON "workflow_template_edges"("template_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_template_edges_source" ON "workflow_template_edges"("source_step_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_template_edges_target" ON "workflow_template_edges"("target_step_id");

-- ============================================================================
-- WORKFLOW INSTANCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "workflow_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE RESTRICT,
  "org_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "owner_id" uuid REFERENCES "people_persons"("id") ON DELETE SET NULL,
  "started_at" timestamp with time zone,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "total_steps" integer NOT NULL DEFAULT 0,
  "completed_steps" integer NOT NULL DEFAULT 0,
  "started_by_id" uuid REFERENCES "core_users"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflow_instances_org" ON "workflow_instances"("org_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_template" ON "workflow_instances"("template_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_entity" ON "workflow_instances"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_status" ON "workflow_instances"("status");
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_due" ON "workflow_instances"("due_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_owner" ON "workflow_instances"("owner_id");

-- ============================================================================
-- WORKFLOW INSTANCE STEPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "workflow_instance_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "instance_id" uuid NOT NULL REFERENCES "workflow_instances"("id") ON DELETE CASCADE,
  "template_step_id" uuid NOT NULL REFERENCES "workflow_template_steps"("id") ON DELETE RESTRICT,
  "parent_step_id" uuid REFERENCES "workflow_instance_steps"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "order_index" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "assignee_id" uuid REFERENCES "core_users"("id") ON DELETE SET NULL,
  "assigned_person_id" uuid REFERENCES "people_persons"("id") ON DELETE SET NULL,
  "due_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "completed_by_id" uuid REFERENCES "core_users"("id") ON DELETE SET NULL,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflow_instance_steps_instance" ON "workflow_instance_steps"("instance_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_steps_template_step" ON "workflow_instance_steps"("template_step_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_steps_parent" ON "workflow_instance_steps"("parent_step_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_steps_status" ON "workflow_instance_steps"("status");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_steps_assignee" ON "workflow_instance_steps"("assignee_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_steps_assigned_person" ON "workflow_instance_steps"("assigned_person_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_steps_due" ON "workflow_instance_steps"("due_at");

-- ============================================================================
-- ADD WORKFLOW RBAC MODULES
-- ============================================================================

-- Insert workflow modules (if they don't already exist)
-- Note: rbac_modules table has created_at but NOT updated_at per schema
INSERT INTO rbac_modules (id, slug, name, description, category, icon, sort_order, created_at)
VALUES 
  (gen_random_uuid(), 'workflows.overview', 'Workflows Overview', 'View workflows dashboard', 'Workflows', 'Workflow', '400', NOW()),
  (gen_random_uuid(), 'workflows.templates', 'Workflow Templates', 'Manage workflow templates', 'Workflows', 'FileCode2', '401', NOW()),
  (gen_random_uuid(), 'workflows.instances', 'Workflow Instances', 'View and manage running workflows', 'Workflows', 'Play', '402', NOW()),
  (gen_random_uuid(), 'workflows.tasks', 'Workflow Tasks', 'View and complete assigned tasks', 'Workflows', 'CheckSquare', '403', NOW()),
  (gen_random_uuid(), 'workflows.board', 'Workflow Board', 'Kanban board view of workflows', 'Workflows', 'Kanban', '404', NOW()),
  (gen_random_uuid(), 'workflows.settings', 'Workflow Settings', 'Configure workflow module settings', 'Workflows', 'Settings', '405', NOW())
ON CONFLICT (slug) DO NOTHING;

-- Create permissions for all workflow modules (module × action combinations)
-- Note: rbac_permissions table has created_at but NOT updated_at per schema
INSERT INTO rbac_permissions (id, module_id, action_id, created_at)
SELECT 
  gen_random_uuid(),
  m.id,
  a.id,
  NOW()
FROM rbac_modules m
CROSS JOIN rbac_actions a
WHERE m.slug LIKE 'workflows.%'
  AND NOT EXISTS (
    SELECT 1 FROM rbac_permissions p 
    WHERE p.module_id = m.id AND p.action_id = a.id
  );

-- Grant all workflow permissions to Owner role for all organizations
-- Note: rbac_role_permissions has composite primary key (role_id, permission_id), no id column
INSERT INTO rbac_role_permissions (role_id, permission_id, created_at)
SELECT 
  r.id,
  p.id,
  NOW()
FROM rbac_roles r
JOIN rbac_permissions p ON true
JOIN rbac_modules m ON p.module_id = m.id
WHERE r.slug = 'owner'
  AND m.slug LIKE 'workflows.%'
  AND NOT EXISTS (
    SELECT 1 FROM rbac_role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Grant all workflow permissions to Admin role for all organizations
INSERT INTO rbac_role_permissions (role_id, permission_id, created_at)
SELECT 
  r.id,
  p.id,
  NOW()
FROM rbac_roles r
JOIN rbac_permissions p ON true
JOIN rbac_modules m ON p.module_id = m.id
WHERE r.slug = 'admin'
  AND m.slug LIKE 'workflows.%'
  AND NOT EXISTS (
    SELECT 1 FROM rbac_role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

