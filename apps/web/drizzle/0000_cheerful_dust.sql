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
	"role" text NOT NULL,
	"team" text,
	"manager_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"phone" text,
	"location" text,
	"avatar" text,
	"bio" text,
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
ALTER TABLE "people_persons" ADD CONSTRAINT "people_persons_manager_id_people_persons_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_integrations" ADD CONSTRAINT "core_integrations_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_groups" ADD CONSTRAINT "scim_groups_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_groups" ADD CONSTRAINT "scim_groups_mapped_role_id_rbac_roles_id_fk" FOREIGN KEY ("mapped_role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scim_groups" ADD CONSTRAINT "user_scim_groups_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scim_groups" ADD CONSTRAINT "user_scim_groups_scim_group_id_scim_groups_id_fk" FOREIGN KEY ("scim_group_id") REFERENCES "public"."scim_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "idx_people_persons_team" ON "people_persons" USING btree ("team");--> statement-breakpoint
CREATE INDEX "idx_people_persons_slug" ON "people_persons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_scim_groups_org" ON "scim_groups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_scim_groups_external_id" ON "scim_groups" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_scim_groups_display_name" ON "scim_groups" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "idx_user_scim_groups_user" ON "user_scim_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_scim_groups_group" ON "user_scim_groups" USING btree ("scim_group_id");--> statement-breakpoint

-- Data migration: Update role assignment source from "scim" to "sync"
-- The "sync" label better represents synchronization from Entra ID
-- rather than implying the SCIM protocol specifically.
-- This is a no-op for fresh databases but ensures consistency.
UPDATE rbac_user_roles SET source = 'sync' WHERE source = 'scim';