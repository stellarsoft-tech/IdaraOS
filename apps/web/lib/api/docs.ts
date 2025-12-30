/**
 * Documentation API - React Query hooks and fetch functions
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  DocumentWithRelations,
  DocumentVersionWithRelations,
  RolloutWithTarget,
  AcknowledgmentWithUser,
  PendingDocument,
  DocumentFilters,
  RolloutFilters,
  AcknowledgmentFilters,
  CreateDocument,
  UpdateDocument,
  CreateRollout,
  UpdateRollout,
  UpdateAcknowledgment,
} from "@/lib/docs/types"

// ============================================================================
// QUERY KEYS
// ============================================================================

export const docsKeys = {
  all: ["docs"] as const,
  documents: () => [...docsKeys.all, "documents"] as const,
  documentList: (filters?: DocumentFilters) => [...docsKeys.documents(), "list", filters] as const,
  documentDetail: (id: string) => [...docsKeys.documents(), "detail", id] as const,
  rollouts: () => [...docsKeys.all, "rollouts"] as const,
  rolloutList: (filters?: RolloutFilters) => [...docsKeys.rollouts(), "list", filters] as const,
  rolloutDetail: (id: string) => [...docsKeys.rollouts(), "detail", id] as const,
  acknowledgments: () => [...docsKeys.all, "acknowledgments"] as const,
  acknowledgmentList: (filters?: AcknowledgmentFilters) => [...docsKeys.acknowledgments(), "list", filters] as const,
  acknowledgmentDetail: (id: string) => [...docsKeys.acknowledgments(), "detail", id] as const,
  myDocuments: () => [...docsKeys.all, "my-documents"] as const,
}

// ============================================================================
// FETCH FUNCTIONS - DOCUMENTS
// ============================================================================

interface DocumentListResponse {
  data: DocumentWithRelations[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

async function fetchDocuments(filters?: DocumentFilters): Promise<DocumentListResponse> {
  const params = new URLSearchParams()
  
  if (filters?.search) params.set("search", filters.search)
  if (filters?.status) {
    params.set("status", Array.isArray(filters.status) ? filters.status.join(",") : filters.status)
  }
  if (filters?.category) {
    params.set("category", Array.isArray(filters.category) ? filters.category.join(",") : filters.category)
  }
  if (filters?.ownerId) params.set("ownerId", filters.ownerId)
  
  const res = await fetch(`/api/docs/documents?${params}`)
  if (!res.ok) {
    throw new Error("Failed to fetch documents")
  }
  return res.json()
}

async function fetchDocument(idOrSlug: string): Promise<{ data: DocumentWithRelations }> {
  const res = await fetch(`/api/docs/documents/${idOrSlug}`)
  if (!res.ok) {
    throw new Error("Failed to fetch document")
  }
  return res.json()
}

async function createDocument(data: CreateDocument): Promise<DocumentWithRelations> {
  const res = await fetch("/api/docs/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create document")
  }
  const result = await res.json()
  return result.data
}

async function updateDocument(id: string, data: UpdateDocument): Promise<DocumentWithRelations> {
  const res = await fetch(`/api/docs/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to update document")
  }
  const result = await res.json()
  return result.data
}

async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/docs/documents/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    throw new Error("Failed to delete document")
  }
}

// ============================================================================
// FETCH FUNCTIONS - ROLLOUTS
// ============================================================================

async function fetchRollouts(filters?: RolloutFilters): Promise<{ data: RolloutWithTarget[] }> {
  const params = new URLSearchParams()
  
  if (filters?.documentId) params.set("documentId", filters.documentId)
  if (filters?.targetType) params.set("targetType", filters.targetType)
  if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive))
  
  const res = await fetch(`/api/docs/rollouts?${params}`)
  if (!res.ok) {
    throw new Error("Failed to fetch rollouts")
  }
  return res.json()
}

async function createRollout(data: CreateRollout): Promise<RolloutWithTarget> {
  const res = await fetch("/api/docs/rollouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create rollout")
  }
  const result = await res.json()
  return result.data
}

async function updateRollout(id: string, data: UpdateRollout): Promise<RolloutWithTarget> {
  const res = await fetch(`/api/docs/rollouts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to update rollout")
  }
  const result = await res.json()
  return result.data
}

async function deleteRollout(id: string): Promise<void> {
  const res = await fetch(`/api/docs/rollouts/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    throw new Error("Failed to delete rollout")
  }
}

// ============================================================================
// FETCH FUNCTIONS - ACKNOWLEDGMENTS
// ============================================================================

async function fetchAcknowledgments(filters?: AcknowledgmentFilters): Promise<{ data: AcknowledgmentWithUser[] }> {
  const params = new URLSearchParams()
  
  if (filters?.documentId) params.set("documentId", filters.documentId)
  if (filters?.userId) params.set("userId", filters.userId)
  if (filters?.status) {
    params.set("status", Array.isArray(filters.status) ? filters.status.join(",") : filters.status)
  }
  
  const res = await fetch(`/api/docs/acknowledgments?${params}`)
  if (!res.ok) {
    throw new Error("Failed to fetch acknowledgments")
  }
  return res.json()
}

async function updateAcknowledgment(id: string, data: UpdateAcknowledgment): Promise<AcknowledgmentWithUser> {
  const res = await fetch(`/api/docs/acknowledgments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to update acknowledgment")
  }
  const result = await res.json()
  return result.data
}

// ============================================================================
// FETCH FUNCTIONS - MY DOCUMENTS
// ============================================================================

interface MyDocumentsResponse {
  data: PendingDocument[]
  stats: {
    total: number
    pending: number
    viewed: number
    acknowledged: number
    signed: number
    overdue: number
  }
}

async function fetchMyDocuments(options?: { status?: string; includeOptional?: boolean }): Promise<MyDocumentsResponse> {
  const params = new URLSearchParams()
  
  if (options?.status) params.set("status", options.status)
  if (options?.includeOptional) params.set("includeOptional", "true")
  
  const res = await fetch(`/api/docs/my-documents?${params}`)
  if (!res.ok) {
    throw new Error("Failed to fetch my documents")
  }
  return res.json()
}

// ============================================================================
// REACT QUERY HOOKS - DOCUMENTS
// ============================================================================

export function useDocuments(filters?: DocumentFilters) {
  return useQuery({
    queryKey: docsKeys.documentList(filters),
    queryFn: () => fetchDocuments(filters),
  })
}

export function useDocument(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: docsKeys.documentDetail(idOrSlug!),
    queryFn: () => fetchDocument(idOrSlug!),
    enabled: !!idOrSlug,
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKeys.documents() })
    },
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocument }) => updateDocument(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: docsKeys.documents() })
      queryClient.invalidateQueries({ queryKey: docsKeys.documentDetail(id) })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKeys.documents() })
    },
  })
}

// ============================================================================
// REACT QUERY HOOKS - ROLLOUTS
// ============================================================================

export function useRollouts(filters?: RolloutFilters) {
  return useQuery({
    queryKey: docsKeys.rolloutList(filters),
    queryFn: () => fetchRollouts(filters),
  })
}

export function useCreateRollout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createRollout,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: docsKeys.rollouts() })
      queryClient.invalidateQueries({ queryKey: docsKeys.documentDetail(variables.documentId) })
    },
  })
}

export function useUpdateRollout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRollout }) => updateRollout(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKeys.rollouts() })
    },
  })
}

export function useDeleteRollout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteRollout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKeys.rollouts() })
    },
  })
}

// ============================================================================
// REACT QUERY HOOKS - ACKNOWLEDGMENTS
// ============================================================================

export function useAcknowledgments(filters?: AcknowledgmentFilters) {
  return useQuery({
    queryKey: docsKeys.acknowledgmentList(filters),
    queryFn: () => fetchAcknowledgments(filters),
  })
}

export function useUpdateAcknowledgment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAcknowledgment }) => updateAcknowledgment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKeys.acknowledgments() })
      queryClient.invalidateQueries({ queryKey: docsKeys.myDocuments() })
    },
  })
}

// ============================================================================
// REACT QUERY HOOKS - MY DOCUMENTS
// ============================================================================

export function useMyDocuments(options?: { status?: string; includeOptional?: boolean }) {
  return useQuery({
    queryKey: docsKeys.myDocuments(),
    queryFn: () => fetchMyDocuments(options),
  })
}

