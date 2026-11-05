-- BitLocker recovery-key escrow (IdaraOS Agent "bitlocker" policy).
-- Hand-written and idempotent, matching this repo's migration convention (see 0020).
-- recovery_key_encrypted holds the 48-digit recovery password encrypted at rest (lib/encryption.ts).

CREATE TABLE IF NOT EXISTS "security_device_bitlocker_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL REFERENCES "core_organizations"("id") ON DELETE cascade,
	"device_id" uuid NOT NULL REFERENCES "security_software_update_devices"("id") ON DELETE cascade,
	"volume" text NOT NULL,
	"recovery_key_id" text,
	"recovery_key_encrypted" text NOT NULL,
	"encryption_method" text,
	"protection_on" boolean DEFAULT false NOT NULL,
	"encryption_percentage" integer,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_device_bitlocker_keys_device" ON "security_device_bitlocker_keys" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_device_bitlocker_keys_device_volume" ON "security_device_bitlocker_keys" USING btree ("device_id","volume");
