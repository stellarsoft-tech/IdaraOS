-- Add additional Entra sync fields to people_persons table
ALTER TABLE "people_persons" ADD COLUMN "entra_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "hire_date" date;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "last_sign_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people_persons" ADD COLUMN "last_password_change_at" timestamp with time zone;
