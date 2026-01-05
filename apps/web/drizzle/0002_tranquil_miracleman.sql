CREATE TABLE "core_file_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"module_scope" text NOT NULL,
	"storage_integration_id" uuid,
	"folder_path" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"max_file_size" integer,
	"allowed_mime_types" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system_category" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text,
	"size" integer,
	"storage_integration_id" uuid,
	"storage_path" text NOT NULL,
	"external_id" text,
	"entity_type" text,
	"entity_id" uuid,
	"module_scope" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"metadata" jsonb,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_storage_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"site_url" text,
	"site_id" text,
	"drive_id" text,
	"drive_name" text,
	"account_name" text,
	"container_name" text,
	"connection_string_encrypted" text,
	"base_path" text,
	"use_entra_auth" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"settings" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_file_categories" ADD CONSTRAINT "core_file_categories_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_file_categories" ADD CONSTRAINT "core_file_categories_storage_integration_id_core_storage_integrations_id_fk" FOREIGN KEY ("storage_integration_id") REFERENCES "public"."core_storage_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_file_categories" ADD CONSTRAINT "core_file_categories_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_files" ADD CONSTRAINT "core_files_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_files" ADD CONSTRAINT "core_files_category_id_core_file_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."core_file_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_files" ADD CONSTRAINT "core_files_storage_integration_id_core_storage_integrations_id_fk" FOREIGN KEY ("storage_integration_id") REFERENCES "public"."core_storage_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_files" ADD CONSTRAINT "core_files_deleted_by_id_core_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_files" ADD CONSTRAINT "core_files_uploaded_by_id_core_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_storage_integrations" ADD CONSTRAINT "core_storage_integrations_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_storage_integrations" ADD CONSTRAINT "core_storage_integrations_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_file_categories_org" ON "core_file_categories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_file_categories_module" ON "core_file_categories" USING btree ("module_scope");--> statement-breakpoint
CREATE INDEX "idx_file_categories_storage" ON "core_file_categories" USING btree ("storage_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_file_categories_org_module_slug" ON "core_file_categories" USING btree ("org_id","module_scope","slug");--> statement-breakpoint
CREATE INDEX "idx_files_org" ON "core_files" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_files_category" ON "core_files" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_files_storage" ON "core_files" USING btree ("storage_integration_id");--> statement-breakpoint
CREATE INDEX "idx_files_entity" ON "core_files" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_files_module" ON "core_files" USING btree ("module_scope");--> statement-breakpoint
CREATE INDEX "idx_files_uploaded_by" ON "core_files" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "idx_files_created_at" ON "core_files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_storage_integrations_org" ON "core_storage_integrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_storage_integrations_provider" ON "core_storage_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_storage_integrations_status" ON "core_storage_integrations" USING btree ("status");