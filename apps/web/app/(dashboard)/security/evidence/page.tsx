"use client"

import { useState, useCallback } from "react"
import { Plus, FileCheck, FileText, Image, Link, Calendar, Clock, Shield } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer, type FormConfig } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  useSecurityEvidence, 
  useCreateSecurityEvidence,
  useSecurityControls,
  type SecurityEvidence 
} from "@/lib/api/security"
import { toast } from "sonner"

// Type icons
const typeIcons: Record<string, typeof FileText> = {
  document: FileText,
  screenshot: Image,
  log: FileCheck,
  report: FileText,
  attestation: FileCheck,
  configuration: FileCheck,
  other: FileText,
}

// Status badge variants
const statusVariants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  current: { label: "Current", variant: "default" },
  expired: { label: "Expired", variant: "destructive" },
  pending_review: { label: "Pending Review", variant: "secondary" },
}

// Table columns
const columns = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }: { row: { original: SecurityEvidence } }) => {
      const Icon = typeIcons[row.original.type] || FileText
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{row.original.title}</p>
            {row.original.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                {row.original.description}
              </p>
            )}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }: { row: { original: SecurityEvidence } }) => (
      <span className="text-sm capitalize">{row.original.type.replace(/_/g, " ")}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityEvidence } }) => {
      const variant = statusVariants[row.original.status]
      return (
        <Badge variant={variant?.variant || "default"}>
          {variant?.label || row.original.status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "collectedAt",
    header: "Collected",
    cell: ({ row }: { row: { original: SecurityEvidence } }) => (
      <div className="flex items-center gap-1 text-sm">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        {format(new Date(row.original.collectedAt), "MMM d, yyyy")}
      </div>
    ),
  },
  {
    accessorKey: "validUntil",
    header: "Valid Until",
    cell: ({ row }: { row: { original: SecurityEvidence } }) => {
      if (!row.original.validUntil) return <span className="text-muted-foreground">-</span>
      const isExpired = new Date(row.original.validUntil) < new Date()
      return (
        <div className={`flex items-center gap-1 text-sm ${isExpired ? "text-red-500" : ""}`}>
          <Clock className="h-3 w-3" />
          {format(new Date(row.original.validUntil), "MMM d, yyyy")}
        </div>
      )
    },
  },
  {
    accessorKey: "controlsCount",
    header: "Controls",
    cell: ({ row }: { row: { original: SecurityEvidence } }) => (
      <div className="flex items-center gap-1">
        <Link className="h-4 w-4 text-muted-foreground" />
        <span>{row.original.controlsCount || 0}</span>
      </div>
    ),
  },
  {
    accessorKey: "collectedByName",
    header: "Collected By",
    cell: ({ row }: { row: { original: SecurityEvidence } }) => (
      <span className="text-sm">{row.original.collectedByName || "-"}</span>
    ),
  },
]

// Form schema
const createFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(["document", "screenshot", "log", "report", "attestation", "configuration", "other"]).default("document"),
  collectedAt: z.string().min(1, "Collection date is required"),
  validUntil: z.string().optional(),
  externalUrl: z.string().url().optional().or(z.literal("")),
  externalSystem: z.string().optional(),
  controlIds: z.array(z.string()).optional(),
})

// Form config
const formConfig = {
  title: {
    component: "input" as const,
    label: "Title",
    placeholder: "Enter evidence title",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "Describe the evidence",
  },
  type: {
    component: "select" as const,
    label: "Type",
    placeholder: "Select type",
    options: [
      { value: "document", label: "Document" },
      { value: "screenshot", label: "Screenshot" },
      { value: "log", label: "Log" },
      { value: "report", label: "Report" },
      { value: "attestation", label: "Attestation" },
      { value: "configuration", label: "Configuration" },
      { value: "other", label: "Other" },
    ],
    required: true,
  },
  collectedAt: {
    component: "input" as const,
    label: "Collection Date",
    type: "date",
    required: true,
  },
  validUntil: {
    component: "input" as const,
    label: "Valid Until",
    type: "date",
  },
  externalUrl: {
    component: "input" as const,
    label: "External URL",
    placeholder: "https://...",
    type: "url",
  },
  externalSystem: {
    component: "input" as const,
    label: "External System",
    placeholder: "e.g., Jira, Confluence",
    type: "text",
  },
}

