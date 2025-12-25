CREATE TABLE "assets_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"auto_generate_tags" boolean DEFAULT true NOT NULL,
	"tag_prefix" text DEFAULT 'AST',
	"tag_sequence" text DEFAULT '0',
	"default_status" text DEFAULT 'available',
	"sync_settings" jsonb DEFAULT '{}'::jsonb,
	"last_sync_at" timestamp with time zone,
	"synced_asset_count" text DEFAULT '0',
	"last_sync_error" text,
	"last_sync_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "assets_asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone,
	"assigned_by_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"icon" text DEFAULT 'Box',
	"color" text DEFAULT 'gray',
	"default_depreciation_years" numeric(4, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_date" timestamp with time zone DEFAULT now() NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"performed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets_maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"description" text,
	"scheduled_date" date,
	"completed_date" date,
	"cost" numeric(12, 2),
	"vendor" text,
	"performed_by_id" uuid,
	"assigned_to_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"asset_tag" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"status" text DEFAULT 'available' NOT NULL,
	"serial_number" text,
	"manufacturer" text,
	"model" text,
	"purchase_date" date,
	"purchase_cost" numeric(12, 2),
	"warranty_end" date,
	"location" text,
	"assigned_to_id" uuid,
	"assigned_at" timestamp with time zone,
	"source" text DEFAULT 'manual' NOT NULL,
	"intune_device_id" text,
	"intune_compliance_state" text,
	"intune_enrollment_type" text,
	"intune_last_sync_at" timestamp with time zone,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"notes" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"entity_name" text,
	"actor_id" uuid,
	"actor_email" text NOT NULL,
	"actor_name" text,
	"actor_ip" text,
	"actor_user_agent" text,
	"previous_values" jsonb,
	"new_values" jsonb,
	"changed_fields" text[],
	"metadata" jsonb,
	"description" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instance_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"template_step_id" uuid NOT NULL,
	"parent_step_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assignee_id" uuid,
	"due_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_id" uuid,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"completed_steps" integer DEFAULT 0 NOT NULL,
	"started_by_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_template_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"source_step_id" uuid NOT NULL,
	"target_step_id" uuid NOT NULL,
	"condition_type" text DEFAULT 'always' NOT NULL,
	"condition_config" jsonb,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_template_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"parent_step_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"step_type" text DEFAULT 'task' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"position_x" real DEFAULT 0 NOT NULL,
	"position_y" real DEFAULT 0 NOT NULL,
	"assignee_type" text DEFAULT 'unassigned' NOT NULL,
	"assignee_config" jsonb,
	"due_offset_days" integer,
	"due_offset_from" text DEFAULT 'workflow_start',
	"is_required" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"module_scope" text,
	"trigger_type" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"default_due_days" integer,
	"settings" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "entra_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "hire_date" date;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "last_sign_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "last_password_change_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core_integrations" ADD COLUMN "sync_devices_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_integrations" ADD COLUMN "delete_assets_on_device_delete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_integrations" ADD COLUMN "last_device_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core_integrations" ADD COLUMN "synced_device_count" text DEFAULT '0';--> statement-breakpoint
ALTER TABLE "assets_settings" ADD CONSTRAINT "assets_settings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_asset_tags" ADD CONSTRAINT "assets_asset_tags_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_asset_tags" ADD CONSTRAINT "assets_asset_tags_tag_id_assets_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."assets_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_person_id_people_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people_persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_assigned_by_id_core_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_categories" ADD CONSTRAINT "assets_categories_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_categories" ADD CONSTRAINT "assets_categories_parent_id_assets_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assets_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_performed_by_id_core_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_performed_by_id_core_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_assigned_to_id_people_persons_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_tags" ADD CONSTRAINT "assets_tags_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_category_id_assets_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."assets_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_assigned_to_id_people_persons_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_core_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_template_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("template_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_parent_step_id_workflow_instance_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."workflow_instance_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_assignee_id_core_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_completed_by_id_core_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_started_by_id_core_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_edges" ADD CONSTRAINT "workflow_template_edges_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_edges" ADD CONSTRAINT "workflow_template_edges_source_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_edges" ADD CONSTRAINT "workflow_template_edges_target_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("target_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_parent_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assets_asset_tags_asset" ON "assets_asset_tags" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_assets_asset_tags_tag" ON "assets_asset_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_assets_assignments_asset" ON "assets_assignments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_assets_assignments_person" ON "assets_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_assets_assignments_returned" ON "assets_assignments" USING btree ("returned_at");--> statement-breakpoint
CREATE INDEX "idx_assets_categories_org" ON "assets_categories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_assets_categories_parent" ON "assets_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_assets_categories_slug" ON "assets_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_org" ON "assets_lifecycle_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_asset" ON "assets_lifecycle_events" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_type" ON "assets_lifecycle_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_date" ON "assets_lifecycle_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_org" ON "assets_maintenance_records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_asset" ON "assets_maintenance_records" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_status" ON "assets_maintenance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_type" ON "assets_maintenance_records" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_assigned" ON "assets_maintenance_records" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "idx_assets_tags_org" ON "assets_tags" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_assets_assets_org" ON "assets_assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_assets_assets_category" ON "assets_assets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_assets_assets_status" ON "assets_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assets_assets_tag" ON "assets_assets" USING btree ("asset_tag");--> statement-breakpoint
CREATE INDEX "idx_assets_assets_assigned_to" ON "assets_assets" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "idx_assets_assets_source" ON "assets_assets" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_assets_assets_intune_id" ON "assets_assets" USING btree ("intune_device_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_module" ON "audit_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity_type" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity_id" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_module_timestamp" ON "audit_logs" USING btree ("org_id","module","timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_entity" ON "audit_logs" USING btree ("org_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_instance" ON "workflow_instance_steps" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_template_step" ON "workflow_instance_steps" USING btree ("template_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_parent" ON "workflow_instance_steps" USING btree ("parent_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_status" ON "workflow_instance_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_assignee" ON "workflow_instance_steps" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_due" ON "workflow_instance_steps" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_org" ON "workflow_instances" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_template" ON "workflow_instances" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_entity" ON "workflow_instances" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_status" ON "workflow_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_due" ON "workflow_instances" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_edges_template" ON "workflow_template_edges" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_edges_source" ON "workflow_template_edges" USING btree ("source_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_edges_target" ON "workflow_template_edges" USING btree ("target_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_steps_template" ON "workflow_template_steps" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_steps_parent" ON "workflow_template_steps" USING btree ("parent_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_steps_order" ON "workflow_template_steps" USING btree ("template_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_org" ON "workflow_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_module" ON "workflow_templates" USING btree ("module_scope");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_status" ON "workflow_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_trigger" ON "workflow_templates" USING btree ("trigger_type");