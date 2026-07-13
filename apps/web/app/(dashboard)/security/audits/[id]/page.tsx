"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { format } from "date-fns"
import { z } from "zod"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCreateSecurityAuditFinding,
  useDeleteSecurityAudit,
  useDeleteSecurityAuditFinding,
  useSecurityAudit,
  useSecurityEvidence,
  useUpdateSecurityAudit,
  useUpdateSecurityAuditFinding,
  type AuditFindingSeverity,
  type AuditFindingStatus,
  type SecurityAuditFinding,
  type SecurityEvidence,
} from "@/lib/api/security"
import { findingSeverityValues, findingStatusValues } from "@/lib/db/schema/security"
import type { FieldConfig, FormConfig } from "@/components/primitives/form-drawer"
import { useUser } from "@/lib/rbac/context"

const severityLabels: Record<AuditFindingSeverity, string> = {
  observation: "Observation",
  nonconformity: "Nonconformity",
  minor: "Minor Nonconformity",
  major: "Major Nonconformity",
  critical: "Critical",
}

const severityBadge: Record<AuditFindingSeverity, string> = {
  observation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  nonconformity: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  major: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  critical: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300",
}

const statusLabels: Record<AuditFindingStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  verified: "Verified",
  closed: "Closed",
}

const findingFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  severity: z.enum(findingSeverityValues),
  recommendation: z.string().optional(),
  dueDate: z.string().optional(),
  evidence: z.string().optional(),
  linkedEvidenceIds: z.array(z.string()).optional().default([]),
  resolution: z.string().optional(),
})

const editAuditSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  scope: z.string().optional(),
  objectives: z.string().optional(),
  leadAuditor: z.string().optional(),
  auditBody: z.string().optional(),
  summary: z.string().optional(),
  conclusion: z.string().optional(),
})

const editAuditFormConfig: FormConfig = {
  title: {
    component: "input",
    label: "Title",
    required: true,
    type: "text",
  },
  scope: {
    component: "textarea",
    label: "Scope",
  },
  objectives: {
    component: "textarea",
    label: "Objectives",
  },
  leadAuditor: {
    component: "input",
    label: "Lead Auditor",
    type: "text",
  },
  auditBody: {
    component: "input",
    label: "Audit Body/Firm",
    type: "text",
  },
  summary: {
    component: "textarea",
    label: "Summary",
    placeholder: "Audit summary",
  },
  conclusion: {
    component: "textarea",
    label: "Conclusion",
    placeholder: "Overall audit conclusion",
  },
}

