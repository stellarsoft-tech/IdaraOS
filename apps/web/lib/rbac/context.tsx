"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"

// ============ Types ============

export interface User {
  id: string
  name: string
  email: string
  orgId: string
  avatar?: string | null
}

export interface UserPermissions {
  roleIds: string[]
  permissionMap: Record<string, Record<string, boolean>>
}

interface RBACContextValue {
  user: User | null
  permissions: UserPermissions | null
  isLoading: boolean
  error: Error | null
  isAuthenticated: boolean
  logout: () => Promise<void>
  hasPermission: (module: string, action: string) => boolean
  hasAnyPermission: (module: string, actions: string[]) => boolean
  hasAllPermissions: (module: string, actions: string[]) => boolean
  canAccess: (module: string) => boolean
  refreshPermissions: () => Promise<void>
}

const RBACContext = React.createContext<RBACContextValue>({
  user: null,
  permissions: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  logout: async () => {},
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  canAccess: () => false,
  refreshPermissions: async () => {},
})

// Pages that don't require authentication
const PUBLIC_PATHS = ["/login", "/setup", "/forgot-password"]

/**
 * RBAC Provider - wraps app to provide user context, permissions, and auth state
 */
export function RBACProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = React.useState<User | null>(null)
  const [permissions, setPermissions] = React.useState<UserPermissions | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  // Check if current path is public
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname?.startsWith(path))

  // Fetch permissions from database
  const fetchPermissions = React.useCallback(async () => {
    try {
      const response = await fetch("/api/rbac/user-permissions")
      if (response.ok) {
        const data = await response.json()
        setPermissions(data)
      }
    } catch (err) {
      console.error("Error fetching permissions:", err)
    }
  }, [])

  // Fetch current user on mount
  React.useEffect(() => {
    async function fetchCurrentUser() {
      // Skip auth check for public pages
      if (isPublicPath) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch("/api/auth/me")

        if (!response.ok) {
          // Not authenticated - redirect to login
          if (response.status === 401) {
            router.push("/login")
            return
          }
          throw new Error("Failed to fetch user")
        }

        const data = await response.json()
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          orgId: data.orgId,
          avatar: data.avatar,
        })

        // Fetch permissions after user is loaded
        await fetchPermissions()
      } catch (err) {
        console.error("Error fetching current user:", err)
        setError(err instanceof Error ? err : new Error("Unknown error"))
        // Redirect to login on error
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCurrentUser()
  }, [pathname, isPublicPath, router, fetchPermissions])

  // Logout function
  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      setPermissions(null)
      router.push("/login")
      router.refresh()
    } catch (err) {
      console.error("Logout error:", err)
    }
  }, [router])

  // Permission check functions
  const hasPermission = React.useCallback(
    (module: string, action: string): boolean => {
      if (!permissions?.permissionMap) {
        return false
      }
      return permissions.permissionMap[module]?.[action] === true
    },
    [permissions]
  )

  const hasAnyPermission = React.useCallback(
    (module: string, actions: string[]): boolean => {
      return actions.some((action) => hasPermission(module, action))
    },
    [hasPermission]
  )

  const hasAllPermissions = React.useCallback(
    (module: string, actions: string[]): boolean => {
      return actions.every((action) => hasPermission(module, action))
    },
    [hasPermission]
  )

  const canAccess = React.useCallback(
    (module: string): boolean => {
      return hasPermission(module, "view")
    },
    [hasPermission]
  )

  const refreshPermissions = React.useCallback(async () => {
    await fetchPermissions()
  }, [fetchPermissions])

  // Show nothing while checking auth on protected pages
  if (isLoading && !isPublicPath) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <RBACContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        error,
        isAuthenticated: !!user,
        logout,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        canAccess,
        refreshPermissions,
      }}
    >
      {children}
    </RBACContext.Provider>
  )
}

/**
 * Hook to access current user and permissions
 */
export function useUser() {
  const context = React.useContext(RBACContext)
  if (!context) {
    throw new Error("useUser must be used within RBACProvider")
  }
  return context
}

/**
 * Hook to check permissions
 */
export function usePermission(module: string, action: string = "view"): boolean {
  const { hasPermission } = useUser()
  return hasPermission(module, action)
}

/**
 * Hook to check if user can access a module (has view permission)
 */
export function useCanAccess(module: string): boolean {
  const { canAccess } = useUser()
  return canAccess(module)
}
