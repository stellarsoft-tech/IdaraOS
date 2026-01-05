/**
 * File Categories API Hooks
 * React Query hooks for managing file categories
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

// Types
export interface FileCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  moduleScope: "people" | "assets" | "workflows" | "security" | "docs" | "vendors"
  storageIntegrationId: string | null
  folderPath: string | null
  isRequired: boolean
  maxFileSize: number | null
  allowedMimeTypes: string[] | null
  sortOrder: number
  isActive: boolean
  isSystemCategory: boolean
  createdAt: string
  updatedAt: string
  
  // Joined data
  storageIntegration: {
    id: string
    provider: "sharepoint" | "azure_blob" | "local"
    name: string
    status: "connected" | "disconnected" | "error" | "pending"
  } | null
  
  // Optional counts
  fileCount?: number
}

export interface CreateFileCategoryInput {
  name: string
  slug?: string
  description?: string
  icon?: string
  color?: string
  moduleScope: "people" | "assets" | "workflows" | "security" | "docs" | "vendors"
  storageIntegrationId?: string | null
  folderPath?: string
  isRequired?: boolean
  maxFileSize?: number | null
  allowedMimeTypes?: string[] | null
  sortOrder?: number
}

export interface UpdateFileCategoryInput {
  name?: string
  slug?: string
  description?: string | null
  icon?: string | null
  color?: string | null
  storageIntegrationId?: string | null
  folderPath?: string | null
  isRequired?: boolean
  maxFileSize?: number | null
  allowedMimeTypes?: string[] | null
  sortOrder?: number
  isActive?: boolean
}

// Query keys
const FILE_CATEGORIES_KEY = "file-categories"

// API functions
async function fetchFileCategories(options?: {
  moduleScope?: string
  search?: string
  activeOnly?: boolean
}): Promise<FileCategory[]> {
  const params = new URLSearchParams()
  if (options?.moduleScope) params.set("moduleScope", options.moduleScope)
  if (options?.search) params.set("search", options.search)
  if (options?.activeOnly) params.set("activeOnly", "true")
  
  const url = `/api/filing/categories${params.toString() ? `?${params}` : ""}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error("Failed to fetch file categories")
  }
  
  const data = await response.json()
  return data.data
}

async function fetchFileCategory(id: string): Promise<FileCategory> {
  const response = await fetch(`/api/filing/categories/${id}`)
  
  if (!response.ok) {
    throw new Error("Failed to fetch file category")
  }
  
  return response.json()
}

async function createFileCategory(input: CreateFileCategoryInput): Promise<FileCategory> {
  const response = await fetch("/api/filing/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create file category")
  }
  
  return response.json()
}

async function updateFileCategory(
  id: string,
  input: UpdateFileCategoryInput
): Promise<FileCategory> {
  const response = await fetch(`/api/filing/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update file category")
  }
  
  return response.json()
}

async function deleteFileCategory(id: string): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`/api/filing/categories/${id}`, {
    method: "DELETE",
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to delete file category")
  }
  
  return response.json()
}

// Hooks

/**
 * List all file categories
 */
export function useFileCategoriesList(options?: {
  moduleScope?: string
  search?: string
  activeOnly?: boolean
  enabled?: boolean
}) {
  return useQuery({
    queryKey: [FILE_CATEGORIES_KEY, options?.moduleScope, options?.search, options?.activeOnly],
    queryFn: () => fetchFileCategories(options),
    enabled: options?.enabled !== false,
  })
}

/**
 * Get a single file category
 */
export function useFileCategoryDetail(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [FILE_CATEGORIES_KEY, id],
    queryFn: () => fetchFileCategory(id!),
    enabled: !!id && options?.enabled !== false,
  })
}

/**
 * Create a new file category
 */
export function useCreateFileCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createFileCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FILE_CATEGORIES_KEY] })
    },
  })
}

/**
 * Update a file category
 */
export function useUpdateFileCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFileCategoryInput }) =>
      updateFileCategory(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [FILE_CATEGORIES_KEY] })
      queryClient.invalidateQueries({ queryKey: [FILE_CATEGORIES_KEY, variables.id] })
    },
  })
}

/**
 * Delete a file category
 */
export function useDeleteFileCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteFileCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FILE_CATEGORIES_KEY] })
    },
  })
}

/**
 * Get file categories for a specific module
 */
export function useModuleFileCategories(moduleScope: string, options?: { enabled?: boolean }) {
  return useFileCategoriesList({
    moduleScope,
    activeOnly: true,
    enabled: options?.enabled,
  })
}

/**
 * Get all active file categories
 */
export function useActiveFileCategories() {
  return useFileCategoriesList({ activeOnly: true })
}

// Module scope options for dropdowns
export const MODULE_SCOPE_OPTIONS = [
  { value: "people", label: "People & HR" },
  { value: "assets", label: "Assets" },
  { value: "workflows", label: "Workflows" },
  { value: "security", label: "Security" },
  { value: "docs", label: "Docs & Policies" },
  { value: "vendors", label: "Vendors" },
] as const

// Default icons for categories
export const CATEGORY_ICON_OPTIONS = [
  { value: "FileText", label: "Document" },
  { value: "FileCheck", label: "Verified Document" },
  { value: "FileSignature", label: "Contract" },
  { value: "FileBadge", label: "Certificate" },
  { value: "FileUser", label: "CV/Resume" },
  { value: "FileImage", label: "Image" },
  { value: "FileSpreadsheet", label: "Spreadsheet" },
  { value: "FileArchive", label: "Archive" },
  { value: "Receipt", label: "Receipt/Invoice" },
  { value: "Shield", label: "Security" },
  { value: "Key", label: "Access/License" },
  { value: "Wrench", label: "Manual" },
] as const

// Color options for categories
export const CATEGORY_COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "purple", label: "Purple" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
  { value: "cyan", label: "Cyan" },
  { value: "pink", label: "Pink" },
  { value: "slate", label: "Slate" },
] as const
