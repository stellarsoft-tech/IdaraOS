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
 * User information stored in context
 */
export interface User {
  id: string
  name: string
  email: string
  orgId: string
  avatar?: string | null
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
 * Permission - a module + action combination
 */
export interface Permission {
  id: string
  moduleSlug: string
  moduleName: string
  moduleCategory: string
  actionSlug: string
  actionName: string
}
