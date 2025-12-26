CREATE TABLE IF NOT EXISTS "assets_settings" (
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
CREATE TABLE IF NOT EXISTS "assets_asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets_assignments" (
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
CREATE TABLE IF NOT EXISTS "assets_categories" (
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
CREATE TABLE IF NOT EXISTS "assets_lifecycle_events" (
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
CREATE TABLE IF NOT EXISTS "assets_maintenance_records" (
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
CREATE TABLE IF NOT EXISTS "assets_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets_assets" (
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
CREATE TABLE IF NOT EXISTS "audit_logs" (
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
-- Workflow tables skipped here - they will be created by migration 0009 with correct schema (including owner_id columns)
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people_persons' AND column_name='entra_created_at') THEN
    ALTER TABLE "people_persons" ADD COLUMN "entra_created_at" timestamp with time zone;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people_persons' AND column_name='hire_date') THEN
    ALTER TABLE "people_persons" ADD COLUMN "hire_date" date;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people_persons' AND column_name='last_sign_in_at') THEN
    ALTER TABLE "people_persons" ADD COLUMN "last_sign_in_at" timestamp with time zone;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people_persons' AND column_name='last_password_change_at') THEN
    ALTER TABLE "people_persons" ADD COLUMN "last_password_change_at" timestamp with time zone;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='core_integrations' AND column_name='sync_devices_enabled') THEN
    ALTER TABLE "core_integrations" ADD COLUMN "sync_devices_enabled" boolean DEFAULT false NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='core_integrations' AND column_name='delete_assets_on_device_delete') THEN
    ALTER TABLE "core_integrations" ADD COLUMN "delete_assets_on_device_delete" boolean DEFAULT false NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='core_integrations' AND column_name='last_device_sync_at') THEN
    ALTER TABLE "core_integrations" ADD COLUMN "last_device_sync_at" timestamp with time zone;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='core_integrations' AND column_name='synced_device_count') THEN
    ALTER TABLE "core_integrations" ADD COLUMN "synced_device_count" text DEFAULT '0';
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_settings" ADD CONSTRAINT "assets_settings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_asset_tags" ADD CONSTRAINT "assets_asset_tags_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_asset_tags" ADD CONSTRAINT "assets_asset_tags_tag_id_assets_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."assets_tags"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_person_id_people_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people_persons"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_assigned_by_id_core_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_categories" ADD CONSTRAINT "assets_categories_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_categories" ADD CONSTRAINT "assets_categories_parent_id_assets_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assets_categories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_performed_by_id_core_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_performed_by_id_core_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_assigned_to_id_people_persons_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_tags" ADD CONSTRAINT "assets_tags_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_category_id_assets_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."assets_categories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_assigned_to_id_people_persons_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_core_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
-- Workflow FK constraints skipped here - they will be created by migration 0009
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_asset_tags_asset" ON "assets_asset_tags" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_asset_tags_tag" ON "assets_asset_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assignments_asset" ON "assets_assignments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assignments_person" ON "assets_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assignments_returned" ON "assets_assignments" USING btree ("returned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_categories_org" ON "assets_categories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_categories_parent" ON "assets_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_categories_slug" ON "assets_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_lifecycle_org" ON "assets_lifecycle_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_lifecycle_asset" ON "assets_lifecycle_events" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_lifecycle_type" ON "assets_lifecycle_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_lifecycle_date" ON "assets_lifecycle_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_maintenance_org" ON "assets_maintenance_records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_maintenance_asset" ON "assets_maintenance_records" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_maintenance_status" ON "assets_maintenance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_maintenance_type" ON "assets_maintenance_records" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_maintenance_assigned" ON "assets_maintenance_records" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_tags_org" ON "assets_tags" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_org" ON "assets_assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_category" ON "assets_assets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_status" ON "assets_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_tag" ON "assets_assets" USING btree ("asset_tag");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_assigned_to" ON "assets_assets" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_source" ON "assets_assets" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_intune_id" ON "assets_assets" USING btree ("intune_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_org" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_module" ON "audit_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity_type" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity_id" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor_id" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_org_module_timestamp" ON "audit_logs" USING btree ("org_id","module","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_org_entity" ON "audit_logs" USING btree ("org_id","entity_type","entity_id");--> statement-breakpoint
-- Workflow indexes skipped here - they will be created by migration 0009