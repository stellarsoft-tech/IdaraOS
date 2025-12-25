ALTER TABLE "people_settings" ADD COLUMN "auto_onboarding_workflow" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people_settings" ADD COLUMN "default_onboarding_workflow_template_id" uuid;--> statement-breakpoint
ALTER TABLE "people_settings" ADD COLUMN "auto_offboarding_workflow" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people_settings" ADD COLUMN "default_offboarding_workflow_template_id" uuid;