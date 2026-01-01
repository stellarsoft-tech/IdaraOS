/**
 * Permission definitions per resource
 */

import type { RoleType, LegacyPermission } from "./types"

export const permissions: Record<string, LegacyPermission> = {
  // People module
  "people.person": {
    resource: "people.person",
    actions: ["read", "write"],
    roles: ["HR", "Admin", "Owner"],
    scope: "org",
  },
  "people.roles": {
    resource: "people.roles",
    actions: ["read", "write"],
    roles: ["HR", "Admin", "Owner"],
    scope: "org",
  },
  
  // Security module
  "security.risk": {
    resource: "security.risk",
    actions: ["read"],
    roles: ["Security", "Auditor", "Admin", "Owner"],
    scope: "org",
  },
  "security.risk.write": {
    resource: "security.risk",
    actions: ["write"],
    roles: ["Security", "Admin", "Owner"],
    scope: "org",
  },
  "security.control": {
    resource: "security.control",
    actions: ["read"],
    roles: ["Security", "Auditor", "Admin", "Owner"],
    scope: "org",
  },
  "security.control.write": {
    resource: "security.control",
    actions: ["write"],
    roles: ["Security", "Admin", "Owner"],
    scope: "org",
  },
  "security.audit": {
    resource: "security.audit",
    actions: ["read"],
    roles: ["Security", "Auditor", "Admin", "Owner"],
    scope: "org",
  },
  
  // Assets module
  "assets.overview": {
    resource: "assets.overview",
    actions: ["read"],
    roles: ["IT", "Admin", "Owner", "User"],
    scope: "org",
  },
  "assets.inventory": {
    resource: "assets.inventory",
    actions: ["read"],
    roles: ["IT", "Admin", "Owner", "User"],
    scope: "org",
  },
  "assets.inventory.write": {
    resource: "assets.inventory",
    actions: ["create", "edit"],
    roles: ["IT", "Admin", "Owner"],
    scope: "org",
  },
  "assets.inventory.delete": {
    resource: "assets.inventory",
    actions: ["delete"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "assets.categories": {
    resource: "assets.categories",
    actions: ["read"],
    roles: ["IT", "Admin", "Owner", "User"],
    scope: "org",
  },
  "assets.categories.write": {
    resource: "assets.categories",
    actions: ["create", "edit", "delete"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "assets.assignments": {
    resource: "assets.assignments",
    actions: ["read"],
    roles: ["IT", "Admin", "Owner", "User"],
    scope: "org",
  },
  "assets.assignments.write": {
    resource: "assets.assignments",
    actions: ["create", "edit"],
    roles: ["IT", "Admin", "Owner"],
    scope: "org",
  },
  "assets.maintenance": {
    resource: "assets.maintenance",
    actions: ["read"],
    roles: ["IT", "Admin", "Owner"],
    scope: "org",
  },
  "assets.maintenance.write": {
    resource: "assets.maintenance",
    actions: ["create", "edit"],
    roles: ["IT", "Admin", "Owner"],
    scope: "org",
  },
  "assets.lifecycle": {
    resource: "assets.lifecycle",
    actions: ["read"],
    roles: ["IT", "Admin", "Owner"],
    scope: "org",
  },
  "assets.settings": {
    resource: "assets.settings",
    actions: ["read"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "assets.settings.write": {
    resource: "assets.settings",
    actions: ["write"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  
  // Workflows module
  "workflows.overview": {
    resource: "workflows.overview",
    actions: ["read"],
    roles: ["User", "HR", "IT", "Admin", "Owner"],
    scope: "org",
  },
  "workflows.templates": {
    resource: "workflows.templates",
    actions: ["read"],
    roles: ["User", "HR", "IT", "Admin", "Owner"],
    scope: "org",
  },
  "workflows.templates.write": {
    resource: "workflows.templates",
    actions: ["create", "edit"],
    roles: ["HR", "Admin", "Owner"],
    scope: "org",
  },
  "workflows.templates.delete": {
    resource: "workflows.templates",
    actions: ["delete"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "workflows.instances": {
    resource: "workflows.instances",
    actions: ["read"],
    roles: ["User", "HR", "IT", "Admin", "Owner"],
    scope: "org",
  },
  "workflows.instances.write": {
    resource: "workflows.instances",
    actions: ["create", "edit"],
    roles: ["HR", "Admin", "Owner"],
    scope: "org",
  },
  "workflows.tasks": {
    resource: "workflows.tasks",
    actions: ["read"],
    roles: ["User", "HR", "IT", "Admin", "Owner"],
    scope: "org",
  },
  "workflows.tasks.write": {
    resource: "workflows.tasks",
    actions: ["edit"],
    roles: ["User", "HR", "IT", "Admin", "Owner"], // Users can complete their own tasks
    scope: "org",
  },
  "workflows.board": {
    resource: "workflows.board",
    actions: ["read"],
    roles: ["User", "HR", "IT", "Admin", "Owner"],
    scope: "org",
  },
  "workflows.settings": {
    resource: "workflows.settings",
    actions: ["read"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "workflows.settings.write": {
    resource: "workflows.settings",
    actions: ["write"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  
  // Settings module
  "settings.organization": {
    resource: "settings.organization",
    actions: ["read", "write"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "settings.users": {
    resource: "settings.users",
    actions: ["read", "write"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "settings.integrations": {
    resource: "settings.integrations",
    actions: ["read", "write"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "settings.audit-log": {
    resource: "settings.audit-log",
    actions: ["read"],
    roles: ["Auditor", "Admin", "Owner"],
    scope: "org",
  },
  
  // Documentation module
  "docs.overview": {
    resource: "docs.overview",
    actions: ["read"],
    roles: ["User", "HR", "Security", "Auditor", "Admin", "Owner"],
    scope: "org",
  },
  "docs.documents": {
    resource: "docs.documents",
    actions: ["read"],
    roles: ["User", "HR", "Security", "Auditor", "Admin", "Owner"],
    scope: "org",
  },
  "docs.documents.all": {
    resource: "docs.documents",
    actions: ["read_all"],
    roles: ["HR", "Security", "Auditor", "Admin", "Owner"],
    scope: "org",
  },
  "docs.documents.write": {
    resource: "docs.documents",
    actions: ["create", "edit"],
    roles: ["HR", "Security", "Admin", "Owner"],
    scope: "org",
  },
  "docs.documents.delete": {
    resource: "docs.documents",
    actions: ["delete"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "docs.documents.publish": {
    resource: "docs.documents",
    actions: ["publish"],
    roles: ["HR", "Security", "Admin", "Owner"],
    scope: "org",
  },
  "docs.rollouts": {
    resource: "docs.rollouts",
    actions: ["read"],
    roles: ["HR", "Security", "Admin", "Owner"],
    scope: "org",
  },
  "docs.rollouts.write": {
    resource: "docs.rollouts",
    actions: ["create", "edit", "delete"],
    roles: ["HR", "Security", "Admin", "Owner"],
    scope: "org",
  },
  "docs.acknowledgments": {
    resource: "docs.acknowledgments",
    actions: ["read"],
    roles: ["HR", "Security", "Auditor", "Admin", "Owner"],
    scope: "org",
  },
  "docs.settings": {
    resource: "docs.settings",
    actions: ["read"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
  "docs.settings.write": {
    resource: "docs.settings",
    actions: ["write"],
    roles: ["Admin", "Owner"],
    scope: "org",
  },
}

/**
 * Check if role has permission for action on resource
 */
export function hasPermission(
  role: RoleType | undefined,
  resource: string,
  action: string = "read"
): boolean {
  // No role = no permission
  if (!role) {
    return false
  }
  
  // Owner has all permissions
  if (role === "Owner") {
    return true
  }
  
  // Check specific permission
  const permission = permissions[resource] || permissions[`${resource}.${action}`]
  
  if (!permission) {
    // No permission defined = default deny
    return false
  }
  
  return permission.roles.includes(role) && permission.actions.includes(action)
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: RoleType | undefined): LegacyPermission[] {
  if (!role) {
    return []
  }
  
  if (role === "Owner") {
    return Object.values(permissions)
  }
  
  return Object.values(permissions).filter((p) => p.roles.includes(role))
}
