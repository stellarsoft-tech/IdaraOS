-- Device location (public IP) + compliance internet quarantine. Hand-written and idempotent.

ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "last_public_ip" text;--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "non_compliant_since" timestamptz;--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamptz;--> statement-breakpoint
ALTER TABLE "security_software_update_devices" ADD COLUMN IF NOT EXISTS "quarantine_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "security_software_update_settings" ADD COLUMN IF NOT EXISTS "quarantine_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "security_software_update_settings" ADD COLUMN IF NOT EXISTS "quarantine_grace_days" integer DEFAULT 3 NOT NULL;
