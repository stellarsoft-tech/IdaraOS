/**
 * RBAC type definitions
 * 
 * These types are used throughout the application for permission checking.
 * The actual permission data is stored in the database and managed through
 * the RBAC API and context.
 */

/**
 * Standard actions that can be performed on any module
 */
export type ActionType = "view" | "create" | "edit" | "delete"

/**
 * Legacy action type for backwards compatibility
 */
export type Action = "read" | "write" | ActionType

/**
 * Legacy role type for permissions.ts backwards compatibility
 */
export type RoleType = "Owner" | "Admin" | "HR" | "Security" | "Auditor" | "IT" | "User"

/**
 * User information stored in context
 */
export interface User {
  id: string
  name: string
  email: string
  orgId: string
  avatar?: string | null
  role?: RoleType // Optional role for backwards compatibility
}

/**
 * Permission map structure
 * Keys are module slugs, values are action -> boolean maps
 */
export type PermissionMap = Record<string, Record<string, boolean>>

/**
 * User permissions from the database
 */
export interface UserPermissions {
  roleIds: string[]
  permissionMap: PermissionMap
}

/**
 * Role information
 */
export interface Role {
  id: string
  slug: string
  name: string
  description: string | null
  color: string | null
  isSystem: boolean
  isDefault: boolean
}

/**
 * Module information
 */
export interface Module {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  icon: string | null
}

/**
 * Permission - a module + action combination (database format)
 */
export interface Permission {
  id: string
  moduleSlug: string
  moduleName: string
  moduleCategory: string
  actionSlug: string
  actionName: string
}

/**
 * Legacy permission format for static permissions.ts
 */
export interface LegacyPermission {
  resource: string
  actions: string[]
  roles: RoleType[]
  scope: "org" | "user"
}
