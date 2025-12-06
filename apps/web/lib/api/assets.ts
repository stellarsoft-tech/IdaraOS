/**
 * Assets API Client
 * React Query hooks for the Assets module
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ============================================================================
// Types
// ============================================================================

export interface AssetCategory {
  id: string
  name: string
  slug: string
  description?: string
  parentId?: string
  icon: string
  color: string
  defaultDepreciationYears?: number
  createdAt: string
  updatedAt: string
}

export interface AssetCategoryInfo {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
}

export interface AssigneeInfo {
  id: string
  name: string
  email: string
  slug: string
}

export interface Asset {
  id: string
  assetTag: string
  name: string
  description?: string
  categoryId: string | null
  category: AssetCategoryInfo | null
  status: "available" | "assigned" | "maintenance" | "retired" | "disposed"
  serialNumber?: string
  manufacturer?: string
  model?: string
  purchaseDate?: string
  purchaseCost?: string
  warrantyEnd?: string
  location?: string
  assignedToId: string | null
  assignedTo: AssigneeInfo | null
  assignedAt?: string
  source: "manual" | "intune_sync"
  intuneDeviceId?: string
  intuneComplianceState?: string
  intuneEnrollmentType?: string
  intuneLastSyncAt?: string
  syncEnabled: boolean
  notes?: string
  customFields: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateAsset {
  assetTag: string
  name: string
  description?: string
  categoryId?: string
  status?: Asset["status"]
  serialNumber?: string
  manufacturer?: string
  model?: string
  purchaseDate?: string
  purchaseCost?: string
  warrantyEnd?: string
  location?: string
  notes?: string
}

export interface UpdateAsset {
  assetTag?: string
  name?: string
  description?: string | null
  categoryId?: string | null
  status?: Asset["status"]
  serialNumber?: string | null
  manufacturer?: string | null
  model?: string | null
  purchaseDate?: string | null
  purchaseCost?: string | null
  warrantyEnd?: string | null
  location?: string | null
  notes?: string | null
}

export interface AssetFilters {
  search?: string
  status?: string[]
  categoryId?: string
  location?: string
  assignedToId?: string
  source?: string
}

export interface CreateCategory {
  name: string
  description?: string
  parentId?: string | null
  icon?: string
  color?: string
  defaultDepreciationYears?: number
}

export interface UpdateCategory {
  name?: string
  description?: string | null
  parentId?: string | null
  icon?: string
  color?: string
  defaultDepreciationYears?: number | null
}

export interface Assignment {
  id: string
  assetId: string
  asset: {
    id: string
    assetTag: string
    name: string
    model: string | null
    status: string
  }
  personId: string
  person: {
    id: string
    name: string
    email: string
    slug: string
  }
  assignedAt: string
  returnedAt: string | null
  assignedBy: {
    id: string
    name: string
    email: string
  } | null
  notes: string | null
}

export interface MaintenanceRecord {
  id: string
  assetId: string
  asset: {
    id: string
    assetTag: string
    name: string
  } | null
  type: "scheduled" | "repair" | "upgrade"
  status: "scheduled" | "in_progress" | "completed" | "cancelled"
  description: string | null
  scheduledDate: string | null
  completedDate: string | null
  cost: string | null
  vendor: string | null
  performedBy: {
    id: string
    name: string
    email: string
  } | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMaintenance {
  assetId: string
  type: MaintenanceRecord["type"]
  status?: MaintenanceRecord["status"]
  description?: string
  scheduledDate?: string
  completedDate?: string
  cost?: string
  vendor?: string
  notes?: string
}

// ============================================================================
// Query Keys
// ============================================================================

export const assetsKeys = {
  all: ["assets"] as const,
  lists: () => [...assetsKeys.all, "list"] as const,
  list: (filters?: AssetFilters) => [...assetsKeys.lists(), filters] as const,
  details: () => [...assetsKeys.all, "detail"] as const,
  detail: (id: string) => [...assetsKeys.details(), id] as const,
}

export const categoriesKeys = {
  all: ["asset-categories"] as const,
  lists: () => [...categoriesKeys.all, "list"] as const,
  list: () => [...categoriesKeys.lists()] as const,
  details: () => [...categoriesKeys.all, "detail"] as const,
  detail: (id: string) => [...categoriesKeys.details(), id] as const,
}

export const assignmentsKeys = {
  all: ["asset-assignments"] as const,
  lists: () => [...assignmentsKeys.all, "list"] as const,
  list: (filters?: { personId?: string; assetId?: string; includeReturned?: boolean }) => 
    [...assignmentsKeys.lists(), filters] as const,
}

export const maintenanceKeys = {
  all: ["asset-maintenance"] as const,
  lists: () => [...maintenanceKeys.all, "list"] as const,
  list: (filters?: { status?: string; type?: string; assetId?: string }) => 
    [...maintenanceKeys.lists(), filters] as const,
}

// ============================================================================
// API Functions
// ============================================================================

const ASSETS_BASE = "/api/assets"
const CATEGORIES_BASE = "/api/assets/categories"
const ASSIGNMENTS_BASE = "/api/assets/assignments"
const MAINTENANCE_BASE = "/api/assets/maintenance"

// Assets

async function fetchAssets(filters?: AssetFilters): Promise<Asset[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) params.set("search", filters.search)
  if (filters?.status?.length) params.set("status", filters.status.join(","))
  if (filters?.categoryId) params.set("categoryId", filters.categoryId)
  if (filters?.location) params.set("location", filters.location)
  if (filters?.assignedToId) params.set("assignedToId", filters.assignedToId)
  if (filters?.source) params.set("source", filters.source)
  
  const url = params.toString() ? `${ASSETS_BASE}?${params}` : ASSETS_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch assets")
  }
  
  return res.json()
}

async function fetchAsset(id: string): Promise<Asset | null> {
  const res = await fetch(`${ASSETS_BASE}/${id}`)
  
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch asset")
  
  return res.json()
}

async function createAsset(data: CreateAsset): Promise<Asset> {
  const res = await fetch(ASSETS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create asset" }))
    throw new Error(error.error || "Failed to create asset")
  }
  
  return res.json()
}

async function updateAsset(id: string, data: UpdateAsset): Promise<Asset> {
  const res = await fetch(`${ASSETS_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update asset" }))
    throw new Error(error.error || "Failed to update asset")
  }
  
  return res.json()
}

async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`${ASSETS_BASE}/${id}`, { method: "DELETE" })
  
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete asset")
  }
}

async function assignAsset(id: string, personId: string, notes?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${ASSETS_BASE}/${id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personId, notes }),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to assign asset" }))
    throw new Error(error.error || "Failed to assign asset")
  }
  
  return res.json()
}

async function returnAsset(id: string, notes?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${ASSETS_BASE}/${id}/return`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to return asset" }))
    throw new Error(error.error || "Failed to return asset")
  }
  
  return res.json()
}

// Categories

async function fetchCategories(): Promise<AssetCategory[]> {
  const res = await fetch(CATEGORIES_BASE)
  
  if (!res.ok) {
    throw new Error("Failed to fetch categories")
  }
  
  return res.json()
}

async function fetchCategory(id: string): Promise<AssetCategory | null> {
  const res = await fetch(`${CATEGORIES_BASE}/${id}`)
  
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch category")
  
  return res.json()
}

async function createCategory(data: CreateCategory): Promise<AssetCategory> {
  const res = await fetch(CATEGORIES_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create category" }))
    throw new Error(error.error || "Failed to create category")
  }
  
  return res.json()
}

async function updateCategory(id: string, data: UpdateCategory): Promise<AssetCategory> {
  const res = await fetch(`${CATEGORIES_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update category" }))
    throw new Error(error.error || "Failed to update category")
  }
  
  return res.json()
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`${CATEGORIES_BASE}/${id}`, { method: "DELETE" })
  
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete category")
  }
}

// Assignments

async function fetchAssignments(filters?: { personId?: string; assetId?: string; includeReturned?: boolean }): Promise<Assignment[]> {
  const params = new URLSearchParams()
  
  if (filters?.personId) params.set("personId", filters.personId)
  if (filters?.assetId) params.set("assetId", filters.assetId)
  if (filters?.includeReturned) params.set("includeReturned", "true")
  
  const url = params.toString() ? `${ASSIGNMENTS_BASE}?${params}` : ASSIGNMENTS_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch assignments")
  }
  
  return res.json()
}

// Maintenance

async function fetchMaintenanceRecords(filters?: { status?: string; type?: string; assetId?: string }): Promise<MaintenanceRecord[]> {
  const params = new URLSearchParams()
  
  if (filters?.status) params.set("status", filters.status)
  if (filters?.type) params.set("type", filters.type)
  if (filters?.assetId) params.set("assetId", filters.assetId)
  
  const url = params.toString() ? `${MAINTENANCE_BASE}?${params}` : MAINTENANCE_BASE
  const res = await fetch(url)
  
  if (!res.ok) {
    throw new Error("Failed to fetch maintenance records")
  }
  
  return res.json()
}

async function createMaintenanceRecord(data: CreateMaintenance): Promise<MaintenanceRecord> {
  const res = await fetch(MAINTENANCE_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create maintenance record" }))
    throw new Error(error.error || "Failed to create maintenance record")
  }
  
  return res.json()
}

// ============================================================================
// React Query Hooks
// ============================================================================

// Assets

export function useAssetsList(filters?: AssetFilters) {
  return useQuery({
    queryKey: assetsKeys.list(filters),
    queryFn: () => fetchAssets(filters),
  })
}

export function useAssetDetail(id: string) {
  return useQuery({
    queryKey: assetsKeys.detail(id),
    queryFn: () => fetchAsset(id),
    enabled: !!id,
  })
}

export function useCreateAsset() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() })
    },
  })
}

export function useUpdateAsset() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAsset }) => updateAsset(id, data),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assetsKeys.detail(asset.id) })
    },
  })
}

export function useDeleteAsset() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() })
    },
  })
}

export function useAssignAsset() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, personId, notes }: { id: string; personId: string; notes?: string }) => 
      assignAsset(id, personId, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assetsKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: assignmentsKeys.lists() })
    },
  })
}

export function useReturnAsset() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => returnAsset(id, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assetsKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: assignmentsKeys.lists() })
    },
  })
}

// Categories

export function useCategoriesList() {
  return useQuery({
    queryKey: categoriesKeys.list(),
    queryFn: fetchCategories,
  })
}

export function useCategoryDetail(id: string) {
  return useQuery({
    queryKey: categoriesKeys.detail(id),
    queryFn: () => fetchCategory(id),
    enabled: !!id,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategory }) => updateCategory(id, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: categoriesKeys.detail(category.id) })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() })
    },
  })
}

// Assignments

export function useAssignmentsList(filters?: { personId?: string; assetId?: string; includeReturned?: boolean }) {
  return useQuery({
    queryKey: assignmentsKeys.list(filters),
    queryFn: () => fetchAssignments(filters),
  })
}

// Maintenance

export function useMaintenanceList(filters?: { status?: string; type?: string; assetId?: string }) {
  return useQuery({
    queryKey: maintenanceKeys.list(filters),
    queryFn: () => fetchMaintenanceRecords(filters),
  })
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createMaintenanceRecord,
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assetsKeys.detail(record.assetId) })
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() })
    },
  })
}

