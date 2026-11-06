-- Website block events: attempts to reach a site the web-filtering policy blocks (agent-reported).
-- Idempotent; matches lib/db/schema/security-web-block.ts.

CREATE TABLE IF NOT EXISTS "security_web_block_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"device_id" uuid NOT NULL REFERENCES "security_software_update_devices"("id") ON DELETE cascade,
	"domain" text NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamptz DEFAULT now() NOT NULL,
	"last_seen_at" timestamptz DEFAULT now() NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_security_web_block_device_domain" ON "security_web_block_events" ("device_id","domain");
CREATE INDEX IF NOT EXISTS "idx_security_web_block_device" ON "security_web_block_events" ("device_id");
CREATE INDEX IF NOT EXISTS "idx_security_web_block_org" ON "security_web_block_events" ("org_id");
