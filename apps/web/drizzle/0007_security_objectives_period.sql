ALTER TABLE "security_objectives" ADD COLUMN "period_label" text;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD COLUMN "period_start" date;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD COLUMN "period_end" date;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD COLUMN "achievement_status" text DEFAULT 'not_measured' NOT NULL;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD COLUMN "linked_evidence_ids" jsonb;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD COLUMN "linked_document_ids" jsonb;--> statement-breakpoint
ALTER TABLE "security_objectives" ADD COLUMN "framework_code" text;--> statement-breakpoint
CREATE INDEX "idx_security_objectives_period_label" ON "security_objectives" USING btree ("period_label");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_achievement_status" ON "security_objectives" USING btree ("achievement_status");--> statement-breakpoint
CREATE INDEX "idx_security_objectives_framework_code" ON "security_objectives" USING btree ("framework_code");
