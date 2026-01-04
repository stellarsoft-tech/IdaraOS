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
CREATE TABLE "docs_document_acknowledgments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"rollout_id" uuid,
	"user_id" uuid NOT NULL,
	"person_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"version_acknowledged" text,
	"viewed_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"signature_data" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs_document_rollouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"name" text,
	"version_at_rollout" text,
	"content_snapshot" text,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"requirement" text DEFAULT 'optional' NOT NULL,
	"due_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"send_notification" boolean DEFAULT true NOT NULL,
	"reminder_frequency_days" integer,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"default_review_frequency_days" integer DEFAULT 365,
	"default_requirement" text DEFAULT 'optional',
	"enable_email_notifications" boolean DEFAULT true NOT NULL,
	"reminder_days_before" integer DEFAULT 7,
	"header_logo_url" text,
	"footer_text" text,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "docs_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "docs_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" text NOT NULL,
	"change_description" text,
	"change_summary" text,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"content_snapshot" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"tags" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_version" text DEFAULT '1.0' NOT NULL,
	"owner_id" uuid,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" date,
	"review_frequency_days" integer,
	"show_header" boolean DEFAULT true NOT NULL,
	"show_footer" boolean DEFAULT true NOT NULL,
	"show_version_history" boolean DEFAULT true NOT NULL,
	"linked_control_ids" jsonb,
	"linked_framework_codes" jsonb,
	"metadata" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rbac_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" text DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_actions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rbac_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"icon" text,
	"sort_order" text DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_modules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rbac_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_permission_module_action" UNIQUE("module_id","action_id")
);
--> statement-breakpoint
CREATE TABLE "rbac_role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "rbac_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_role_org_slug" UNIQUE("org_id","slug")
);
--> statement-breakpoint
CREATE TABLE "rbac_user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"scim_group_id" uuid,
	CONSTRAINT "rbac_user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "core_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"logo" text,
	"app_name" text DEFAULT 'IdaraOS' NOT NULL,
	"tagline" text DEFAULT 'Company OS',
	"linked_in" text,
	"twitter" text,
	"youtube" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"date_format" text DEFAULT 'YYYY-MM-DD' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "core_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"person_id" uuid,
	"entra_id" text,
	"scim_provisioned" boolean DEFAULT false NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"avatar" text,
	"role" text DEFAULT 'User' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"last_login_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "people_persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role_id" uuid,
	"team_id" uuid,
	"manager_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"phone" text,
	"location" text,
	"avatar" text,
	"bio" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"entra_id" text,
	"entra_group_id" text,
	"entra_group_name" text,
	"last_synced_at" timestamp with time zone,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"entra_created_at" timestamp with time zone,
	"hire_date" date,
	"last_sign_in_at" timestamp with time zone,
	"last_password_change_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_persons_slug_unique" UNIQUE("slug"),
	CONSTRAINT "people_persons_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "core_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"tenant_id" text,
	"client_id" text,
	"client_secret_encrypted" text,
	"scim_enabled" boolean DEFAULT false NOT NULL,
	"scim_endpoint" text,
	"scim_token_encrypted" text,
	"scim_group_prefix" text,
	"scim_bidirectional_sync" boolean DEFAULT false NOT NULL,
	"sync_people_enabled" boolean DEFAULT false NOT NULL,
	"delete_people_on_user_delete" boolean DEFAULT true NOT NULL,
	"sync_devices_enabled" boolean DEFAULT false NOT NULL,
	"delete_assets_on_device_delete" boolean DEFAULT false NOT NULL,
	"last_device_sync_at" timestamp with time zone,
	"synced_device_count" text DEFAULT '0',
	"sso_enabled" boolean DEFAULT false NOT NULL,
	"password_auth_disabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"synced_user_count" text DEFAULT '0',
	"synced_group_count" text DEFAULT '0',
	"settings" jsonb DEFAULT '{}'::jsonb,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scim_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_id" text,
	"display_name" text NOT NULL,
	"mapped_role_id" uuid,
	"member_count" text DEFAULT '0',
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_scim_groups" (
	"user_id" uuid NOT NULL,
	"scim_group_id" uuid NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_scim_groups_user_id_scim_group_id_pk" PRIMARY KEY("user_id","scim_group_id")
);
--> statement-breakpoint
CREATE TABLE "people_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sync_mode" text DEFAULT 'linked' NOT NULL,
	"people_group_pattern" text,
	"property_mapping" jsonb,
	"auto_delete_on_removal" boolean DEFAULT false NOT NULL,
	"default_status" text DEFAULT 'active' NOT NULL,
	"scim_enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"synced_people_count" text DEFAULT '0',
	"last_sync_error" text,
	"last_sync_error_at" timestamp with time zone,
	"auto_onboarding_workflow" boolean DEFAULT false NOT NULL,
	"default_onboarding_workflow_template_id" uuid,
	"auto_offboarding_workflow" boolean DEFAULT false NOT NULL,
	"default_offboarding_workflow_template_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_instance_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"template_step_id" uuid,
	"parent_step_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assignee_id" uuid,
	"assigned_person_id" uuid,
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
	"owner_id" uuid,
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
	"default_assignee_id" uuid,
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
	"default_owner_id" uuid,
	"default_due_days" integer,
	"settings" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"lead_id" uuid,
	"parent_team_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_organizational_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_organizational_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"team_id" uuid NOT NULL,
	"parent_role_id" uuid,
	"level_id" uuid,
	"level" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"control_id" uuid,
	"finding_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'minor' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"evidence" text,
	"recommendation" text,
	"responsible_person_id" uuid,
	"due_date" date,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"framework_id" uuid,
	"audit_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'internal' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"start_date" date,
	"end_date" date,
	"scope" text,
	"objectives" text,
	"lead_auditor" text,
	"audit_team" jsonb,
	"audit_body" text,
	"summary" text,
	"conclusion" text,
	"findings_count" integer DEFAULT 0,
	"major_findings_count" integer DEFAULT 0,
	"minor_findings_count" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_clause_compliance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"framework_id" uuid NOT NULL,
	"standard_clause_id" uuid NOT NULL,
	"compliance_status" text DEFAULT 'not_addressed' NOT NULL,
	"owner_id" uuid,
	"target_date" date,
	"implementation_notes" text,
	"evidence_description" text,
	"linked_evidence_ids" jsonb,
	"linked_document_ids" jsonb,
	"last_reviewed_at" timestamp with time zone,
	"last_reviewed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_control_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"standard_control_id" uuid NOT NULL,
	"coverage_level" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"control_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"implementation_status" text DEFAULT 'not_implemented' NOT NULL,
	"implementation_notes" text,
	"implemented_at" timestamp with time zone,
	"last_tested_at" date,
	"next_review_at" date,
	"review_frequency_days" integer,
	"control_type" text,
	"category" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'document' NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"file_url" text,
	"file_name" text,
	"file_size" integer,
	"mime_type" text,
	"external_url" text,
	"external_system" text,
	"collected_at" date NOT NULL,
	"valid_until" date,
	"collected_by_id" uuid,
	"tags" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"description" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"certified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"certification_body" text,
	"certificate_number" text,
	"scope" text,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"objective_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"owner_id" uuid,
	"target_date" date,
	"completed_at" timestamp with time zone,
	"progress" integer DEFAULT 0,
	"kpis" jsonb,
	"success_criteria" text,
	"linked_risk_ids" jsonb,
	"linked_control_ids" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_risk_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"effectiveness" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"risk_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'operational' NOT NULL,
	"owner_id" uuid,
	"inherent_likelihood" text DEFAULT 'medium' NOT NULL,
	"inherent_impact" text DEFAULT 'moderate' NOT NULL,
	"inherent_level" text DEFAULT 'medium' NOT NULL,
	"residual_likelihood" text,
	"residual_impact" text,
	"residual_level" text,
	"status" text DEFAULT 'identified' NOT NULL,
	"treatment" text,
	"treatment_plan" text,
	"treatment_due_date" date,
	"affected_assets" text,
	"last_reviewed_at" date,
	"next_review_at" date,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_soa_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"standard_control_id" uuid NOT NULL,
	"control_id" uuid,
	"applicability" text DEFAULT 'applicable' NOT NULL,
	"justification" text,
	"implementation_status" text DEFAULT 'not_implemented' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_standard_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_code" text NOT NULL,
	"clause_id" text NOT NULL,
	"parent_clause_id" text,
	"title" text NOT NULL,
	"description" text,
	"guidance" text,
	"evidence_examples" text,
	"category" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_standard_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_code" text NOT NULL,
	"control_id" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"title" text NOT NULL,
	"description" text,
	"guidance" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"control_type" text,
	"security_properties" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "docs_document_acknowledgments" ADD CONSTRAINT "docs_document_acknowledgments_document_id_docs_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."docs_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_acknowledgments" ADD CONSTRAINT "docs_document_acknowledgments_rollout_id_docs_document_rollouts_id_fk" FOREIGN KEY ("rollout_id") REFERENCES "public"."docs_document_rollouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_acknowledgments" ADD CONSTRAINT "docs_document_acknowledgments_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_acknowledgments" ADD CONSTRAINT "docs_document_acknowledgments_person_id_people_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_rollouts" ADD CONSTRAINT "docs_document_rollouts_document_id_docs_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."docs_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_rollouts" ADD CONSTRAINT "docs_document_rollouts_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_settings" ADD CONSTRAINT "docs_settings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_versions" ADD CONSTRAINT "docs_document_versions_document_id_docs_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."docs_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_versions" ADD CONSTRAINT "docs_document_versions_approved_by_id_people_persons_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_document_versions" ADD CONSTRAINT "docs_document_versions_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_owner_id_people_persons_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_permissions" ADD CONSTRAINT "rbac_permissions_module_id_rbac_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."rbac_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_permissions" ADD CONSTRAINT "rbac_permissions_action_id_rbac_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."rbac_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permissions" ADD CONSTRAINT "rbac_role_permissions_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permissions" ADD CONSTRAINT "rbac_role_permissions_permission_id_rbac_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."rbac_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_roles" ADD CONSTRAINT "rbac_roles_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "rbac_user_roles_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "rbac_user_roles_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "rbac_user_roles_assigned_by_core_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_person_id_people_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_persons" ADD CONSTRAINT "people_persons_role_id_people_organizational_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."people_organizational_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_persons" ADD CONSTRAINT "people_persons_team_id_people_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."people_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_persons" ADD CONSTRAINT "people_persons_manager_id_people_persons_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_integrations" ADD CONSTRAINT "core_integrations_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_groups" ADD CONSTRAINT "scim_groups_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_groups" ADD CONSTRAINT "scim_groups_mapped_role_id_rbac_roles_id_fk" FOREIGN KEY ("mapped_role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scim_groups" ADD CONSTRAINT "user_scim_groups_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scim_groups" ADD CONSTRAINT "user_scim_groups_scim_group_id_scim_groups_id_fk" FOREIGN KEY ("scim_group_id") REFERENCES "public"."scim_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_settings" ADD CONSTRAINT "people_settings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_template_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("template_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_parent_step_id_workflow_instance_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."workflow_instance_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_assignee_id_core_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_assigned_person_id_people_persons_id_fk" FOREIGN KEY ("assigned_person_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_completed_by_id_core_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_owner_id_people_persons_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_started_by_id_core_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_edges" ADD CONSTRAINT "workflow_template_edges_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_edges" ADD CONSTRAINT "workflow_template_edges_source_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_edges" ADD CONSTRAINT "workflow_template_edges_target_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("target_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_parent_step_id_workflow_template_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."workflow_template_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_default_assignee_id_people_persons_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_default_owner_id_people_persons_id_fk" FOREIGN KEY ("default_owner_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_teams" ADD CONSTRAINT "people_teams_parent_team_id_people_teams_id_fk" FOREIGN KEY ("parent_team_id") REFERENCES "public"."people_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_organizational_roles" ADD CONSTRAINT "people_organizational_roles_team_id_people_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."people_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_organizational_roles" ADD CONSTRAINT "people_organizational_roles_parent_role_id_people_organizational_roles_id_fk" FOREIGN KEY ("parent_role_id") REFERENCES "public"."people_organizational_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_organizational_roles" ADD CONSTRAINT "people_organizational_roles_level_id_people_organizational_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."people_organizational_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_findings" ADD CONSTRAINT "security_audit_findings_audit_id_security_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."security_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_findings" ADD CONSTRAINT "security_audit_findings_control_id_security_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."security_controls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_findings" ADD CONSTRAINT "security_audit_findings_responsible_person_id_people_persons_id_fk" FOREIGN KEY ("responsible_person_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audits" ADD CONSTRAINT "security_audits_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audits" ADD CONSTRAINT "security_audits_framework_id_security_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."security_frameworks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_clause_compliance" ADD CONSTRAINT "security_clause_compliance_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_clause_compliance" ADD CONSTRAINT "security_clause_compliance_framework_id_security_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."security_frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_clause_compliance" ADD CONSTRAINT "security_clause_compliance_standard_clause_id_security_standard_clauses_id_fk" FOREIGN KEY ("standard_clause_id") REFERENCES "public"."security_standard_clauses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_clause_compliance" ADD CONSTRAINT "security_clause_compliance_owner_id_people_persons_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_clause_compliance" ADD CONSTRAINT "security_clause_compliance_last_reviewed_by_id_core_users_id_fk" FOREIGN KEY ("last_reviewed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_control_mappings" ADD CONSTRAINT "security_control_mappings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_control_mappings" ADD CONSTRAINT "security_control_mappings_control_id_security_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."security_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_control_mappings" ADD CONSTRAINT "security_control_mappings_standard_control_id_security_standard_controls_id_fk" FOREIGN KEY ("standard_control_id") REFERENCES "public"."security_standard_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_controls" ADD CONSTRAINT "security_controls_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_controls" ADD CONSTRAINT "security_controls_owner_id_people_persons_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_evidence" ADD CONSTRAINT "security_evidence_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_evidence" ADD CONSTRAINT "security_evidence_collected_by_id_core_users_id_fk" FOREIGN KEY ("collected_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_evidence_links" ADD CONSTRAINT "security_evidence_links_evidence_id_security_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."security_evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_evidence_links" ADD CONSTRAINT "security_evidence_links_control_id_security_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."security_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_frameworks" ADD CONSTRAINT "security_frameworks_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD CONSTRAINT "security_objectives_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD CONSTRAINT "security_objectives_owner_id_people_persons_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_risk_controls" ADD CONSTRAINT "security_risk_controls_risk_id_security_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."security_risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_risk_controls" ADD CONSTRAINT "security_risk_controls_control_id_security_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."security_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_risks" ADD CONSTRAINT "security_risks_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_risks" ADD CONSTRAINT "security_risks_owner_id_people_persons_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_soa_items" ADD CONSTRAINT "security_soa_items_framework_id_security_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."security_frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_soa_items" ADD CONSTRAINT "security_soa_items_standard_control_id_security_standard_controls_id_fk" FOREIGN KEY ("standard_control_id") REFERENCES "public"."security_standard_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_soa_items" ADD CONSTRAINT "security_soa_items_control_id_security_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."security_controls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "idx_docs_acks_document" ON "docs_document_acknowledgments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_docs_acks_rollout" ON "docs_document_acknowledgments" USING btree ("rollout_id");--> statement-breakpoint
CREATE INDEX "idx_docs_acks_user" ON "docs_document_acknowledgments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docs_acks_person" ON "docs_document_acknowledgments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_docs_acks_status" ON "docs_document_acknowledgments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_docs_rollouts_document" ON "docs_document_rollouts" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_docs_rollouts_target_type" ON "docs_document_rollouts" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "idx_docs_rollouts_target_id" ON "docs_document_rollouts" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_docs_rollouts_active" ON "docs_document_rollouts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_docs_rollouts_due_date" ON "docs_document_rollouts" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_docs_settings_org" ON "docs_settings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docs_versions_document" ON "docs_document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_docs_versions_version" ON "docs_document_versions" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_docs_versions_created" ON "docs_document_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_docs_documents_org" ON "docs_documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docs_documents_slug" ON "docs_documents" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_docs_documents_status" ON "docs_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_docs_documents_category" ON "docs_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_docs_documents_owner" ON "docs_documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_docs_documents_next_review" ON "docs_documents" USING btree ("next_review_at");--> statement-breakpoint
CREATE INDEX "idx_rbac_actions_slug" ON "rbac_actions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_rbac_modules_slug" ON "rbac_modules" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_rbac_modules_category" ON "rbac_modules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_rbac_permissions_module" ON "rbac_permissions" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "idx_rbac_permissions_action" ON "rbac_permissions" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_rbac_role_permissions_role" ON "rbac_role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_rbac_role_permissions_permission" ON "rbac_role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_rbac_roles_org" ON "rbac_roles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_rbac_roles_slug" ON "rbac_roles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_rbac_user_roles_user" ON "rbac_user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rbac_user_roles_role" ON "rbac_user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_rbac_user_roles_source" ON "rbac_user_roles" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_rbac_user_roles_scim_group" ON "rbac_user_roles" USING btree ("scim_group_id");--> statement-breakpoint
CREATE INDEX "idx_core_users_org" ON "core_users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_core_users_email" ON "core_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_core_users_role" ON "core_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_core_users_status" ON "core_users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_people_persons_org" ON "people_persons" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_people_persons_status" ON "people_persons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_people_persons_team_id" ON "people_persons" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_people_persons_role_id" ON "people_persons" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_people_persons_slug" ON "people_persons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_people_persons_source" ON "people_persons" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_people_persons_entra_id" ON "people_persons" USING btree ("entra_id");--> statement-breakpoint
CREATE INDEX "idx_scim_groups_org" ON "scim_groups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_scim_groups_external_id" ON "scim_groups" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_scim_groups_display_name" ON "scim_groups" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "idx_user_scim_groups_user" ON "user_scim_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_scim_groups_group" ON "user_scim_groups" USING btree ("scim_group_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_instance" ON "workflow_instance_steps" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_template_step" ON "workflow_instance_steps" USING btree ("template_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_parent" ON "workflow_instance_steps" USING btree ("parent_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_status" ON "workflow_instance_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_assignee" ON "workflow_instance_steps" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_assigned_person" ON "workflow_instance_steps" USING btree ("assigned_person_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instance_steps_due" ON "workflow_instance_steps" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_org" ON "workflow_instances" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_template" ON "workflow_instances" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_entity" ON "workflow_instances" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_status" ON "workflow_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_due" ON "workflow_instances" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_instances_owner" ON "workflow_instances" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_edges_template" ON "workflow_template_edges" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_edges_source" ON "workflow_template_edges" USING btree ("source_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_edges_target" ON "workflow_template_edges" USING btree ("target_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_steps_template" ON "workflow_template_steps" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_steps_parent" ON "workflow_template_steps" USING btree ("parent_step_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_template_steps_order" ON "workflow_template_steps" USING btree ("template_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_org" ON "workflow_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_module" ON "workflow_templates" USING btree ("module_scope");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_status" ON "workflow_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_trigger" ON "workflow_templates" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_people_teams_org" ON "people_teams" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_people_teams_parent" ON "people_teams" USING btree ("parent_team_id");--> statement-breakpoint
CREATE INDEX "idx_people_teams_lead" ON "people_teams" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_people_org_levels_org" ON "people_organizational_levels" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_people_org_levels_sort" ON "people_organizational_levels" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_people_org_levels_code_org" ON "people_organizational_levels" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "idx_people_org_roles_org" ON "people_organizational_roles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_people_org_roles_team" ON "people_organizational_roles" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_people_org_roles_parent" ON "people_organizational_roles" USING btree ("parent_role_id");--> statement-breakpoint
CREATE INDEX "idx_people_org_roles_level" ON "people_organizational_roles" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_people_org_roles_level_id" ON "people_organizational_roles" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "idx_security_audit_findings_audit" ON "security_audit_findings" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "idx_security_audit_findings_finding_id" ON "security_audit_findings" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "idx_security_audit_findings_control" ON "security_audit_findings" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "idx_security_audit_findings_severity" ON "security_audit_findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_security_audit_findings_status" ON "security_audit_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_audit_findings_due_date" ON "security_audit_findings" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_security_audits_org" ON "security_audits" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_security_audits_audit_id" ON "security_audits" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "idx_security_audits_framework" ON "security_audits" USING btree ("framework_id");--> statement-breakpoint
CREATE INDEX "idx_security_audits_type" ON "security_audits" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_security_audits_status" ON "security_audits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_audits_start_date" ON "security_audits" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_clause_compliance_org" ON "security_clause_compliance" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_clause_compliance_framework" ON "security_clause_compliance" USING btree ("framework_id");--> statement-breakpoint
CREATE INDEX "idx_clause_compliance_clause" ON "security_clause_compliance" USING btree ("standard_clause_id");--> statement-breakpoint
CREATE INDEX "idx_clause_compliance_status" ON "security_clause_compliance" USING btree ("compliance_status");--> statement-breakpoint
CREATE INDEX "idx_clause_compliance_owner" ON "security_clause_compliance" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_security_control_mappings_org" ON "security_control_mappings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_security_control_mappings_control" ON "security_control_mappings" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "idx_security_control_mappings_standard" ON "security_control_mappings" USING btree ("standard_control_id");--> statement-breakpoint
CREATE INDEX "idx_security_controls_org" ON "security_controls" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_security_controls_control_id" ON "security_controls" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "idx_security_controls_status" ON "security_controls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_controls_owner" ON "security_controls" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_security_controls_implementation_status" ON "security_controls" USING btree ("implementation_status");--> statement-breakpoint
CREATE INDEX "idx_security_evidence_org" ON "security_evidence" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_security_evidence_type" ON "security_evidence" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_security_evidence_status" ON "security_evidence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_evidence_collected_at" ON "security_evidence" USING btree ("collected_at");--> statement-breakpoint
CREATE INDEX "idx_security_evidence_valid_until" ON "security_evidence" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "idx_security_evidence_links_evidence" ON "security_evidence_links" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "idx_security_evidence_links_control" ON "security_evidence_links" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "idx_security_frameworks_org" ON "security_frameworks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_security_frameworks_code" ON "security_frameworks" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_security_frameworks_status" ON "security_frameworks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_org" ON "security_objectives" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_objective_id" ON "security_objectives" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_status" ON "security_objectives" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_priority" ON "security_objectives" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_owner" ON "security_objectives" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_target_date" ON "security_objectives" USING btree ("target_date");--> statement-breakpoint
CREATE INDEX "idx_security_risk_controls_risk" ON "security_risk_controls" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "idx_security_risk_controls_control" ON "security_risk_controls" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "idx_security_risks_org" ON "security_risks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_security_risks_risk_id" ON "security_risks" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "idx_security_risks_category" ON "security_risks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_security_risks_status" ON "security_risks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_risks_owner" ON "security_risks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_security_risks_inherent_level" ON "security_risks" USING btree ("inherent_level");--> statement-breakpoint
CREATE INDEX "idx_security_risks_residual_level" ON "security_risks" USING btree ("residual_level");--> statement-breakpoint
CREATE INDEX "idx_security_soa_items_framework" ON "security_soa_items" USING btree ("framework_id");--> statement-breakpoint
CREATE INDEX "idx_security_soa_items_standard_control" ON "security_soa_items" USING btree ("standard_control_id");--> statement-breakpoint
CREATE INDEX "idx_security_soa_items_control" ON "security_soa_items" USING btree ("control_id");--> statement-breakpoint
CREATE INDEX "idx_security_soa_items_applicability" ON "security_soa_items" USING btree ("applicability");--> statement-breakpoint
CREATE INDEX "idx_security_soa_items_implementation_status" ON "security_soa_items" USING btree ("implementation_status");--> statement-breakpoint
CREATE INDEX "idx_standard_clauses_framework" ON "security_standard_clauses" USING btree ("framework_code");--> statement-breakpoint
CREATE INDEX "idx_standard_clauses_clause_id" ON "security_standard_clauses" USING btree ("clause_id");--> statement-breakpoint
CREATE INDEX "idx_standard_clauses_parent" ON "security_standard_clauses" USING btree ("parent_clause_id");--> statement-breakpoint
CREATE INDEX "idx_security_standard_controls_framework" ON "security_standard_controls" USING btree ("framework_code");--> statement-breakpoint
CREATE INDEX "idx_security_standard_controls_category" ON "security_standard_controls" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_security_standard_controls_control_id" ON "security_standard_controls" USING btree ("control_id");