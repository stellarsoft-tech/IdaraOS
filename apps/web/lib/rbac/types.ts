/**
 * RBAC type definitions
 */

export type Role = "Owner" | "Admin" | "HR" | "Security" | "Auditor" | "User"

export type Action = "read" | "write" | "delete" | "admin"

export interface User {
  id: string
  name: string
  email: string
  role: Role
  orgId: string
}

export interface Permission {
  resource: string
  actions: Action[]
  roles: Role[]
  scope?: "org" | "user" | "global"
}