export default function EvidencePage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([])
  
  const { data: evidenceData, isLoading } = useSecurityEvidence()
  const { data: controlsData } = useSecurityControls()
  const createEvidence = useCreateSecurityEvidence()
  
  const evidence = evidenceData?.data || []
  const controls = controlsData?.data || []
  
  // Calculate stats
  const currentCount = evidence.filter(e => e.status === "current").length
  const expiredCount = evidence.filter(e => e.status === "expired").length
  const pendingCount = evidence.filter(e => e.status === "pending_review").length
  
  // Handle control selection toggle
  const toggleControlSelection = useCallback((controlId: string) => {
    setSelectedControlIds(prev => 
      prev.includes(controlId)
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    )
  }, [])
  
  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    try {
      await createEvidence.mutateAsync({
        ...values,
        externalUrl: values.externalUrl || undefined,
        controlIds: selectedControlIds.length > 0 ? selectedControlIds : undefined,
      })
      toast.success("Evidence added successfully")
      setCreateOpen(false)
      setSelectedControlIds([]) // Reset selection
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add evidence")
    }
  }
  
  // Control selector component for the form
  const controlSelectorBanner = controls.length > 0 ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Link to Controls</Label>
        {selectedControlIds.length > 0 && (
          <Badge variant="secondary">{selectedControlIds.length} selected</Badge>
        )}
      </div>
      <ScrollArea className="h-[160px] rounded-md border p-3">
        <div className="space-y-2">
          {controls.map((control) => (
            <div 
              key={control.id} 
              className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id={`control-${control.id}`}
                checked={selectedControlIds.includes(control.id)}
                onCheckedChange={() => toggleControlSelection(control.id)}
              />
              <label
                htmlFor={`control-${control.id}`}
                className="flex-1 cursor-pointer text-sm leading-none"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{control.controlId}</span>
                  <span className="text-muted-foreground truncate max-w-[200px]">{control.title}</span>
                </div>
              </label>
            </div>
          ))}
        </div>
      </ScrollArea>
      <p className="text-xs text-muted-foreground">
        Select controls that this evidence supports
      </p>
    </div>
  ) : null

  return (
    <PageShell
        title="Evidence Store"
      description="Central repository for compliance artifacts and documentation."
      action={
        <Protected module="security.evidence" action="write">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Evidence
          </Button>
        </Protected>
      }
    >
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Current</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{currentCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Pending Review</span>
      </div>
          <p className="text-2xl font-bold mt-1 text-yellow-900 dark:text-yellow-300">{pendingCount}</p>
                  </div>
        <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">Expired</span>
                  </div>
          <p className="text-2xl font-bold mt-1 text-red-900 dark:text-red-300">{expiredCount}</p>
                </div>
        <div className="p-4 rounded-lg border">
          <span className="text-sm font-medium text-muted-foreground">Total Evidence</span>
          <p className="text-2xl font-bold mt-1">{evidence.length}</p>
                </div>
              </div>
      
      <DataTable
        columns={columns}
        data={evidence}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search evidence..."
        facetedFilters={{
          type: {
            type: "enum",
            options: [
              { label: "Document", value: "document" },
              { label: "Screenshot", value: "screenshot" },
              { label: "Log", value: "log" },
              { label: "Report", value: "report" },
              { label: "Attestation", value: "attestation" },
              { label: "Configuration", value: "configuration" },
              { label: "Other", value: "other" },
            ],
          },
          status: {
            type: "enum",
            options: [
              { label: "Current", value: "current" },
              { label: "Expired", value: "expired" },
              { label: "Pending Review", value: "pending_review" },
            ],
          },
        }}
        enableColumnFilters
        enableSorting
        enableExport
        enableColumnVisibility
      />
      
      <FormDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setSelectedControlIds([]) // Reset on close
        }}
        title="Add Evidence"
        description="Add a new evidence item to the store"
        schema={createFormSchema}
        config={formConfig}
        fields={["title", "description", "type", "collectedAt", "validUntil", "externalUrl", "externalSystem"]}
        mode="create"
        onSubmit={handleCreate}
        infoBanner={controlSelectorBanner}
      />
    </PageShell>
  )
}
