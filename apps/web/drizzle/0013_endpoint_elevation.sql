ALTER TABLE "assets_assets" ADD COLUMN IF NOT EXISTS "entra_device_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_assets_entra_device_id" ON "assets_assets" USING btree ("entra_device_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_elevation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"duration_options" jsonb DEFAULT '[15,30,60,120,240]'::jsonb NOT NULL,
	"max_minutes" integer DEFAULT 240 NOT NULL,
	"require_reason" boolean DEFAULT true NOT NULL,
	"credential_mode_enabled" boolean DEFAULT true NOT NULL,
	"require_recent_auth" boolean DEFAULT true NOT NULL,
	"recent_auth_minutes" integer DEFAULT 15 NOT NULL,
	"max_reveals_per_grant" integer DEFAULT 5 NOT NULL,
	"teams_webhook_url_encrypted" text,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_elevation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"asset_id" uuid,
	"device_name" text NOT NULL,
	"entra_device_id" text NOT NULL,
	"intune_device_id" text,
	"app" jsonb,
	"requested_minutes" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_elevation_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"approved_by_id" uuid,
	"mode" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	"revoked_by_id" uuid,
	"first_revealed_at" timestamp with time zone,
	"last_revealed_at" timestamp with time zone,
	"reveal_count" integer DEFAULT 0 NOT NULL,
	"rotation_status" text DEFAULT 'not_required' NOT NULL,
	"rotation_attempts" integer DEFAULT 0 NOT NULL,
	"rotation_requested_at" timestamp with time zone,
	"rotation_verified_at" timestamp with time zone,
	"rotation_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_elevation_settings" ADD CONSTRAINT "security_elevation_settings_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_settings" ADD CONSTRAINT "security_elevation_settings_updated_by_id_core_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ADD CONSTRAINT "security_elevation_requests_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ADD CONSTRAINT "security_elevation_requests_requester_id_core_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ADD CONSTRAINT "security_elevation_requests_asset_id_assets_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets_assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_requests" ADD CONSTRAINT "security_elevation_requests_decided_by_id_core_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_grants" ADD CONSTRAINT "security_elevation_grants_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_grants" ADD CONSTRAINT "security_elevation_grants_request_id_security_elevation_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."security_elevation_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_grants" ADD CONSTRAINT "security_elevation_grants_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_grants" ADD CONSTRAINT "security_elevation_grants_approved_by_id_core_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_elevation_grants" ADD CONSTRAINT "security_elevation_grants_revoked_by_id_core_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_elevation_settings_org" ON "security_elevation_settings" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_requests_org" ON "security_elevation_requests" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_requests_requester" ON "security_elevation_requests" USING btree ("requester_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_requests_status" ON "security_elevation_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_grants_org" ON "security_elevation_grants" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_grants_user" ON "security_elevation_grants" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_grants_status" ON "security_elevation_grants" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_elevation_grants_rotation" ON "security_elevation_grants" USING btree ("rotation_status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_elevation_grants_request" ON "security_elevation_grants" USING btree ("request_id");
