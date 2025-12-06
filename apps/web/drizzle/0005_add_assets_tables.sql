-- Assets Module Tables

-- Asset Categories table - hierarchical categories for assets
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

-- Asset Tags table - flexible tagging for assets
CREATE TABLE "assets_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Assets table - main asset registry
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

-- Asset-Tag junction table
CREATE TABLE "assets_asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Asset Assignments table - assignment history
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

-- Asset Maintenance Records table
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
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Asset Lifecycle Events table - audit trail of asset changes
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

-- Foreign key constraints
ALTER TABLE "assets_categories" ADD CONSTRAINT "assets_categories_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_categories" ADD CONSTRAINT "assets_categories_parent_id_assets_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assets_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_tags" ADD CONSTRAINT "assets_tags_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_category_id_assets_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."assets_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_assets" ADD CONSTRAINT "assets_assets_assigned_to_id_people_persons_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_asset_tags" ADD CONSTRAINT "assets_asset_tags_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_asset_tags" ADD CONSTRAINT "assets_asset_tags_tag_id_assets_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."assets_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_person_id_people_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people_persons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_assignments" ADD CONSTRAINT "assets_assignments_assigned_by_id_core_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_performed_by_id_core_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets_lifecycle_events" ADD CONSTRAINT "assets_lifecycle_events_performed_by_id_core_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Indexes for performance
CREATE INDEX "idx_assets_categories_org" ON "assets_categories" ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_categories_parent" ON "assets_categories" ("parent_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_categories_slug" ON "assets_categories" ("slug");
--> statement-breakpoint
CREATE INDEX "idx_assets_tags_org" ON "assets_tags" ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_assets_org" ON "assets_assets" ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_assets_category" ON "assets_assets" ("category_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_assets_status" ON "assets_assets" ("status");
--> statement-breakpoint
CREATE INDEX "idx_assets_assets_tag" ON "assets_assets" ("asset_tag");
--> statement-breakpoint
CREATE INDEX "idx_assets_assets_assigned_to" ON "assets_assets" ("assigned_to_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_assets_source" ON "assets_assets" ("source");
--> statement-breakpoint
CREATE INDEX "idx_assets_assets_intune_id" ON "assets_assets" ("intune_device_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_asset_tags_asset" ON "assets_asset_tags" ("asset_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_asset_tags_tag" ON "assets_asset_tags" ("tag_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_assignments_asset" ON "assets_assignments" ("asset_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_assignments_person" ON "assets_assignments" ("person_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_assignments_returned" ON "assets_assignments" ("returned_at");
--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_org" ON "assets_maintenance_records" ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_asset" ON "assets_maintenance_records" ("asset_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_status" ON "assets_maintenance_records" ("status");
--> statement-breakpoint
CREATE INDEX "idx_assets_maintenance_type" ON "assets_maintenance_records" ("type");
--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_org" ON "assets_lifecycle_events" ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_asset" ON "assets_lifecycle_events" ("asset_id");
--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_type" ON "assets_lifecycle_events" ("event_type");
--> statement-breakpoint
CREATE INDEX "idx_assets_lifecycle_date" ON "assets_lifecycle_events" ("event_date");
--> statement-breakpoint

-- Assets Settings table - module-level configuration
CREATE TABLE "assets_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL UNIQUE,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets_settings" ADD CONSTRAINT "assets_settings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Add Intune/device sync fields to integrations table
ALTER TABLE "core_integrations" ADD COLUMN IF NOT EXISTS "sync_devices_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "core_integrations" ADD COLUMN IF NOT EXISTS "delete_assets_on_device_delete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "core_integrations" ADD COLUMN IF NOT EXISTS "last_device_sync_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "core_integrations" ADD COLUMN IF NOT EXISTS "synced_device_count" text DEFAULT '0';

