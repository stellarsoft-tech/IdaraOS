-- Migration: Add Workflow Modules to RBAC
-- This ensures workflow permissions appear in the roles/permissions UI

-- Insert workflow modules (if they don't already exist)
INSERT INTO rbac_modules (id, slug, name, description, category, icon, sort_order, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'workflows.overview', 'Workflows Overview', 'View workflows dashboard', 'Workflows', 'Workflow', '400', NOW(), NOW()),
  (gen_random_uuid(), 'workflows.templates', 'Workflow Templates', 'Manage workflow templates', 'Workflows', 'FileCode2', '401', NOW(), NOW()),
  (gen_random_uuid(), 'workflows.instances', 'Workflow Instances', 'View and manage running workflows', 'Workflows', 'Play', '402', NOW(), NOW()),
  (gen_random_uuid(), 'workflows.tasks', 'Workflow Tasks', 'View and complete assigned tasks', 'Workflows', 'CheckSquare', '403', NOW(), NOW()),
  (gen_random_uuid(), 'workflows.board', 'Workflow Board', 'Kanban board view of workflows', 'Workflows', 'Kanban', '404', NOW(), NOW()),
  (gen_random_uuid(), 'workflows.settings', 'Workflow Settings', 'Configure workflow module settings', 'Workflows', 'Settings', '405', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Create permissions for all workflow modules (module × action combinations)
INSERT INTO rbac_permissions (id, module_id, action_id, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  m.id,
  a.id,
  NOW(),
  NOW()
FROM rbac_modules m
CROSS JOIN rbac_actions a
WHERE m.slug LIKE 'workflows.%'
  AND NOT EXISTS (
    SELECT 1 FROM rbac_permissions p 
    WHERE p.module_id = m.id AND p.action_id = a.id
  );

-- Grant all workflow permissions to Owner role for all organizations
INSERT INTO rbac_role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  r.id,
  p.id,
  NOW()
FROM rbac_roles r
JOIN rbac_permissions p ON true
JOIN rbac_modules m ON p.module_id = m.id
WHERE r.slug = 'owner'
  AND m.slug LIKE 'workflows.%'
  AND NOT EXISTS (
    SELECT 1 FROM rbac_role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Also grant to Admin role
INSERT INTO rbac_role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  r.id,
  p.id,
  NOW()
FROM rbac_roles r
JOIN rbac_permissions p ON true
JOIN rbac_modules m ON p.module_id = m.id
WHERE r.slug = 'admin'
  AND m.slug LIKE 'workflows.%'
  AND NOT EXISTS (
    SELECT 1 FROM rbac_role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

