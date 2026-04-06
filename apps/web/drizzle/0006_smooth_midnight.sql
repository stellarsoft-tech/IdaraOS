ALTER TABLE "docs_settings" ADD COLUMN "content_storage_mode" text DEFAULT 'database' NOT NULL;--> statement-breakpoint
ALTER TABLE "docs_settings" ADD COLUMN "default_file_category_id" uuid;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD COLUMN "storage_mode" text;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD COLUMN "file_id" uuid;--> statement-breakpoint
ALTER TABLE "docs_settings" ADD CONSTRAINT "docs_settings_default_file_category_id_core_file_categories_id_fk" FOREIGN KEY ("default_file_category_id") REFERENCES "public"."core_file_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_documents" ADD CONSTRAINT "docs_documents_file_id_core_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."core_files"("id") ON DELETE set null ON UPDATE no action;