/**
 * Security Module API Hooks
 * React Query hooks for security controls, evidence, risks, frameworks, and audits
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ============================================================================
// TYPES
// ============================================================================

export interface SecurityControl {
  id: string
  controlId: string
  title: string
  description?: string | null
  ownerId?: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  status: "active" | "inactive" | "under_review"
  implementationStatus: "not_implemented" | "partially_implemented" | "implemented" | "effective"
  implementationNotes?: string | null
  implementedAt?: string | null
  lastTestedAt?: string | null
  nextReviewAt?: string | null
  reviewFrequencyDays?: number | null
  controlType?: string | null
  category?: string | null
  metadata?: Record<string, unknown> | null
  mappingsCount?: number
  frameworkCodes?: string[]
  mappings?: ControlMapping[]
  createdAt: string
  updatedAt: string
}

export interface StandardControl {
  id: string
  frameworkCode: string
  controlId: string
  category: string
  subcategory?: string | null
  title: string
  description?: string | null
  guidance?: string | null
}

export interface ControlMapping {
  id: string
  controlId: string
  standardControlId: string
  coverageLevel?: string | null
  notes?: string | null
  createdAt: string
  standardControl: StandardControl
}

export interface SecurityEvidence {
  id: string
  title: string
  description?: string | null
  type: "document" | "screenshot" | "log" | "report" | "attestation" | "configuration" | "other"
  status: "current" | "expired" | "pending_review"
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  externalUrl?: string | null
  externalSystem?: string | null
  collectedAt: string
  validUntil?: string | null
  collectedById?: string | null
  collectedByName?: string | null
  tags?: string[] | null
  controlsCount?: number
  linkedControlIds?: string[] | null
  createdAt: string
  updatedAt: string
}

export interface SecurityFramework {
  id: string
  code: string
  name: string
  version?: string | null
  description?: string | null
  status: "planned" | "implementing" | "certified" | "expired"
  certifiedAt?: string | null
  expiresAt?: string | null
  certificationBody?: string | null
  certificateNumber?: string | null
  scope?: string | null
  controlsCount?: number
  implementedCount?: number
  createdAt: string
  updatedAt: string
}

export interface SecurityRisk {
  id: string
  riskId: string
  title: string
  description?: string | null
  category: "operational" | "compliance" | "strategic" | "financial" | "reputational" | "technical"
  ownerId?: string | null
  ownerName?: string | null
  inherentLikelihood: string
  inherentImpact: string
  inherentLevel: string
  residualLikelihood?: string | null
  residualImpact?: string | null
  residualLevel?: string | null
  status: string
  treatment?: string | null
  treatmentPlan?: string | null
  treatmentDueDate?: string | null
  controlsCount?: number
  createdAt: string
  updatedAt: string
}

export interface SecurityAudit {
  id: string
  auditId: string
  title: string
  type: "internal" | "external" | "surveillance" | "certification" | "recertification"
  status: "planned" | "in_progress" | "completed" | "cancelled"
  frameworkId?: string | null
  frameworkName?: string | null
  startDate?: string | null
  endDate?: string | null
  scope?: string | null
  objectives?: string | null
  leadAuditor?: string | null
  auditBody?: string | null
  findingsCount: number
  majorFindingsCount: number
  minorFindingsCount: number
  createdAt: string
  updatedAt: string
}

export interface SoaItem {
  id: string
  frameworkId: string
  standardControlId: string
  controlId?: string | null
  applicability: "applicable" | "not_applicable" | "partially_applicable"
  justification?: string | null
  implementationStatus: string
  notes?: string | null
  standardControl: StandardControl
  control?: SecurityControl | null
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================================================
// CONTROLS HOOKS
// ============================================================================

interface ControlsQueryParams {
  search?: string
  status?: string
  implementationStatus?: string
  ownerId?: string
  category?: string
  page?: number
  limit?: number
}

export function useSecurityControls(params: ControlsQueryParams = {}) {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      queryParams.set(key, String(value))
    }
  })

  return useQuery<PaginatedResponse<SecurityControl>>({
    queryKey: ["security-controls", params],
    queryFn: async () => {
      const res = await fetch(`/api/security/controls?${queryParams}`)
      if (!res.ok) throw new Error("Failed to fetch controls")
      return res.json()
    },
  })
}

export function useSecurityControl(id: string | undefined) {
  return useQuery<{ data: SecurityControl & { mappings: ControlMapping[] } }>({
    queryKey: ["security-control", id],
    queryFn: async () => {
      const res = await fetch(`/api/security/controls/${id}`)
      if (!res.ok) throw new Error("Failed to fetch control")
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateSecurityControl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<SecurityControl>) => {
      const res = await fetch("/api/security/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create control")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-controls"] })
    },
  })
}

export function useUpdateSecurityControl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SecurityControl> }) => {
      const res = await fetch(`/api/security/controls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update control")
      }
      return res.json()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["security-controls"] })
      queryClient.invalidateQueries({ queryKey: ["security-control", id] })
    },
  })
}

export function useDeleteSecurityControl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/security/controls/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete control")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-controls"] })
    },
  })
}

// Control Mappings
export function useAddControlMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      controlId,
      standardControlId,
      coverageLevel,
      notes,
    }: {
      controlId: string
      standardControlId: string
      coverageLevel?: string
      notes?: string
    }) => {
      const res = await fetch(`/api/security/controls/${controlId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standardControlId, coverageLevel, notes }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add mapping")
      }
      return res.json()
    },
    onSuccess: (_, { controlId }) => {
      queryClient.invalidateQueries({ queryKey: ["security-control", controlId] })
      queryClient.invalidateQueries({ queryKey: ["security-controls"] })
    },
  })
}

export function useRemoveControlMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ controlId, mappingId }: { controlId: string; mappingId: string }) => {
      const res = await fetch(`/api/security/controls/${controlId}/mappings?mappingId=${mappingId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to remove mapping")
      return res.json()
    },
    onSuccess: (_, { controlId }) => {
      queryClient.invalidateQueries({ queryKey: ["security-control", controlId] })
      queryClient.invalidateQueries({ queryKey: ["security-controls"] })
    },
  })
}

interface CreateFromStandardResult {
  message: string
  created: Array<{
    id: string
    controlId: string
    title: string
    standardControlId: string
    standardControlCode: string
  }>
  skipped: Array<{
    standardControlId: string
    reason: string
  }>
}

export function useCreateControlsFromStandard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      standardControlIds,
      frameworkId,
      defaultStatus,
      defaultImplementationStatus,
    }: {
      standardControlIds: string[]
      frameworkId?: string
      defaultStatus?: string
      defaultImplementationStatus?: string
    }): Promise<CreateFromStandardResult> => {
      const res = await fetch("/api/security/controls/create-from-standard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          standardControlIds, 
          frameworkId,
          defaultStatus,
          defaultImplementationStatus,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create controls")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-controls"] })
      queryClient.invalidateQueries({ queryKey: ["standard-controls"] })
      queryClient.invalidateQueries({ queryKey: ["soa-items"] })
    },
  })
}

// ============================================================================
// EVIDENCE HOOKS
// ============================================================================

interface EvidenceQueryParams {
  search?: string
  type?: string
  status?: string
  controlId?: string
  page?: number
  limit?: number
}

export function useSecurityEvidence(params: EvidenceQueryParams = {}) {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      queryParams.set(key, String(value))
    }
  })

  return useQuery<PaginatedResponse<SecurityEvidence>>({
    queryKey: ["security-evidence", params],
    queryFn: async () => {
      const res = await fetch(`/api/security/evidence?${queryParams}`)
      if (!res.ok) throw new Error("Failed to fetch evidence")
      return res.json()
    },
  })
}

export function useSecurityEvidenceItem(id: string | undefined) {
  return useQuery<{ data: SecurityEvidence }>({
    queryKey: ["security-evidence-item", id],
    queryFn: async () => {
      const res = await fetch(`/api/security/evidence/${id}`)
      if (!res.ok) throw new Error("Failed to fetch evidence")
      return res.json()
    },
    enabled: !!id,
  })
}

export interface CreateEvidenceInput extends Partial<Omit<SecurityEvidence, "id" | "createdAt" | "updatedAt" | "controlsCount" | "collectedById" | "collectedByName">> {
  controlIds?: string[]
}

export function useCreateSecurityEvidence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateEvidenceInput) => {
      const res = await fetch("/api/security/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create evidence")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-evidence"] })
    },
  })
}

export function useUpdateSecurityEvidence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SecurityEvidence> }) => {
      const res = await fetch(`/api/security/evidence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update evidence")
      }
      return res.json()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["security-evidence"] })
      queryClient.invalidateQueries({ queryKey: ["security-evidence-item", id] })
    },
  })
}

export function useDeleteSecurityEvidence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/security/evidence/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete evidence")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-evidence"] })
    },
  })
}

// ============================================================================
// FRAMEWORKS HOOKS
// ============================================================================

export function useSecurityFrameworks() {
  return useQuery<{ data: SecurityFramework[] }>({
    queryKey: ["security-frameworks"],
    queryFn: async () => {
      const res = await fetch("/api/security/frameworks")
      if (!res.ok) throw new Error("Failed to fetch frameworks")
      return res.json()
    },
  })
}

export function useSecurityFramework(id: string | undefined) {
  return useQuery<{ data: SecurityFramework }>({
    queryKey: ["security-framework", id],
    queryFn: async () => {
      const res = await fetch(`/api/security/frameworks/${id}`)
      if (!res.ok) throw new Error("Failed to fetch framework")
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateSecurityFramework() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<SecurityFramework>) => {
      const res = await fetch("/api/security/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create framework")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-frameworks"] })
    },
  })
}

export function useUpdateSecurityFramework() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SecurityFramework> }) => {
      const res = await fetch(`/api/security/frameworks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update framework")
      }
      return res.json()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["security-frameworks"] })
      queryClient.invalidateQueries({ queryKey: ["security-framework", id] })
    },
  })
}

export function useDeleteSecurityFramework() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/security/frameworks/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete framework")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-frameworks"] })
    },
  })
}

// ============================================================================
// STANDARD CONTROLS HOOKS
// ============================================================================

export function useStandardControls(frameworkCode?: string) {
  return useQuery<{ data: StandardControl[] }>({
    queryKey: ["standard-controls", frameworkCode],
    queryFn: async () => {
      const url = frameworkCode 
        ? `/api/security/standard-controls?framework=${frameworkCode}`
        : "/api/security/standard-controls"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch standard controls")
      return res.json()
    },
  })
}

// ============================================================================
// RISKS HOOKS
// ============================================================================

interface RisksQueryParams {
  search?: string
  category?: string
  status?: string
  inherentLevel?: string
  residualLevel?: string
  ownerId?: string
  page?: number
  limit?: number
}

export function useSecurityRisks(params: RisksQueryParams = {}) {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      queryParams.set(key, String(value))
    }
  })

  return useQuery<PaginatedResponse<SecurityRisk>>({
    queryKey: ["security-risks", params],
    queryFn: async () => {
      const res = await fetch(`/api/security/risks?${queryParams}`)
      if (!res.ok) throw new Error("Failed to fetch risks")
      return res.json()
    },
  })
}

export function useSecurityRisk(id: string | undefined) {
  return useQuery<{ data: SecurityRisk }>({
    queryKey: ["security-risk", id],
    queryFn: async () => {
      const res = await fetch(`/api/security/risks/${id}`)
      if (!res.ok) throw new Error("Failed to fetch risk")
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateSecurityRisk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<SecurityRisk>) => {
      const res = await fetch("/api/security/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create risk")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-risks"] })
    },
  })
}

export function useUpdateSecurityRisk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SecurityRisk> }) => {
      const res = await fetch(`/api/security/risks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update risk")
      }
      return res.json()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["security-risks"] })
      queryClient.invalidateQueries({ queryKey: ["security-risk", id] })
    },
  })
}

export function useDeleteSecurityRisk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/security/risks/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete risk")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-risks"] })
    },
  })
}

// ============================================================================
// AUDITS HOOKS
// ============================================================================

interface AuditsQueryParams {
  search?: string
  type?: string
  status?: string
  frameworkId?: string
  page?: number
  limit?: number
}

export function useSecurityAudits(params: AuditsQueryParams = {}) {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      queryParams.set(key, String(value))
    }
  })

  return useQuery<PaginatedResponse<SecurityAudit>>({
    queryKey: ["security-audits", params],
    queryFn: async () => {
      const res = await fetch(`/api/security/audits?${queryParams}`)
      if (!res.ok) throw new Error("Failed to fetch audits")
      return res.json()
    },
  })
}

export function useSecurityAudit(id: string | undefined) {
  return useQuery<{ data: SecurityAudit }>({
    queryKey: ["security-audit", id],
    queryFn: async () => {
      const res = await fetch(`/api/security/audits/${id}`)
      if (!res.ok) throw new Error("Failed to fetch audit")
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateSecurityAudit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<SecurityAudit>) => {
      const res = await fetch("/api/security/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create audit")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-audits"] })
    },
  })
}

// ============================================================================
// SOA HOOKS
// ============================================================================

export interface SoaSummary {
  total: number
  applicable: number
  notApplicable: number
  implemented: number
  partial: number
  notImplemented: number
}

export function useSoaItems(frameworkId: string | undefined) {
  return useQuery<{
    data: SoaItem[]
    grouped: Record<string, SoaItem[]>
    categories: string[]
    summary: SoaSummary
  }>({
    queryKey: ["soa-items", frameworkId],
    queryFn: async () => {
      const res = await fetch(`/api/security/soa/${frameworkId}`)
      if (!res.ok) throw new Error("Failed to fetch SoA items")
      return res.json()
    },
    enabled: !!frameworkId,
  })
}

export function useUpdateSoaItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      frameworkId,
      itemId,
      data,
    }: {
      frameworkId: string
      itemId: string
      data: Partial<SoaItem>
    }) => {
      const res = await fetch(`/api/security/soa/${frameworkId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update SoA item")
      }
      return res.json()
    },
    onSuccess: (_, { frameworkId }) => {
      queryClient.invalidateQueries({ queryKey: ["soa-items", frameworkId] })
    },
  })
}

export function useInitializeSoa() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (frameworkId: string) => {
      const res = await fetch(`/api/security/soa/${frameworkId}/initialize`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to initialize SoA")
      }
      return res.json()
    },
    onSuccess: (_, frameworkId) => {
      queryClient.invalidateQueries({ queryKey: ["soa-items", frameworkId] })
      queryClient.invalidateQueries({ queryKey: ["security-framework", frameworkId] })
    },
  })
}

// ============================================================================
// OBJECTIVES HOOKS
// ============================================================================

export interface SecurityObjective {
  id: string
  objectiveId: string
  title: string
  description?: string | null
  category?: string | null
  priority: "low" | "medium" | "high" | "critical"
  status: "not_started" | "in_progress" | "completed" | "cancelled"
  progress: number
  targetDate?: string | null
  completedAt?: string | null
  kpis?: string[] | null
  ownerId?: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  createdAt: string
  updatedAt: string
}

interface ObjectivesQueryParams {
  search?: string
  status?: string
  priority?: string
  page?: number
  limit?: number
}

export function useSecurityObjectives(params: ObjectivesQueryParams = {}) {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      queryParams.set(key, String(value))
    }
  })

  return useQuery<PaginatedResponse<SecurityObjective>>({
    queryKey: ["security-objectives", params],
    queryFn: async () => {
      const res = await fetch(`/api/security/objectives?${queryParams}`)
      if (!res.ok) throw new Error("Failed to fetch objectives")
      return res.json()
    },
  })
}

export function useCreateSecurityObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<SecurityObjective>) => {
      const res = await fetch("/api/security/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create objective")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-objectives"] })
    },
  })
}

// ============================================================================
// ISMS CLAUSE TYPES
// ============================================================================

export interface StandardClause {
  id: string
  frameworkCode: string
  clauseId: string
  parentClauseId: string | null
  title: string
  description: string | null
  guidance: string | null
  evidenceExamples: string | null
  category: string | null
  sortOrder: number
  children?: StandardClause[]
}

export interface ClauseCompliance {
  id: string
  orgId: string
  frameworkId: string
  standardClauseId: string
  complianceStatus: "not_addressed" | "partially_addressed" | "fully_addressed" | "verified"
  ownerId: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  targetDate: string | null
  implementationNotes: string | null
  evidenceDescription: string | null
  linkedEvidenceIds: string[] | null
  linkedDocumentIds: string[] | null
  lastReviewedAt: string | null
  lastReviewedById: string | null
  createdAt: string
  updatedAt: string
}

export interface ClauseComplianceWithClause {
  standardClause: StandardClause
  compliance: ClauseCompliance | null
  ownerName: string | null
  ownerEmail: string | null
}

export interface ClauseComplianceSummary {
  total: number
  notAddressed: number
  partiallyAddressed: number
  fullyAddressed: number
  verified: number
  compliancePercent: number
}

// ============================================================================
// STANDARD CLAUSES HOOKS
// ============================================================================

export function useStandardClauses(frameworkCode: string = "iso-27001") {
  return useQuery<{
    data: StandardClause[]
    hierarchy: StandardClause[]
    total: number
  }>({
    queryKey: ["standard-clauses", frameworkCode],
    queryFn: async () => {
      const res = await fetch(`/api/security/standard-clauses?framework=${frameworkCode}`)
      if (!res.ok) throw new Error("Failed to fetch standard clauses")
      return res.json()
    },
    enabled: !!frameworkCode,
  })
}

// ============================================================================
// CLAUSE COMPLIANCE HOOKS
// ============================================================================

export function useClauseCompliance(frameworkId: string | undefined) {
  return useQuery<{
    data: ClauseComplianceWithClause[]
    summary: ClauseComplianceSummary
  }>({
    queryKey: ["clause-compliance", frameworkId],
    queryFn: async () => {
      const res = await fetch(`/api/security/clauses?frameworkId=${frameworkId}`)
      if (!res.ok) throw new Error("Failed to fetch clause compliance")
      return res.json()
    },
    enabled: !!frameworkId,
  })
}

export function useClauseComplianceDetail(id: string | undefined) {
  return useQuery<{
    data: ClauseCompliance & { standardClause: StandardClause }
  }>({
    queryKey: ["clause-compliance-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/security/clauses/${id}`)
      if (!res.ok) throw new Error("Failed to fetch clause compliance detail")
      return res.json()
    },
    enabled: !!id,
  })
}

export function useUpdateClauseCompliance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id?: string
      frameworkId: string
      standardClauseId: string
      complianceStatus?: ClauseCompliance["complianceStatus"]
      ownerId?: string | null
      targetDate?: string | null
      implementationNotes?: string | null
      evidenceDescription?: string | null
      linkedEvidenceIds?: string[]
      linkedDocumentIds?: string[]
      lastReviewedAt?: string | null
    }) => {
      // If we have an ID, update; otherwise create/upsert via POST
      if (data.id) {
        const res = await fetch(`/api/security/clauses/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || "Failed to update clause compliance")
        }
        return res.json()
      } else {
        const res = await fetch("/api/security/clauses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || "Failed to save clause compliance")
        }
        return res.json()
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clause-compliance", variables.frameworkId] })
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ["clause-compliance-detail", variables.id] })
      }
    },
  })
}

export function useDeleteClauseCompliance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, frameworkId }: { id: string; frameworkId: string }) => {
      const res = await fetch(`/api/security/clauses/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete clause compliance")
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clause-compliance", variables.frameworkId] })
    },
  })
}

