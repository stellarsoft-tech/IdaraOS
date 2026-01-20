CREATE TABLE "people_organizational_role_teams" (
	"role_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_organizational_role_teams_role_id_team_id_pk" PRIMARY KEY("role_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "people_organizational_role_teams" ADD CONSTRAINT "people_organizational_role_teams_role_id_people_organizational_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."people_organizational_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_organizational_role_teams" ADD CONSTRAINT "people_organizational_role_teams_team_id_people_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."people_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_role_teams_role" ON "people_organizational_role_teams" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_org_role_teams_team" ON "people_organizational_role_teams" USING btree ("team_id");