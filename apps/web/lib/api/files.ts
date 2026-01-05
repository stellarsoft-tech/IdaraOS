/**
 * Files API Hooks
 * React Query hooks for managing files
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

// Types
export interface FileRecord {
  id: string
  name: string
  originalName: string
  mimeType: string | null
  size: number | null
  storagePath: string
  externalId: string | null
  entityType: string | null
  entityId: string | null
  moduleScope: string | null
  metadata: Record<string, unknown> | null
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  
  // Storage URLs for "View in Storage" feature
  webUrl?: string
  storageProvider?: "sharepoint" | "azure_blob" | "local" | "metadata"
  
  category: {
    id: string
    name: string
    slug: string
    icon: string | null
    color: string | null
  } | null
  
  uploadedBy: {
    id: string
    name: string | null
    email: string
  } | null
  
  storageIntegration: {
    id: string
    provider: "sharepoint" | "azure_blob" | "local"
    name: string
  } | null
}

export interface UploadFileInput {
  file: File
  categoryId: string
  entityType?: string
  entityId?: string
  name?: string
}

export interface UpdateFileInput {
  name?: string
  metadata?: Record<string, unknown>
}

export interface FileDownloadInfo {
  id: string
  name: string
  mimeType: string | null
  size: number | null
  downloadUrl: string
  expiresAt: string | null
  webUrl?: string // URL to view the file in the storage provider (e.g., SharePoint)
}

export interface FilesListOptions {
  moduleScope?: string
  categoryId?: string
  entityType?: string
  entityId?: string
  search?: string
  includeDeleted?: boolean
  page?: number
  limit?: number
}

export interface FilesListResponse {
  data: FileRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Query keys
const FILES_KEY = "files"

// API functions
async function fetchFiles(options?: FilesListOptions): Promise<FilesListResponse> {
  const params = new URLSearchParams()
  if (options?.moduleScope) params.set("moduleScope", options.moduleScope)
  if (options?.categoryId) params.set("categoryId", options.categoryId)
  if (options?.entityType) params.set("entityType", options.entityType)
  if (options?.entityId) params.set("entityId", options.entityId)
  if (options?.search) params.set("search", options.search)
  if (options?.includeDeleted) params.set("includeDeleted", "true")
  if (options?.page) params.set("page", options.page.toString())
  if (options?.limit) params.set("limit", options.limit.toString())
  
  const url = `/api/files${params.toString() ? `?${params}` : ""}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error("Failed to fetch files")
  }
  
  return response.json()
}

async function fetchFile(id: string): Promise<FileRecord> {
  const response = await fetch(`/api/files/${id}`)
  
  if (!response.ok) {
    throw new Error("Failed to fetch file")
  }
  
  return response.json()
}

async function uploadFile(input: UploadFileInput): Promise<FileRecord> {
  const formData = new FormData()
  formData.append("file", input.file)
  formData.append("categoryId", input.categoryId)
  if (input.entityType) formData.append("entityType", input.entityType)
  if (input.entityId) formData.append("entityId", input.entityId)
  if (input.name) formData.append("name", input.name)
  
  const response = await fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to upload file")
  }
  
  return response.json()
}

async function updateFile(id: string, input: UpdateFileInput): Promise<FileRecord> {
  const response = await fetch(`/api/files/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update file")
  }
  
  return response.json()
}

async function deleteFile(id: string): Promise<void> {
  const response = await fetch(`/api/files/${id}`, {
    method: "DELETE",
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to delete file")
  }
}

async function getDownloadUrl(id: string): Promise<FileDownloadInfo> {
  const response = await fetch(`/api/files/${id}/download`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to get download URL")
  }
  
  return response.json()
}

// Hooks

/**
 * List files with filters and pagination
 */
export function useFilesList(options?: FilesListOptions & { enabled?: boolean }) {
  const queryKey = [FILES_KEY, options?.moduleScope, options?.categoryId, options?.entityType, options?.entityId, options?.search, options?.page, options?.limit]
  
  return useQuery({
    queryKey,
    queryFn: () => fetchFiles(options),
    enabled: options?.enabled !== false,
  })
}

/**
 * Get files for a specific entity
 */
export function useEntityFiles(
  entityType: string,
  entityId: string,
  options?: { enabled?: boolean }
) {
  return useFilesList({
    entityType,
    entityId,
    enabled: !!entityType && !!entityId && options?.enabled !== false,
  })
}

/**
 * Get files for a specific module
 */
export function useModuleFiles(
  moduleScope: string,
  options?: Omit<FilesListOptions, "moduleScope"> & { enabled?: boolean }
) {
  return useFilesList({
    ...options,
    moduleScope,
    enabled: !!moduleScope && options?.enabled !== false,
  })
}

/**
 * Get a single file
 */
export function useFileDetail(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [FILES_KEY, id],
    queryFn: () => fetchFile(id!),
    enabled: !!id && options?.enabled !== false,
  })
}

/**
 * Upload a file
 */
export function useUploadFile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FILES_KEY] })
    },
  })
}

/**
 * Update a file
 */
export function useUpdateFile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFileInput }) =>
      updateFile(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [FILES_KEY] })
      queryClient.invalidateQueries({ queryKey: [FILES_KEY, variables.id] })
    },
  })
}

/**
 * Delete a file
 */
export function useDeleteFile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FILES_KEY] })
    },
  })
}

/**
 * Get download URL for a file
 */
export function useFileDownload() {
  return useMutation({
    mutationFn: getDownloadUrl,
  })
}

/**
 * Download a file (triggers browser download)
 */
export async function downloadFile(id: string, filename?: string): Promise<void> {
  const info = await getDownloadUrl(id)
  
  // Create a temporary link and trigger download
  const link = document.createElement("a")
  link.href = info.downloadUrl
  link.download = filename || info.name
  link.target = "_blank"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
