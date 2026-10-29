CREATE TABLE IF NOT EXISTS "security_software_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"publisher" text,
	"description" text,
	"notes" text,
	"access" text DEFAULT 'approval' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"winget_id" text,
	"update_method" text DEFAULT 'winget' NOT NULL,
	"auto_update" boolean DEFAULT true NOT NULL,
	"intune_app_id" text,
	"intune_app_name" text,
	"install_group_id" text,
	"install_group_name" text,
	"remove_from_group_after_install" boolean DEFAULT false NOT NULL,
	"install_deadline_hours" integer DEFAULT 24 NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_software_installs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"grant_id" uuid NOT NULL,
	"catalog_app_id" uuid,
	"app_name" text NOT NULL,
	"winget_id" text,
	"intune_app_id" text,
	"group_id" text NOT NULL,
	"remove_from_group_after_install" boolean DEFAULT false NOT NULL,
	"entra_device_id" text NOT NULL,
	"intune_device_id" text,
	"device_object_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"group_added_at" timestamp with time zone,
	"sync_requested_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_intune_state" text,
	"installed_at" timestamp with time zone,
	"group_removed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_software_update_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"schedule_enabled" boolean DEFAULT false NOT NULL,
	"schedule_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
	"schedule_time" text DEFAULT '12:00' NOT NULL,
	"schedule_timezone" text DEFAULT 'UTC' NOT NULL,
	"check_in_minutes" integer DEFAULT 15 NOT NULL,
	"enrollment_token_hash" text,
	"enrollment_token_hint" text,
	"enrollment_token_created_at" timestamp with time zone,
	"catalog_seeded_at" timestamp with time zone,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_software_update_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"asset_id" uuid,
	"entra_device_id" text NOT NULL,
	"intune_device_id" text,
	"hostname" text NOT NULL,
	"serial_number" text,
	"os_version" text,
	"updater_version" text,
	"winget_version" text,
	"secret_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"last_error" text,
	"run_requested_at" timestamp with time zone,
	"run_requested_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_software_update_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"requested_by_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"packages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"reboot_required" boolean DEFAULT false NOT NULL,
	"error" text,
	"log" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ADD COLUMN IF NOT EXISTS "catalog_app_id" uuid;
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ALTER COLUMN "requested_minutes" DROP NOT NULL;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_catalog" ADD CONSTRAINT "security_software_catalog_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_catalog" ADD CONSTRAINT "security_software_catalog_created_by_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_installs" ADD CONSTRAINT "security_software_installs_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_installs" ADD CONSTRAINT "security_software_installs_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."security_elevation_grants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_installs" ADD CONSTRAINT "security_software_installs_catalog_app_id_fk" FOREIGN KEY ("catalog_app_id") REFERENCES "public"."security_software_catalog"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_settings" ADD CONSTRAINT "security_software_update_settings_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_settings" ADD CONSTRAINT "security_software_update_settings_updated_by_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_devices" ADD CONSTRAINT "security_software_update_devices_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_devices" ADD CONSTRAINT "security_software_update_devices_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_devices" ADD CONSTRAINT "security_software_update_devices_run_requested_by_id_fk" FOREIGN KEY ("run_requested_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_runs" ADD CONSTRAINT "security_software_update_runs_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_runs" ADD CONSTRAINT "security_software_update_runs_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."security_software_update_devices"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_runs" ADD CONSTRAINT "security_software_update_runs_requested_by_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_elevation_requests" ADD CONSTRAINT "security_elevation_requests_catalog_app_id_fk" FOREIGN KEY ("catalog_app_id") REFERENCES "public"."security_software_catalog"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_catalog_org" ON "security_software_catalog" USING btree ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_software_catalog_org_name" ON "security_software_catalog" USING btree ("org_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_installs_org" ON "security_software_installs" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_installs_status" ON "security_software_installs" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_software_installs_grant" ON "security_software_installs" USING btree ("grant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_software_update_settings_org" ON "security_software_update_settings" USING btree ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_software_update_settings_token" ON "security_software_update_settings" USING btree ("enrollment_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_update_devices_org" ON "security_software_update_devices" USING btree ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_software_update_devices_entra" ON "security_software_update_devices" USING btree ("org_id","entra_device_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_update_runs_org" ON "security_software_update_runs" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_update_runs_device" ON "security_software_update_runs" USING btree ("device_id","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_update_runs_status" ON "security_software_update_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_requests_catalog_app" ON "security_elevation_requests" USING btree ("catalog_app_id");
