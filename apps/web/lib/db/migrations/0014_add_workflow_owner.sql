-- Add owner fields to workflow templates and instances
-- Allows setting a default owner on templates that carries over to instances

-- Add default owner to workflow templates
ALTER TABLE workflow_templates 
ADD COLUMN IF NOT EXISTS default_owner_id UUID REFERENCES people_persons(id) ON DELETE SET NULL;

-- Add owner to workflow instances  
ALTER TABLE workflow_instances 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES people_persons(id) ON DELETE SET NULL;

-- Add index for owner lookups
CREATE INDEX IF NOT EXISTS idx_workflow_instances_owner ON workflow_instances(owner_id);

