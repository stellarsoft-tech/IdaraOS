-- Agent-managed local admin password (IdaraOS Agent "credentials" elevation for the agent provider).
-- Hand-written and idempotent, matching this repo's migration convention (see 0020, 0021).
-- password_encrypted holds the current local admin password encrypted at rest (lib/encryption.ts).

CREATE TABLE IF NOT EXISTS "security_device_admin_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"device_id" uuid NOT NULL REFERENCES "security_software_update_devices"("id") ON DELETE cascade,
	"account_name" text DEFAULT 'StellarAdmin' NOT NULL,
	"password_encrypted" text,
	"last_status" text,
	"last_error" text,
	"rotated_at" timestamp with time zone,
	"rotate_requested_at" timestamp with time zone,
	"reported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_device_admin_credentials_device" ON "security_device_admin_credentials" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_device_admin_credentials_org" ON "security_device_admin_credentials" USING btree ("org_id");--> statement-breakpoint

-- Agent-managed admin settings on the per-org elevation settings row.
ALTER TABLE "security_elevation_settings" ADD COLUMN IF NOT EXISTS "manage_agent_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "security_elevation_settings" ADD COLUMN IF NOT EXISTS "agent_admin_account" text DEFAULT 'StellarAdmin' NOT NULL;
