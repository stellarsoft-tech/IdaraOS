-- Vault Phase 4: TOTP/2FA secret per item + encrypted file attachments. Hand-written, idempotent.

ALTER TABLE "security_vault_items" ADD COLUMN IF NOT EXISTS "totp_encrypted" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "security_vault_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"item_id" uuid NOT NULL REFERENCES "security_vault_items"("id") ON DELETE cascade,
	"filename" text NOT NULL,
	"content_type" text,
	"size_bytes" integer NOT NULL,
	"data_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_attachments_item" ON "security_vault_attachments" USING btree ("item_id");
