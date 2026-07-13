-- ISO 27001:2022 audit findings: optional Evidence Store links + closed timestamp
ALTER TABLE "security_audit_findings" ADD COLUMN IF NOT EXISTS "linked_evidence_ids" jsonb;
--> statement-breakpoint
ALTER TABLE "security_audit_findings" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;
