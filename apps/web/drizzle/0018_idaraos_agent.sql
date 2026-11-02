-- IdaraOS Agent provider: approved installs without Intune, devices linked to the member who signed in to the agent
ALTER TABLE "security_elevation_settings" ADD COLUMN IF NOT EXISTS "device_provider" text DEFAULT 'intune' NOT NULL;
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ALTER COLUMN "entra_device_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ADD COLUMN IF NOT EXISTS "agent_device_id" uuid;
--> statement-breakpoint
ALTER TABLE "security_software_installs" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'intune' NOT NULL;
--> statement-breakpoint
ALTER TABLE "security_software_installs" ALTER COLUMN "group_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "security_software_installs" ALTER COLUMN "entra_device_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "security_software_installs" ADD COLUMN IF NOT EXISTS "agent_device_id" uuid;
--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ALTER COLUMN "entra_device_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "machine_id" text;
--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "last_logged_on_user" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_agent_pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_code" text NOT NULL,
	"device_code_hash" text NOT NULL,
	"hostname" text NOT NULL,
	"machine_id" text NOT NULL,
	"serial_number" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"device_id" uuid,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_agent_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"install_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"result" jsonb,
	"error" text,
	"log" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_elevation_requests" ADD CONSTRAINT "security_elevation_requests_agent_device_id_fk" FOREIGN KEY ("agent_device_id") REFERENCES "public"."security_software_update_devices"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_installs" ADD CONSTRAINT "security_software_installs_agent_device_id_fk" FOREIGN KEY ("agent_device_id") REFERENCES "public"."security_software_update_devices"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_software_update_devices" ADD CONSTRAINT "security_software_update_devices_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_agent_pairings" ADD CONSTRAINT "security_agent_pairings_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_agent_pairings" ADD CONSTRAINT "security_agent_pairings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_agent_pairings" ADD CONSTRAINT "security_agent_pairings_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."security_software_update_devices"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_agent_jobs" ADD CONSTRAINT "security_agent_jobs_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_agent_jobs" ADD CONSTRAINT "security_agent_jobs_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."security_software_update_devices"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "security_agent_jobs" ADD CONSTRAINT "security_agent_jobs_install_id_fk" FOREIGN KEY ("install_id") REFERENCES "public"."security_software_installs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_requests_agent_device" ON "security_elevation_requests" USING btree ("agent_device_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_software_update_devices_machine" ON "security_software_update_devices" USING btree ("org_id","machine_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_software_update_devices_user" ON "security_software_update_devices" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_agent_pairings_device_code" ON "security_agent_pairings" USING btree ("device_code_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_agent_pairings_user_code" ON "security_agent_pairings" USING btree ("user_code","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_agent_jobs_device" ON "security_agent_jobs" USING btree ("device_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_agent_jobs_org" ON "security_agent_jobs" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_agent_jobs_install" ON "security_agent_jobs" USING btree ("install_id");
