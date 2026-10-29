CREATE TABLE "people_access_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"business_justification" text NOT NULL,
	"access_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"iso_controls" jsonb DEFAULT '["A.5.15","A.5.18"]'::jsonb NOT NULL,
	"owner_person_id" uuid,
	"review_frequency" text DEFAULT 'quarterly' NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_access_group_roles" (
	"access_group_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_access_group_roles_pk" PRIMARY KEY("access_group_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "people_access_group_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"access_group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid,
	"granted_by_person_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_due_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"review_status" text DEFAULT 'not_reviewed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people_access_groups" ADD CONSTRAINT "people_access_groups_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_groups" ADD CONSTRAINT "people_access_groups_owner_person_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_group_roles" ADD CONSTRAINT "people_access_group_roles_group_id_fk" FOREIGN KEY ("access_group_id") REFERENCES "public"."people_access_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_group_roles" ADD CONSTRAINT "people_access_group_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."people_organizational_roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_group_assignments" ADD CONSTRAINT "people_access_assignments_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_group_assignments" ADD CONSTRAINT "people_access_assignments_group_id_fk" FOREIGN KEY ("access_group_id") REFERENCES "public"."people_access_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_group_assignments" ADD CONSTRAINT "people_access_assignments_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_group_assignments" ADD CONSTRAINT "people_access_assignments_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people_access_group_assignments" ADD CONSTRAINT "people_access_assignments_granted_by_fk" FOREIGN KEY ("granted_by_person_id") REFERENCES "public"."people_persons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_people_access_groups_org" ON "people_access_groups" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_groups_status" ON "people_access_groups" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_people_access_groups_owner" ON "people_access_groups" USING btree ("owner_person_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_group_roles_group" ON "people_access_group_roles" USING btree ("access_group_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_group_roles_role" ON "people_access_group_roles" USING btree ("role_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_assignments_org" ON "people_access_group_assignments" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_assignments_group" ON "people_access_group_assignments" USING btree ("access_group_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_assignments_user" ON "people_access_group_assignments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_assignments_person" ON "people_access_group_assignments" USING btree ("person_id");
--> statement-breakpoint
CREATE INDEX "idx_people_access_assignments_review" ON "people_access_group_assignments" USING btree ("review_status");
