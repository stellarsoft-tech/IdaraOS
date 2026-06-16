/**
 * People Access Control API Client
 * React Query hooks for access groups and access register assignments.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface AccessGroupRoleRef {
  id: string
  name: string
}

export interface AccessGroupPersonRef {
  id: string
  name: string
  email: string
}

export interface AccessGroup {
  id: string
  name: string
  description?: string
  businessJustification: string
  accessItems: string[]
  isoControls: string[]
  ownerPersonId: string | null
  owner: AccessGroupPersonRef | null
  roleIds: string[]
  roles: AccessGroupRoleRef[]
  reviewFrequency: "monthly" | "quarterly" | "semi_annual" | "annual"
  riskLevel: "low" | "medium" | "high" | "critical"
  status: "active" | "draft" | "retired"
  assignmentCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateAccessGroup {
  name: string
  description?: string
  businessJustification: string
  accessItems?: string[]
  isoControls?: string[]
  ownerPersonId?: string | null
  roleIds?: string[]
  reviewFrequency?: AccessGroup["reviewFrequency"]
  riskLevel?: AccessGroup["riskLevel"]
  status?: AccessGroup["status"]
}

export type UpdateAccessGroup = Partial<CreateAccessGroup>

export interface AccessRegisterEntry {
  id: string
  accessGroupId: string
  userId: string
  personId: string | null
  grantedByPersonId: string | null
  accessGroup: Pick<AccessGroup, "id" | "name" | "riskLevel" | "reviewFrequency" | "isoControls" | "status">
  user: {
    id: string
    name: string
    email: string
    role: string
    status: string
  }
  person: AccessGroupPersonRef & {
    status: string
    role: AccessGroupRoleRef | null
    team: { id: string; name: string } | null
  } | null
  grantedBy: AccessGroupPersonRef | null
  grantedAt: string
  reviewDueAt: string | null
  lastReviewedAt: string | null
  reviewStatus: "not_reviewed" | "approved" | "changes_required" | "revoked"
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAccessRegisterEntry {
  accessGroupId: string
  userId: string
  grantedByPersonId?: string | null
  reviewDueAt?: string | null
  reviewStatus?: AccessRegisterEntry["reviewStatus"]
  notes?: string
}

export interface UpdateAccessRegisterEntry {
  reviewDueAt?: string | null
  lastReviewedAt?: string | null
  reviewStatus?: AccessRegisterEntry["reviewStatus"]
  notes?: string | null
}

export const accessControlKeys = {
  all: ["people-access-control"] as const,
  groups: () => [...accessControlKeys.all, "groups"] as const,
  group: (id: string) => [...accessControlKeys.groups(), id] as const,
  register: () => [...accessControlKeys.all, "register"] as const,
  registerEntry: (id: string) => [...accessControlKeys.register(), id] as const,
}

async function fetchAccessGroups(): Promise<AccessGroup[]> {
  const res = await fetch("/api/people/access-groups")
  if (!res.ok) throw new Error("Failed to fetch access groups")
  return res.json()
}

async function createAccessGroup(data: CreateAccessGroup): Promise<AccessGroup> {
  const res = await fetch("/api/people/access-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to create access group")
  }
  return res.json()
}

async function updateAccessGroup(id: string, data: UpdateAccessGroup): Promise<AccessGroup> {
  const res = await fetch(`/api/people/access-groups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to update access group")
  }
  return res.json()
}

async function deleteAccessGroup(id: string): Promise<void> {
  const res = await fetch(`/api/people/access-groups/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to delete access group")
  }
}

async function fetchAccessRegister(): Promise<AccessRegisterEntry[]> {
  const res = await fetch("/api/people/access-register")
  if (!res.ok) throw new Error("Failed to fetch access register")
  return res.json()
}

async function createAccessRegisterEntry(data: CreateAccessRegisterEntry): Promise<AccessRegisterEntry> {
  const res = await fetch("/api/people/access-register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to assign access group")
  }
  return res.json()
}

async function updateAccessRegisterEntry(id: string, data: UpdateAccessRegisterEntry): Promise<AccessRegisterEntry> {
  const res = await fetch(`/api/people/access-register/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to update access register entry")
  }
  return res.json()
}

async function deleteAccessRegisterEntry(id: string): Promise<void> {
  const res = await fetch(`/api/people/access-register/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || "Failed to revoke access group")
  }
}

export function useAccessGroupsList() {
  return useQuery({
    queryKey: accessControlKeys.groups(),
    queryFn: fetchAccessGroups,
  })
}

export function useCreateAccessGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAccessGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessControlKeys.all })
    },
  })
}

export function useUpdateAccessGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccessGroup }) => updateAccessGroup(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accessControlKeys.groups() })
      queryClient.invalidateQueries({ queryKey: accessControlKeys.group(id) })
      queryClient.invalidateQueries({ queryKey: accessControlKeys.register() })
    },
  })
}

export function useDeleteAccessGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAccessGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessControlKeys.all })
    },
  })
}

export function useAccessRegisterList() {
  return useQuery({
    queryKey: accessControlKeys.register(),
    queryFn: fetchAccessRegister,
  })
}

export function useCreateAccessRegisterEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAccessRegisterEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessControlKeys.all })
    },
  })
}

export function useUpdateAccessRegisterEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccessRegisterEntry }) => updateAccessRegisterEntry(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accessControlKeys.register() })
      queryClient.invalidateQueries({ queryKey: accessControlKeys.registerEntry(id) })
    },
  })
}

export function useDeleteAccessRegisterEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAccessRegisterEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessControlKeys.all })
    },
  })
}
