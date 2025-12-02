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
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
ALTER TABLE "people_settings" ADD CONSTRAINT "people_settings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Data migration: Update role assignment source from "scim" to "sync"
-- This migrates existing records to use the new "sync" terminology
UPDATE rbac_user_roles SET source = 'sync' WHERE source = 'scim';