function buildEvidenceFieldConfig(evidenceList: SecurityEvidence[]): FieldConfig {
  return {
    component: "custom",
    label: "Linked Evidence (optional)",
    helpText: "Attach Evidence Store items to this finding",
    render: ({ value, onChange, disabled }) => {
      const selected = Array.isArray(value) ? (value as string[]) : []
      if (evidenceList.length === 0) {
        return (
          <p className="text-sm text-muted-foreground py-2">
            No evidence available.{" "}
            <Link href="/security/evidence" className="text-primary hover:underline">
              Add evidence
            </Link>{" "}
            first.
          </p>
        )
      }
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
          {evidenceList.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <label
                key={item.id}
                className={`flex items-start gap-3 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(isChecked) => {
                    const next = isChecked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id)
                    onChange(next)
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium block">{item.title}</span>
                  <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                </span>
              </label>
            )
          })}
        </div>
      )
    },
  }
}

export default function AuditDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { hasPermission } = useUser()
  const canEdit = hasPermission("security.audits", "edit") || hasPermission("security.audits", "create")
  const canDelete = hasPermission("security.audits", "delete")

  const [createFindingOpen, setCreateFindingOpen] = useState(false)
  const [editingFinding, setEditingFinding] = useState<SecurityAuditFinding | null>(null)
  const [editAuditOpen, setEditAuditOpen] = useState(false)
  const [deleteAuditOpen, setDeleteAuditOpen] = useState(false)
  const [deleteFinding, setDeleteFinding] = useState<SecurityAuditFinding | null>(null)
  const [defaultSeverity, setDefaultSeverity] = useState<AuditFindingSeverity>("observation")

  const { data, isLoading } = useSecurityAudit(id)
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const updateAudit = useUpdateSecurityAudit()
  const deleteAudit = useDeleteSecurityAudit()
  const createFinding = useCreateSecurityAuditFinding(id)
  const updateFinding = useUpdateSecurityAuditFinding(id)
  const removeFinding = useDeleteSecurityAuditFinding(id)

  const audit = data?.data
  const findings = audit?.findings ?? []
  const evidenceList = evidenceData?.data ?? []

  const evidenceById = useMemo(() => {
    const map = new Map<string, SecurityEvidence>()
    for (const item of evidenceList) map.set(item.id, item)
    return map
  }, [evidenceList])

  const findingFormConfig: FormConfig = useMemo(
    () => ({
      title: {
        component: "input",
        label: "Title",
        placeholder: "Finding title",
        required: true,
        type: "text",
      },
      description: {
        component: "textarea",
        label: "Description",
        placeholder: "Describe the finding (ISO 27001:2022)",
      },
      severity: {
        component: "select",
        label: "Classification",
        required: true,
        options: [
          { value: "observation", label: "Observation" },
          { value: "nonconformity", label: "Nonconformity" },
          { value: "minor", label: "Minor Nonconformity" },
          { value: "major", label: "Major Nonconformity" },
        ],
      },
      recommendation: {
        component: "textarea",
        label: "Recommendation / Corrective Action",
        placeholder: "Recommended remediation",
      },
      dueDate: {
        component: "input",
        label: "Due Date",
        type: "date",
      },
      evidence: {
        component: "textarea",
        label: "Evidence Notes (optional)",
        placeholder: "Notes about supporting evidence",
      },
      linkedEvidenceIds: buildEvidenceFieldConfig(evidenceList),
      resolution: {
        component: "textarea",
        label: "Resolution Notes",
        placeholder: "How this finding was closed / remediated",
      },
    }),
    [evidenceList]
  )

  const openCounts = useMemo(
    () => findings.filter((f) => f.status !== "closed" && f.status !== "verified").length,
    [findings]
  )

  const handleAuditStatus = async (status: NonNullable<typeof audit>["status"]) => {
    try {
      await updateAudit.mutateAsync({ id, data: { status } })
      toast.success("Audit status updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update audit")
    }
  }

  const handleCreateFinding = async (values: z.infer<typeof findingFormSchema>) => {
    try {
      await createFinding.mutateAsync({
        ...values,
        linkedEvidenceIds: values.linkedEvidenceIds ?? [],
      })
      toast.success("Finding added")
      setCreateFindingOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add finding")
    }
  }

  const handleEditAudit = async (values: z.infer<typeof editAuditSchema>) => {
    try {
      await updateAudit.mutateAsync({
        id,
        data: {
          title: values.title,
          scope: values.scope || null,
          objectives: values.objectives || null,
          leadAuditor: values.leadAuditor || null,
          auditBody: values.auditBody || null,
          summary: values.summary || null,
          conclusion: values.conclusion || null,
        },
      })
      toast.success("Audit updated")
      setEditAuditOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update audit")
    }
  }

  const handleUpdateFinding = async (values: z.infer<typeof findingFormSchema>) => {
    if (!editingFinding) return
    try {
      await updateFinding.mutateAsync({
        findingId: editingFinding.id,
        data: {
          ...values,
          linkedEvidenceIds: values.linkedEvidenceIds ?? [],
        },
      })
      toast.success("Finding updated")
      setEditingFinding(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update finding")
    }
  }

  const handleCloseFinding = async (finding: SecurityAuditFinding) => {
    try {
      await updateFinding.mutateAsync({
        findingId: finding.id,
        data: { status: "closed" },
      })
      toast.success("Finding closed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close finding")
    }
  }

  const handleFindingStatus = async (finding: SecurityAuditFinding, status: AuditFindingStatus) => {
    try {
      await updateFinding.mutateAsync({
        findingId: finding.id,
        data: { status },
      })
      toast.success("Finding status updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    }
  }

  const handleDeleteAudit = async () => {
    try {
      await deleteAudit.mutateAsync(id)
      toast.success("Audit deleted")
      router.push("/security/audits")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete audit")
    }
  }

  const handleDeleteFinding = async () => {
    if (!deleteFinding) return
    try {
      await removeFinding.mutateAsync(deleteFinding.id)
      toast.success("Finding deleted")
      setDeleteFinding(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete finding")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Audit not found</p>
        <Button variant="link" asChild className="mt-4">
          <Link href="/security/audits">Back to audits</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={audit.title} description={`${audit.auditId} · ISO 27001:2022 audit findings`}>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditAuditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
        {canEdit && (
          <Select value={audit.status} onValueChange={(v) => handleAuditStatus(v as typeof audit.status)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        )}
        {canDelete && (
          <Button variant="outline" size="sm" onClick={() => setDeleteAuditOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </PageHeader>

      <Button variant="ghost" size="sm" asChild>
        <Link href="/security/audits">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to audits
        </Link>
      </Button>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={audit.type === "external" ? "default" : "secondary"} className="capitalize">
              {audit.type.replace("_", " ")}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openCounts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Major / Minor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {audit.majorFindingsCount} / {audit.minorFindingsCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{audit.findingsCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Audit Details</CardTitle>
            <CardDescription>{audit.frameworkName || "No framework linked"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {audit.leadAuditor && (
              <div>
                <p className="text-muted-foreground">Lead Auditor</p>
                <p className="font-medium">{audit.leadAuditor}</p>
              </div>
            )}
            {audit.auditBody && (
              <div>
                <p className="text-muted-foreground">Audit Body</p>
                <p className="font-medium">{audit.auditBody}</p>
              </div>
            )}
            {audit.startDate && (
              <div>
                <p className="text-muted-foreground">Start</p>
                <p className="font-medium">{format(new Date(audit.startDate), "MMM d, yyyy")}</p>
              </div>
            )}
            {audit.endDate && (
              <div>
                <p className="text-muted-foreground">End</p>
                <p className="font-medium">{format(new Date(audit.endDate), "MMM d, yyyy")}</p>
              </div>
            )}
            {audit.scope && (
              <div>
                <p className="text-muted-foreground">Scope</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{audit.scope}</p>
              </div>
            )}
            {audit.objectives && (
              <div>
                <p className="text-muted-foreground">Objectives</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{audit.objectives}</p>
              </div>
            )}
            {audit.summary && (
              <div>
                <p className="text-muted-foreground">Summary</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{audit.summary}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Conclusion</p>
              <p className="whitespace-pre-wrap">
                {audit.conclusion || <span className="text-muted-foreground">No conclusion recorded yet.</span>}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Findings (ISO 27001:2022)
                </CardTitle>
                <CardDescription>
                  Observations, nonconformities, minor and major findings. Close items and attach optional evidence.
                </CardDescription>
              </div>
              <Protected module="security.audits" anyAction={["create", "edit"]}>
                <div className="flex flex-wrap gap-2">
                  {(["observation", "nonconformity", "minor", "major"] as AuditFindingSeverity[]).map((severity) => (
                    <Button
                      key={severity}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDefaultSeverity(severity)
                        setCreateFindingOpen(true)
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {severity === "minor"
                        ? "Minor"
                        : severity === "major"
                          ? "Major"
                          : severityLabels[severity]}
                    </Button>
                  ))}
                </div>
              </Protected>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {findings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No findings yet. Add observations, nonconformities, minor or major items.
              </p>
            ) : (
              findings.map((finding) => {
                const linked = (finding.linkedEvidenceIds ?? [])
                  .map((eid) => evidenceById.get(eid))
                  .filter(Boolean) as SecurityEvidence[]
                const isClosed = finding.status === "closed" || finding.status === "verified"

                return (
                  <div key={finding.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{finding.findingId}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityBadge[finding.severity]}`}>
                            {severityLabels[finding.severity]}
                          </span>
                          <Badge variant="outline">{statusLabels[finding.status]}</Badge>
                        </div>
                        <p className="font-medium">{finding.title}</p>
                        {finding.description && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{finding.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {canEdit && (
                          <>
                            <Select
                              value={finding.status}
                              onValueChange={(v) => handleFindingStatus(finding, v as AuditFindingStatus)}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {findingStatusValues.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {statusLabels[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!isClosed && (
                              <Button size="sm" variant="secondary" onClick={() => handleCloseFinding(finding)}>
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Close
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setEditingFinding(finding)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {canDelete && (
                          <Button size="sm" variant="ghost" onClick={() => setDeleteFinding(finding)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {(finding.recommendation || finding.dueDate || finding.resolution) && (
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        {finding.recommendation && (
                          <div>
                            <p className="text-muted-foreground text-xs">Recommendation</p>
                            <p>{finding.recommendation}</p>
                          </div>
                        )}
                        {finding.dueDate && (
                          <div>
                            <p className="text-muted-foreground text-xs">Due</p>
                            <p>{format(new Date(finding.dueDate), "MMM d, yyyy")}</p>
                          </div>
                        )}
                        {finding.resolution && (
                          <div className="sm:col-span-2">
                            <p className="text-muted-foreground text-xs">Resolution</p>
                            <p>{finding.resolution}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {(linked.length > 0 || finding.evidence) && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <FileCheck className="h-3.5 w-3.5" />
                          Evidence
                        </p>
                        {finding.evidence && (
                          <p className="text-sm text-muted-foreground">{finding.evidence}</p>
                        )}
                        {linked.map((item) => (
                          <Link
                            key={item.id}
                            href={`/security/evidence/${item.id}`}
                            className="block text-sm text-primary hover:underline"
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <FormDrawer
        open={createFindingOpen}
        onOpenChange={setCreateFindingOpen}
        title="Add Finding"
        description="Add an ISO 27001:2022 audit finding"
        schema={findingFormSchema}
        config={findingFormConfig}
        defaultValues={{
          severity: defaultSeverity,
          linkedEvidenceIds: [],
        }}
        fields={[
          "title",
          "severity",
          "description",
          "recommendation",
          "dueDate",
          "evidence",
          "linkedEvidenceIds",
        ]}
        mode="create"
        onSubmit={handleCreateFinding}
      />

      <FormDrawer
        open={editAuditOpen}
        onOpenChange={setEditAuditOpen}
        title="Edit Audit"
        description={audit.auditId}
        schema={editAuditSchema}
        config={editAuditFormConfig}
        defaultValues={{
          title: audit.title,
          scope: audit.scope ?? "",
          objectives: audit.objectives ?? "",
          leadAuditor: audit.leadAuditor ?? "",
          auditBody: audit.auditBody ?? "",
          summary: audit.summary ?? "",
          conclusion: audit.conclusion ?? "",
        }}
        fields={["title", "scope", "objectives", "leadAuditor", "auditBody", "summary", "conclusion"]}
        mode="edit"
        onSubmit={handleEditAudit}
      />

      <FormDrawer
        key={editingFinding?.id ?? "edit-finding"}
        open={!!editingFinding}
        onOpenChange={(open) => !open && setEditingFinding(null)}
        title="Edit Finding"
        description={editingFinding?.findingId}
        schema={findingFormSchema}
        config={findingFormConfig}
        defaultValues={
          editingFinding
            ? {
                title: editingFinding.title,
                description: editingFinding.description ?? "",
                severity: editingFinding.severity,
                recommendation: editingFinding.recommendation ?? "",
                dueDate: editingFinding.dueDate ?? "",
                evidence: editingFinding.evidence ?? "",
                linkedEvidenceIds: editingFinding.linkedEvidenceIds ?? [],
                resolution: editingFinding.resolution ?? "",
              }
            : undefined
        }
        fields={[
          "title",
          "severity",
          "description",
          "recommendation",
          "dueDate",
          "evidence",
          "linkedEvidenceIds",
          "resolution",
        ]}
        mode="edit"
        onSubmit={handleUpdateFinding}
      />

      <AlertDialog open={deleteAuditOpen} onOpenChange={setDeleteAuditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete audit?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {audit.auditId} and all of its findings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAudit}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFinding} onOpenChange={(open) => !open && setDeleteFinding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete finding?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {deleteFinding?.findingId} — {deleteFinding?.title}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFinding}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
