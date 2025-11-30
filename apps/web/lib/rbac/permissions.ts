/**
 * Permission definitions per resource
 * This should match the permissions defined in spec.json files
 */

import type { Role, Permission } from "./types"

export const permissions: Record<string, Permission> = {
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
  "assets.inventory": {
    resource: "assets.inventory",
    actions: ["read", "write"],
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
}

/**
 * Check if role has permission for action on resource
 */
export function hasPermission(
  role: Role,
  resource: string,
  action: string = "read"
): boolean {
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
  
  return permission.roles.includes(role) && permission.actions.includes(action as any)
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  if (role === "Owner") {
    return Object.values(permissions)
  }
  
  return Object.values(permissions).filter((p) => p.roles.includes(role))
}

