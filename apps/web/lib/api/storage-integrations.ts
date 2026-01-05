/**
 * Storage Integrations API Hooks
 * React Query hooks for managing storage integrations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

// Types
export interface StorageIntegration {
  id: string
  provider: "sharepoint" | "azure_blob" | "local"
  name: string
  description: string | null
  status: "connected" | "disconnected" | "error" | "pending"
  
  // SharePoint
  siteUrl: string | null
  siteId: string | null
  driveId: string | null
  driveName: string | null
  
  // Azure Blob
  accountName: string | null
  containerName: string | null
  hasConnectionString: boolean
  
  // Common
  basePath: string | null
  useEntraAuth: boolean
  settings: Record<string, unknown> | null
  
  // Status
  lastTestedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  
  // Audit
  createdAt: string
  updatedAt: string
}

export interface CreateStorageIntegrationInput {
  provider: "sharepoint" | "azure_blob" | "local"
  name: string
  description?: string
  
  // SharePoint
  siteUrl?: string
  siteId?: string
  driveId?: string
  driveName?: string
  
  // Azure Blob
  accountName?: string
  containerName?: string
  connectionString?: string
  
  // Common
  basePath?: string
  useEntraAuth?: boolean
  settings?: Record<string, unknown>
}

export interface UpdateStorageIntegrationInput {
  name?: string
  description?: string | null
  status?: "connected" | "disconnected" | "error" | "pending"
  
  // SharePoint
  siteUrl?: string | null
  siteId?: string | null
  driveId?: string | null
  driveName?: string | null
  
  // Azure Blob
  accountName?: string | null
  containerName?: string | null
  connectionString?: string | null
  
  // Common
  basePath?: string | null
  useEntraAuth?: boolean
  settings?: Record<string, unknown> | null
}

export interface TestConnectionResult {
  success: boolean
  error: string | null
  details: Record<string, unknown>
  testedAt: string
}

// Query keys
const STORAGE_INTEGRATIONS_KEY = "storage-integrations"

// API functions
async function fetchStorageIntegrations(options?: {
  provider?: string
  status?: string
}): Promise<StorageIntegration[]> {
  const params = new URLSearchParams()
  if (options?.provider) params.set("provider", options.provider)
  if (options?.status) params.set("status", options.status)
  
  const url = `/api/settings/storage-integrations${params.toString() ? `?${params}` : ""}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error("Failed to fetch storage integrations")
  }
  
  const data = await response.json()
  return data.data
}

async function fetchStorageIntegration(id: string): Promise<StorageIntegration> {
  const response = await fetch(`/api/settings/storage-integrations/${id}`)
  
  if (!response.ok) {
    throw new Error("Failed to fetch storage integration")
  }
  
  return response.json()
}

async function createStorageIntegration(input: CreateStorageIntegrationInput): Promise<StorageIntegration> {
  const response = await fetch("/api/settings/storage-integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create storage integration")
  }
  
  return response.json()
}

async function updateStorageIntegration(
  id: string,
  input: UpdateStorageIntegrationInput
): Promise<StorageIntegration> {
  const response = await fetch(`/api/settings/storage-integrations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update storage integration")
  }
  
  return response.json()
}

async function deleteStorageIntegration(id: string): Promise<void> {
  const response = await fetch(`/api/settings/storage-integrations/${id}`, {
    method: "DELETE",
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to delete storage integration")
  }
}

async function testStorageIntegration(id: string): Promise<TestConnectionResult> {
  const response = await fetch(`/api/settings/storage-integrations/${id}/test`, {
    method: "POST",
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to test storage integration")
  }
  
  return response.json()
}

// Hooks

/**
 * List all storage integrations
 */
export function useStorageIntegrationsList(options?: {
  provider?: string
  status?: string
  enabled?: boolean
}) {
  return useQuery({
    queryKey: [STORAGE_INTEGRATIONS_KEY, options?.provider, options?.status],
    queryFn: () => fetchStorageIntegrations(options),
    enabled: options?.enabled !== false,
  })
}

/**
 * Get a single storage integration
 */
export function useStorageIntegrationDetail(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [STORAGE_INTEGRATIONS_KEY, id],
    queryFn: () => fetchStorageIntegration(id!),
    enabled: !!id && options?.enabled !== false,
  })
}

/**
 * Create a new storage integration
 */
export function useCreateStorageIntegration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createStorageIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STORAGE_INTEGRATIONS_KEY] })
    },
  })
}

/**
 * Update a storage integration
 */
export function useUpdateStorageIntegration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStorageIntegrationInput }) =>
      updateStorageIntegration(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [STORAGE_INTEGRATIONS_KEY] })
      queryClient.invalidateQueries({ queryKey: [STORAGE_INTEGRATIONS_KEY, variables.id] })
    },
  })
}

/**
 * Delete a storage integration
 */
export function useDeleteStorageIntegration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteStorageIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STORAGE_INTEGRATIONS_KEY] })
    },
  })
}

/**
 * Test a storage integration connection
 */
export function useTestStorageIntegration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: testStorageIntegration,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [STORAGE_INTEGRATIONS_KEY] })
      queryClient.invalidateQueries({ queryKey: [STORAGE_INTEGRATIONS_KEY, id] })
    },
  })
}

/**
 * Get connected storage integrations only
 */
export function useConnectedStorageIntegrations() {
  return useStorageIntegrationsList({ status: "connected" })
}
