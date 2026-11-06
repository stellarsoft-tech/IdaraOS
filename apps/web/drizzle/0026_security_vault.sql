-- Password Vault (security.my-vault): personal per-user vault of encrypted items in folders.
-- Hand-written, idempotent. Secrets live in *_encrypted columns (AES-256-GCM, lib/vault/crypto-server.ts);
-- title/username/url are plaintext metadata for listing and search.

CREATE TABLE IF NOT EXISTS "security_vault_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "core_users"("id") ON DELETE cascade,
	"parent_folder_id" uuid REFERENCES "security_vault_folders"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_folders_org" ON "security_vault_folders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_folders_user" ON "security_vault_folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_folders_parent" ON "security_vault_folders" USING btree ("parent_folder_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "security_vault_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "core_users"("id") ON DELETE cascade,
	"folder_id" uuid REFERENCES "security_vault_folders"("id") ON DELETE set null,
	"type" text DEFAULT 'login' NOT NULL,
	"title" text NOT NULL,
	"username" text,
	"url" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"password_encrypted" text,
	"notes_encrypted" text,
	"extra_encrypted" text,
	"last_password_change_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_items_org" ON "security_vault_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_items_user" ON "security_vault_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_items_folder" ON "security_vault_items" USING btree ("folder_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "security_vault_item_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"item_id" uuid NOT NULL REFERENCES "security_vault_items"("id") ON DELETE cascade,
	"password_encrypted" text NOT NULL,
	"changed_by_id" uuid REFERENCES "core_users"("id") ON DELETE set null,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_item_history_item" ON "security_vault_item_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_item_history_org" ON "security_vault_item_history" USING btree ("org_id");
