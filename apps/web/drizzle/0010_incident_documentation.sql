ALTER TABLE "security_incidents" ADD COLUMN IF NOT EXISTS "document_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_document_id_docs_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."docs_documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_incidents_document" ON "security_incidents" USING btree ("document_id");
