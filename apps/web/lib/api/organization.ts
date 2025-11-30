/**
 * Organization API Client
 * React Query hooks for organization settings
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Organization } from "@/lib/db/schema"

// Query keys
export const organizationKeys = {
  all: ["organization"] as const,
  current: () => [...organizationKeys.all, "current"] as const,
}

// API response type
type OrganizationResponse = Omit<Organization, "createdAt" | "updatedAt"> & {
  createdAt: string
  updatedAt: string
}

// Update type
export type UpdateOrganization = Partial<{
  name: string
  domain: string | null
  logo: string | null
  appName: string
  // Social & professional links
  linkedIn: string | null
  twitter: string | null
  youtube: string | null
  timezone: string
  dateFormat: string
  currency: string
  settings: Record<string, unknown>
}>

const API_BASE = "/api/settings/organization"

/**
 * Fetch current organization
 */
async function fetchOrganization(): Promise<OrganizationResponse> {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error("Failed to fetch organization")
  return res.json()
}

/**
 * Update organization
 */
async function updateOrganization(data: UpdateOrganization): Promise<OrganizationResponse> {
  const res = await fetch(API_BASE, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update organization" }))
    throw new Error(error.error || "Failed to update organization")
  }
  return res.json()
}

// React Query Hooks

export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.current(),
    queryFn: fetchOrganization,
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.current() })
    },
  })
}

