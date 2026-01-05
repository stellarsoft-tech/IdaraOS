/**
 * Audit Log API Hooks
 * 
 * React Query hooks for fetching and managing audit logs.
 */

import { useQuery } from "@tanstack/react-query"
import type { AuditLogEntry, AuditLogFilters, AuditLogResponse } from "@/lib/audit"

/**
 * Fetch audit logs with filtering
 */
async function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogResponse> {
  const params = new URLSearchParams()
  
  if (filters.module) {
    params.set("module", filters.module)
  }
  if (filters.modulePrefix) {
    params.set("modulePrefix", filters.modulePrefix)
  }
  if (filters.action) {
    params.set("action", filters.action)
  }
  if (filters.entityType) {
    params.set("entityType", filters.entityType)
  }
  if (filters.entityId) {
    params.set("entityId", filters.entityId)
  }
  if (filters.actorId) {
    params.set("actorId", filters.actorId)
  }
  if (filters.from) {
    params.set("from", filters.from.toISOString())
  }
  if (filters.to) {
    params.set("to", filters.to.toISOString())
  }
  if (filters.search) {
    params.set("search", filters.search)
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit))
  }
  if (filters.offset) {
    params.set("offset", String(filters.offset))
  }
  
  const response = await fetch(`/api/audit/logs?${params.toString()}`)
  
  if (!response.ok) {
    throw new Error("Failed to fetch audit logs")
  }
  
  return response.json()
}

/**
 * Fetch a single audit log entry
 */
async function fetchAuditLog(id: string): Promise<AuditLogEntry & { 
  actorUserAgent?: string | null
  metadata?: Record<string, unknown> | null
  actor?: {
    id: string
    name: string
    email: string
    avatar?: string | null
    status: string
  } | null
}> {
  const response = await fetch(`/api/audit/logs/${id}`)
  
  if (!response.ok) {
    throw new Error("Failed to fetch audit log")
  }
  
  return response.json()
}

/**
 * Hook to fetch audit logs with filtering
 */
export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => fetchAuditLogs(filters),
  })
}

/**
 * Hook to fetch a single audit log entry
 */
export function useAuditLog(id: string | null) {
  return useQuery({
    queryKey: ["audit-log", id],
    queryFn: () => (id ? fetchAuditLog(id) : null),
    enabled: !!id,
  })
}

/**
 * Hook to fetch audit logs for a specific module (e.g., People)
 */
export function usePeopleAuditLogs(filters: Omit<AuditLogFilters, "modulePrefix"> = {}) {
  return useAuditLogs({
    ...filters,
    modulePrefix: "people.",
  })
}

/**
 * Hook to fetch audit logs for Settings module
 */
export function useSettingsAuditLogs(filters: Omit<AuditLogFilters, "modulePrefix"> = {}) {
  return useAuditLogs({
    ...filters,
    modulePrefix: "settings.",
  })
}

/**
 * Hook to fetch audit logs for Assets module
 */
export function useAssetsAuditLogs(filters: Omit<AuditLogFilters, "modulePrefix"> = {}) {
  return useAuditLogs({
    ...filters,
    modulePrefix: "assets.",
  })
}

/**
 * Hook to fetch audit logs for Security module
 */
export function useSecurityAuditLogs(filters: Omit<AuditLogFilters, "modulePrefix"> = {}) {
  return useAuditLogs({
    ...filters,
    modulePrefix: "security.",
  })
}

/**
 * Hook to fetch audit logs for Documentation module
 */
export function useDocsAuditLogs(filters: Omit<AuditLogFilters, "modulePrefix"> = {}) {
  return useAuditLogs({
    ...filters,
    modulePrefix: "docs.",
  })
}

/**
 * Hook to fetch audit logs for Workflows module
 */
export function useWorkflowsAuditLogs(filters: Omit<AuditLogFilters, "modulePrefix"> = {}) {
  return useAuditLogs({
    ...filters,
    modulePrefix: "workflows.",
  })
}

/**
 * Hook to fetch audit logs for Filing module
 */
export function useFilingAuditLogs(filters: Omit<AuditLogFilters, "modulePrefix"> = {}) {
  return useAuditLogs({
    ...filters,
    modulePrefix: "filing.",
  })
}

/**
 * Generate export URL for audit logs
 */
export function getAuditLogsExportUrl(
  filters: AuditLogFilters & { format?: "csv" | "json" }
): string {
  const params = new URLSearchParams()
  
  if (filters.format) {
    params.set("format", filters.format)
  }
  if (filters.module) {
    params.set("module", filters.module)
  }
  if (filters.modulePrefix) {
    params.set("modulePrefix", filters.modulePrefix)
  }
  if (filters.action) {
    params.set("action", filters.action)
  }
  if (filters.entityType) {
    params.set("entityType", filters.entityType)
  }
  if (filters.from) {
    params.set("from", filters.from.toISOString())
  }
  if (filters.to) {
    params.set("to", filters.to.toISOString())
  }
  if (filters.search) {
    params.set("search", filters.search)
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit))
  }
  
  return `/api/audit/logs/export?${params.toString()}`
}
