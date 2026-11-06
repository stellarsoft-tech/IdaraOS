-- Vault Phase 2: Security Audit + admin password policy.
-- Per-org policy settings, plus two non-secret derived columns on items so the audit never decrypts:
--   password_fingerprint = keyed HMAC of the password (reuse detection)
--   password_strength    = 0-4 strength score computed at save
-- Hand-written, idempotent.

CREATE TABLE IF NOT EXISTS "security_vault_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"min_length" integer DEFAULT 12 NOT NULL,
	"require_upper" boolean DEFAULT true NOT NULL,
	"require_lower" boolean DEFAULT true NOT NULL,
	"require_digit" boolean DEFAULT true NOT NULL,
	"require_symbol" boolean DEFAULT false NOT NULL,
	"no_reuse" boolean DEFAULT true NOT NULL,
	"max_age_days" integer DEFAULT 0 NOT NULL,
	"enforcement" text DEFAULT 'warn' NOT NULL,
	"updated_by_id" uuid REFERENCES "core_users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_vault_settings_org" ON "security_vault_settings" USING btree ("org_id");--> statement-breakpoint

ALTER TABLE "security_vault_items" ADD COLUMN IF NOT EXISTS "password_fingerprint" text;--> statement-breakpoint
ALTER TABLE "security_vault_items" ADD COLUMN IF NOT EXISTS "password_strength" smallint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_items_fingerprint" ON "security_vault_items" USING btree ("user_id", "password_fingerprint");
