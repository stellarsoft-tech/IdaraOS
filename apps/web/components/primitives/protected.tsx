"use client"

import * as React from "react"
import { useUser } from "@/lib/rbac/context"
import { AlertCircle } from "lucide-react"

interface ProtectedProps {
  /**
   * Module slug to check permission for (e.g., "people.directory", "settings.users")
   */
  module: string

  /**
   * Action to check (default: "view")
   */
  action?: string

  /**
   * Multiple actions - requires ANY of them to be allowed
   */
  anyAction?: string[]

  /**
   * Multiple actions - requires ALL of them to be allowed
   */
  allActions?: string[]

  /**
   * Content to render if user has permission
   */
  children: React.ReactNode

  /**
   * Content to render if user lacks permission (default: nothing)
   */
  fallback?: React.ReactNode

  /**
   * If true, show an access denied message instead of nothing
   */
  showDenied?: boolean
}

/**
 * Protected component - conditionally renders content based on user permissions
 * 
 * Usage:
 * ```tsx
 * <Protected module="people.directory" action="edit">
 *   <Button>Edit Person</Button>
 * </Protected>
 * 
 * <Protected module="settings.users" anyAction={["create", "edit"]}>
 *   <Button>Manage Users</Button>
 * </Protected>
 * ```
 */
export function Protected({
  module,
  action = "view",
  anyAction,
  allActions,
  children,
  fallback,
  showDenied = false,
}: ProtectedProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = useUser()

  // Still loading permissions
  if (isLoading) {
    return null
  }

  // Check permissions based on props
  let hasAccess = false

  if (anyAction && anyAction.length > 0) {
    hasAccess = hasAnyPermission(module, anyAction)
  } else if (allActions && allActions.length > 0) {
    hasAccess = hasAllPermissions(module, allActions)
  } else {
    hasAccess = hasPermission(module, action)
  }

  // User has access
  if (hasAccess) {
    return <>{children}</>
  }

  // User lacks access - show fallback or denied message
  if (fallback) {
    return <>{fallback}</>
  }

  if (showDenied) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>You don&apos;t have permission to access this feature.</span>
      </div>
    )
  }

  // Default: render nothing
  return null
}

/**
 * Hook version for more complex permission logic
 */
export function useProtected(module: string, action: string = "view"): boolean {
  const { hasPermission, isLoading } = useUser()
  
  if (isLoading) {
    return false
  }
  
  return hasPermission(module, action)
}

/**
 * Access Denied page component for route-level protection
 */
export function AccessDenied({
  title = "Access Denied",
  description = "You don't have permission to access this page.",
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
