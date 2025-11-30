"use client"

import * as React from "react"
import { usePermission, useRole, useRoles, type Role } from "@/lib/rbac"

interface ProtectedProps {
  children: React.ReactNode
  resource?: string
  action?: string
  role?: Role
  roles?: Role[]
  fallback?: React.ReactNode
}

/**
 * Component that conditionally renders children based on permissions
 * 
 * @example
 * <Protected resource="security.risk" action="write">
 *   <Button>Edit Risk</Button>
 * </Protected>
 * 
 * @example
 * <Protected role="Admin">
 *   <AdminPanel />
 * </Protected>
 */
export function Protected({
  children,
  resource,
  action = "read",
  role,
  roles,
  fallback = null,
}: ProtectedProps) {
  const hasResourcePermission = usePermission(resource || "", action)
  const hasRole = useRole(role!)
  const hasAnyRole = useRoles(roles || [])
  
  // Determine if user has access
  let hasAccess = false
  
  if (resource) {
    hasAccess = hasResourcePermission
  } else if (role) {
    hasAccess = hasRole
  } else if (roles) {
    hasAccess = hasAnyRole
  }
  
  if (!hasAccess) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

