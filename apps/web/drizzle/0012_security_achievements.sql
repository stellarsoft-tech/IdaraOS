CREATE TABLE "security_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"achievement_date" date NOT NULL,
	"period_label" text,
	"period_start" date,
	"period_end" date,
	"evidence_required" boolean DEFAULT false NOT NULL,
	"linked_evidence_ids" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_achievements" ADD CONSTRAINT "security_achievements_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_security_achievements_org" ON "security_achievements" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_security_achievements_date" ON "security_achievements" USING btree ("achievement_date");
--> statement-breakpoint
CREATE INDEX "idx_security_achievements_period_label" ON "security_achievements" USING btree ("period_label");
