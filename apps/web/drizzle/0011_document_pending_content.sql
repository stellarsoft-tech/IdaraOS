ALTER TABLE "docs_documents" ADD COLUMN IF NOT EXISTS "pending_content" text;
ALTER TABLE "docs_documents" ADD COLUMN IF NOT EXISTS "pending_version" text;
