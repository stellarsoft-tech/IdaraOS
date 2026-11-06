-- Vault Phase 5: per-user tokens that let the browser extension authenticate to the vault API
-- (the SSO session cookie isn't sent from an extension's cross-site fetch). Only the SHA-256 hash is
-- stored. Hand-written, idempotent.

CREATE TABLE IF NOT EXISTS "security_vault_extension_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "core_users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_vault_extension_tokens_hash" ON "security_vault_extension_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_extension_tokens_user" ON "security_vault_extension_tokens" USING btree ("user_id");
