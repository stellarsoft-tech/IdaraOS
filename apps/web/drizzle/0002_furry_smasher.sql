ALTER TABLE "people_persons" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "entra_id" text;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "entra_group_id" text;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "entra_group_name" text;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_people_persons_source" ON "people_persons" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_people_persons_entra_id" ON "people_persons" USING btree ("entra_id");