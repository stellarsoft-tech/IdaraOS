-- Migration: Add Workflow Settings to People Settings
-- Adds columns for auto-triggering onboarding/offboarding workflows

-- Add workflow settings columns to people_settings table
ALTER TABLE "people_settings" 
  ADD COLUMN IF NOT EXISTS "auto_onboarding_workflow" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "default_onboarding_workflow_template_id" uuid REFERENCES "workflow_templates"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "auto_offboarding_workflow" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "default_offboarding_workflow_template_id" uuid REFERENCES "workflow_templates"("id") ON DELETE SET NULL;

-- Create indexes for the foreign keys
CREATE INDEX IF NOT EXISTS "idx_people_settings_onboarding_template" 
  ON "people_settings"("default_onboarding_workflow_template_id");
CREATE INDEX IF NOT EXISTS "idx_people_settings_offboarding_template" 
  ON "people_settings"("default_offboarding_workflow_template_id");

