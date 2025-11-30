/**
 * Database Schema - Central export
 * All table definitions are exported from here
 */

export * from "./organizations"
export * from "./users"
export * from "./people"
// Export rbac except UserRole to avoid conflict with users.ts
export { 
  modules, 
  actions, 
  permissions, 
  roles, 
  rolePermissions, 
  userRoles,
  modulesRelations,
  actionsRelations,
  permissionsRelations,
  rolesRelations,
  rolePermissionsRelations,
  userRolesRelations,
  type Module,
  type NewModule,
  type Action,
  type NewAction,
  type Permission,
  type NewPermission,
  type Role,
  type NewRole,
  type RolePermission,
  type NewRolePermission,
  type UserRole as RbacUserRole,
  type NewUserRole,
} from "./rbac"
export * from "./integrations"
export * from "./scim"
