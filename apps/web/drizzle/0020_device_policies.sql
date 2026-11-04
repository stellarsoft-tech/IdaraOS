-- Device groups & policies (IdaraOS Agent), and agent self-update bookkeeping.
-- Hand-written and idempotent, matching this repo's migration convention (see 0018/0019).

CREATE TABLE IF NOT EXISTS "security_policy_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"description" text,
	"created_by_id" uuid REFERENCES "core_users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_policy_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"group_id" uuid NOT NULL REFERENCES "security_policy_groups"("id") ON DELETE cascade,
	"device_id" uuid REFERENCES "security_software_update_devices"("id") ON DELETE cascade,
	"user_id" uuid REFERENCES "core_users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"group_id" uuid NOT NULL REFERENCES "security_policy_groups"("id") ON DELETE cascade,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_id" uuid REFERENCES "core_users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_device_policy_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"device_id" uuid NOT NULL REFERENCES "security_software_update_devices"("id") ON DELETE cascade,
	"type" text NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"message" text,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_software_update_settings" ADD COLUMN IF NOT EXISTS "agent_auto_update" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "agent_update_requested_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_policy_groups_org_name" ON "security_policy_groups" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_policy_group_members_group" ON "security_policy_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_policy_group_members_device" ON "security_policy_group_members" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_policy_group_members_user" ON "security_policy_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_policy_group_members_group_device" ON "security_policy_group_members" USING btree ("group_id","device_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_policy_group_members_group_user" ON "security_policy_group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_policies_group" ON "security_policies" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_policies_group_type" ON "security_policies" USING btree ("group_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_device_policy_state_device" ON "security_device_policy_state" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_device_policy_state_device_type" ON "security_device_policy_state" USING btree ("device_id","type");
