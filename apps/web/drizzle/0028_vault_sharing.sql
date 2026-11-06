-- Vault Phase 3: sharing. Reusable groups + item/folder shares to members or groups (ACL-based,
-- server-side decryption, so no key wrapping). Hand-written, idempotent.

CREATE TABLE IF NOT EXISTS "security_vault_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"created_by_id" uuid REFERENCES "core_users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_groups_org" ON "security_vault_groups" USING btree ("org_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "security_vault_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"group_id" uuid NOT NULL REFERENCES "security_vault_groups"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "core_users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_vault_group_members_unique" ON "security_vault_group_members" USING btree ("group_id", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_group_members_user" ON "security_vault_group_members" USING btree ("user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "security_vault_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"item_id" uuid REFERENCES "security_vault_items"("id") ON DELETE cascade,
	"folder_id" uuid REFERENCES "security_vault_folders"("id") ON DELETE cascade,
	"target_user_id" uuid REFERENCES "core_users"("id") ON DELETE cascade,
	"target_group_id" uuid REFERENCES "security_vault_groups"("id") ON DELETE cascade,
	"permission" text DEFAULT 'view' NOT NULL,
	"shared_by_id" uuid REFERENCES "core_users"("id") ON DELETE set null,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_shares_org" ON "security_vault_shares" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_shares_item" ON "security_vault_shares" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_shares_folder" ON "security_vault_shares" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_shares_target_user" ON "security_vault_shares" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_vault_shares_target_group" ON "security_vault_shares" USING btree ("target_group_id");
