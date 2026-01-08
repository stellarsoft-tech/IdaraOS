ALTER TABLE "workflow_template_steps" ADD COLUMN "attachments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD COLUMN "file_category_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD COLUMN "file_path_prefix" text;--> statement-breakpoint
ALTER TABLE "workflow_template_steps" ADD CONSTRAINT "workflow_template_steps_file_category_id_core_file_categories_id_fk" FOREIGN KEY ("file_category_id") REFERENCES "public"."core_file_categories"("id") ON DELETE set null ON UPDATE no action;