-- Website access requests: time-boxed exceptions to web content filtering.
-- Idempotent (safe to re-run): matches lib/db/schema/security-web-access.ts.

CREATE TABLE IF NOT EXISTS "security_web_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"requester_id" uuid NOT NULL REFERENCES "core_users"("id") ON DELETE cascade,
	"domain" text NOT NULL,
	"reason" text,
	"requested_minutes" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid REFERENCES "core_users"("id") ON DELETE set null,
	"decided_at" timestamptz,
	"decision_note" text,
	"expires_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_security_web_access_org" ON "security_web_access_requests" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_security_web_access_requester" ON "security_web_access_requests" ("requester_id");
CREATE INDEX IF NOT EXISTS "idx_security_web_access_status" ON "security_web_access_requests" ("status");
