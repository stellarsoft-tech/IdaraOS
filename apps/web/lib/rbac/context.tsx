"use client"

import * as React from "react"
import type { User } from "./types"

interface RBACContextValue {
  user: User | null
  isLoading: boolean
}

const RBACContext = React.createContext<RBACContextValue>({
  user: null,
  isLoading: true,
})

/**
 * RBAC Provider - wraps app to provide user context
 */
export function RBACProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  
  React.useEffect(() => {
    // TODO: Fetch current user from API
    // For now, mock a user
    setTimeout(() => {
      setUser({
        id: "1",
        name: "Demo User",
        email: "demo@example.com",
        role: "Admin",
        orgId: "org-1",
      })
      setIsLoading(false)
    }, 100)
  }, [])
  
  return (
    <RBACContext.Provider value={{ user, isLoading }}>
      {children}
    </RBACContext.Provider>
  )
}

/**
 * Hook to access current user
 */
export function useUser() {
  const context = React.useContext(RBACContext)
  if (!context) {
    throw new Error("useUser must be used within RBACProvider")
  }
  return context
}

