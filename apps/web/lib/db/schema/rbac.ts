/**
 * RBAC Schema - Fine-grained Role-Based Access Control
 * 
 * This implements a database-driven permission system with:
 * - Modules: Areas of the application (people.directory, settings.users, etc.)
 * - Actions: Operations that can be performed (view, create, edit, delete)
 * - Permissions: Module + Action combinations
 * - Roles: Collections of permissions that can be assigned to users
 * - User Roles: Many-to-many relationship between users and roles
 */

import { pgTable, uuid, text, timestamp, boolean, index, unique, primaryKey } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"

/**
 * Modules table - defines areas/features of the application
 */
export const modules = pgTable(
  "rbac_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(), // e.g., "people.directory", "settings.users"
    name: text("name").notNull(), // e.g., "People Directory", "Users & Access"
    description: text("description"),
    category: text("category").notNull(), // e.g., "People & HR", "Settings", "Security"
    icon: text("icon"), // Lucide icon name
    sortOrder: text("sort_order").notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_rbac_modules_slug").on(table.slug),
    index("idx_rbac_modules_category").on(table.category),
  ]
)

/**
 * Actions table - operations that can be performed
 */
export const actions = pgTable(
  "rbac_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(), // e.g., "view", "create", "edit", "delete"
    name: text("name").notNull(), // e.g., "View", "Create", "Edit", "Delete"
    description: text("description"),
    sortOrder: text("sort_order").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_rbac_actions_slug").on(table.slug),
  ]
)

/**
 * Permissions table - module + action combinations
 */
export const permissions = pgTable(
  "rbac_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
    actionId: uuid("action_id").notNull().references(() => actions.id, { onDelete: "cascade" }),
    description: text("description"), // Optional override description
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_permission_module_action").on(table.moduleId, table.actionId),
    index("idx_rbac_permissions_module").on(table.moduleId),
    index("idx_rbac_permissions_action").on(table.actionId),
  ]
)

/**
 * Roles table - named collections of permissions
 */
export const roles = pgTable(
  "rbac_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(), // e.g., "owner", "admin", "hr-manager"
    name: text("name").notNull(), // e.g., "Owner", "Admin", "HR Manager"
    description: text("description"),
    color: text("color"), // For UI badges, e.g., "red", "blue", "green"
    isSystem: boolean("is_system").notNull().default(false), // Built-in roles can't be deleted
    isDefault: boolean("is_default").notNull().default(false), // Default role for new users
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_role_org_slug").on(table.orgId, table.slug),
    index("idx_rbac_roles_org").on(table.orgId),
    index("idx_rbac_roles_slug").on(table.slug),
  ]
)

/**
 * Role Permissions - many-to-many between roles and permissions
 */
export const rolePermissions = pgTable(
  "rbac_role_permissions",
  {
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    index("idx_rbac_role_permissions_role").on(table.roleId),
    index("idx_rbac_role_permissions_permission").on(table.permissionId),
  ]
)

/**
 * Role assignment source - how the role was assigned
 */
export const roleAssignmentSourceValues = ["manual", "scim"] as const
export type RoleAssignmentSource = (typeof roleAssignmentSourceValues)[number]

/**
 * User Roles - many-to-many between users and roles
 * Users can have multiple roles, permissions are combined (union)
 */
export const userRoles = pgTable(
  "rbac_user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    
    // Source of assignment - "manual" (UI/API) or "scim" (provisioned from Entra)
    // SCIM-assigned roles cannot be modified in the UI unless bidirectional sync is enabled
    source: text("source", { enum: roleAssignmentSourceValues }).notNull().default("manual"),
    
    // If assigned via SCIM, reference to the SCIM group that granted this role
    // This allows proper cleanup when group membership changes
    scimGroupId: uuid("scim_group_id"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index("idx_rbac_user_roles_user").on(table.userId),
    index("idx_rbac_user_roles_role").on(table.roleId),
    index("idx_rbac_user_roles_source").on(table.source),
    index("idx_rbac_user_roles_scim_group").on(table.scimGroupId),
  ]
)

// ============ Relations ============

export const modulesRelations = relations(modules, ({ many }) => ({
  permissions: many(permissions),
}))

export const actionsRelations = relations(actions, ({ many }) => ({
  permissions: many(permissions),
}))

export const permissionsRelations = relations(permissions, ({ one, many }) => ({
  module: one(modules, {
    fields: [permissions.moduleId],
    references: [modules.id],
  }),
  action: one(actions, {
    fields: [permissions.actionId],
    references: [actions.id],
  }),
  rolePermissions: many(rolePermissions),
}))

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.orgId],
    references: [organizations.id],
  }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}))

// ============ Type Exports ============

export type Module = typeof modules.$inferSelect
export type NewModule = typeof modules.$inferInsert

export type Action = typeof actions.$inferSelect
export type NewAction = typeof actions.$inferInsert

export type Permission = typeof permissions.$inferSelect
export type NewPermission = typeof permissions.$inferInsert

export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert

export type RolePermission = typeof rolePermissions.$inferSelect
export type NewRolePermission = typeof rolePermissions.$inferInsert

export type UserRole = typeof userRoles.$inferSelect
export type NewUserRole = typeof userRoles.$inferInsert
export type { RoleAssignmentSource }

