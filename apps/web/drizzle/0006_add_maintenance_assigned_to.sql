-- Add assignedToId column to maintenance records for linking to people
ALTER TABLE "assets_maintenance_records" ADD COLUMN "assigned_to_id" uuid;

-- Add foreign key constraint
ALTER TABLE "assets_maintenance_records" ADD CONSTRAINT "assets_maintenance_records_assigned_to_id_people_persons_id_fk" 
  FOREIGN KEY ("assigned_to_id") REFERENCES "people_persons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_assets_maintenance_assigned" ON "assets_maintenance_records" ("assigned_to_id");

