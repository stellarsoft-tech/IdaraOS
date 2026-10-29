CREATE TABLE IF NOT EXISTS "security_training_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"library_key" text,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"lesson" jsonb,
	"video_url" text,
	"video_duration_minutes" integer,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_training_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option_index" integer NOT NULL,
	"explanation" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_training_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"video_completed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_score" integer,
	"best_score" integer,
	"passed_at" timestamp with time zone,
	"assigned_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_training_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"correct_count" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"passing_score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"answers" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_training_courses" ADD CONSTRAINT "security_training_courses_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_courses" ADD CONSTRAINT "security_training_courses_created_by_id_core_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_questions" ADD CONSTRAINT "security_training_questions_course_id_security_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."security_training_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_assignments" ADD CONSTRAINT "security_training_assignments_org_id_core_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."core_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_assignments" ADD CONSTRAINT "security_training_assignments_course_id_security_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."security_training_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_assignments" ADD CONSTRAINT "security_training_assignments_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_assignments" ADD CONSTRAINT "security_training_assignments_assigned_by_id_core_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_attempts" ADD CONSTRAINT "security_training_attempts_assignment_id_security_training_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."security_training_assignments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_training_attempts" ADD CONSTRAINT "security_training_attempts_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_courses_org" ON "security_training_courses" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_courses_status" ON "security_training_courses" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_training_courses_library_key" ON "security_training_courses" USING btree ("org_id","library_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_questions_course" ON "security_training_questions" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_assignments_org" ON "security_training_assignments" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_assignments_user" ON "security_training_assignments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_assignments_status" ON "security_training_assignments" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_security_training_assignments_course_user" ON "security_training_assignments" USING btree ("course_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_attempts_assignment" ON "security_training_attempts" USING btree ("assignment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_training_attempts_user" ON "security_training_attempts" USING btree ("user_id");
