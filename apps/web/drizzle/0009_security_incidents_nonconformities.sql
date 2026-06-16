CREATE TABLE "security_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"incident_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"classification" text DEFAULT 'incident' NOT NULL,
	"severity" text DEFAULT 'p3' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"publication_status" text DEFAULT 'draft' NOT NULL,
	"current_version" text DEFAULT '1.0' NOT NULL,
	"owner_id" uuid,
	"reported_by_id" uuid,
	"approved_by_id" uuid,
	"linked_evidence_ids" jsonb,
	"detected_at" timestamp with time zone,
	"reported_at" timestamp with time zone,
	"contained_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"impact_description" text,
	"containment_actions" text,
	"eradication_actions" text,
	"recovery_actions" text,
	"root_cause_analysis" text,
	"lessons_learned" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_incident_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"version" text NOT NULL,
	"change_description" text,
	"snapshot" jsonb NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_nonconformities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"nc_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"severity" text DEFAULT 'minor' NOT NULL,
	"source" text DEFAULT 'other' NOT NULL,
	"document_category" text,
	"linked_document_id" uuid,
	"owner_id" uuid,
	"linked_evidence_ids" jsonb,
	"root_cause_analysis" text,
	"corrective_action" text,
	"corrective_action_due_date" date,
	"effectiveness_review" text,
	"effectiveness_verified_at" timestamp with time zone,
	"effectiveness_verified_by_id" uuid,
	"detected_at" date,
	"due_date" date,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_incident_versions" ADD CONSTRAINT "security_incident_versions_incident_id_security_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."security_incidents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_incident_versions" ADD CONSTRAINT "security_incident_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_nonconformities" ADD CONSTRAINT "security_nonconformities_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_nonconformities" ADD CONSTRAINT "security_nonconformities_linked_document_id_docs_documents_id_fk" FOREIGN KEY ("linked_document_id") REFERENCES "public"."docs_documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_nonconformities" ADD CONSTRAINT "security_nonconformities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_nonconformities" ADD CONSTRAINT "security_nonconformities_effectiveness_verified_by_id_users_id_fk" FOREIGN KEY ("effectiveness_verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_security_incidents_org" ON "security_incidents" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_security_incidents_incident_id" ON "security_incidents" USING btree ("incident_id");
--> statement-breakpoint
CREATE INDEX "idx_security_incidents_status" ON "security_incidents" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_security_incidents_severity" ON "security_incidents" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX "idx_security_incidents_owner" ON "security_incidents" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX "idx_security_incidents_publication" ON "security_incidents" USING btree ("publication_status");
--> statement-breakpoint
CREATE INDEX "idx_security_incident_versions_incident" ON "security_incident_versions" USING btree ("incident_id");
--> statement-breakpoint
CREATE INDEX "idx_security_nc_org" ON "security_nonconformities" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_security_nc_nc_id" ON "security_nonconformities" USING btree ("nc_id");
--> statement-breakpoint
CREATE INDEX "idx_security_nc_status" ON "security_nonconformities" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_security_nc_category" ON "security_nonconformities" USING btree ("document_category");
--> statement-breakpoint
CREATE INDEX "idx_security_nc_document" ON "security_nonconformities" USING btree ("linked_document_id");
--> statement-breakpoint
CREATE INDEX "idx_security_nc_owner" ON "security_nonconformities" USING btree ("owner_id");
