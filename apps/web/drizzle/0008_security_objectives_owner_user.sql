-- Point security_objectives.owner_id at users instead of people_persons
UPDATE "security_objectives" AS so
SET "owner_id" = u."id"
FROM "users" AS u
WHERE so."owner_id" IS NOT NULL
  AND u."person_id" = so."owner_id"
  AND u."org_id" = so."org_id";
--> statement-breakpoint
UPDATE "security_objectives" AS so
SET "owner_id" = NULL
WHERE so."owner_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "users" AS u
    WHERE u."id" = so."owner_id"
      AND u."org_id" = so."org_id"
  );
--> statement-breakpoint
ALTER TABLE "security_objectives" DROP CONSTRAINT "security_objectives_owner_id_people_persons_id_fk";
--> statement-breakpoint
ALTER TABLE "security_objectives" ADD CONSTRAINT "security_objectives_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
