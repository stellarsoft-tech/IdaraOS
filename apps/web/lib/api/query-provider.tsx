"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

/**
 * Handle 401 errors globally - clear session and redirect to login
 */
async function handleUnauthorized() {
  // Check if we're already on the login page to prevent redirect loops
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    console.log("Unauthorized response detected, clearing session and redirecting to login...")
    // Clear the session cookie first to prevent middleware redirect loop
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Ignore errors, still redirect
    }
    window.location.href = "/login"
  }
}

/**
 * Check if error is a 401 unauthorized error
 */
function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check if it's a fetch error with status 401
    if ("status" in error && (error as { status: number }).status === 401) {
      return true
    }
    // Check error message
    if (error.message.includes("401") || error.message.includes("Unauthorized") || error.message.includes("Not authenticated")) {
      return true
    }
  }
  return false
}

/**
 * Create Query Client with global error handling
 */
function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthorizedError(error)) {
          handleUnauthorized()
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isUnauthorizedError(error)) {
          handleUnauthorized()
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't retry on 401 errors
          if (isUnauthorizedError(error)) {
            return false
          }
          return failureCount < 1
        },
      },
      mutations: {
        retry: (failureCount, error) => {
          // Don't retry on 401 errors
          if (isUnauthorizedError(error)) {
            return false
          }
          return failureCount < 1
        },
      },
    },
  })
}

/**
 * Query Provider for the app
 * Wrap your app with this component to enable React Query
 * Includes global 401 handling to redirect to login on unauthorized errors
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => createQueryClient())
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  )
}

