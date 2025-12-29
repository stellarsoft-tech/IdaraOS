"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Shield, FileCheck, Link2 } from "lucide-react"
import { z } from "zod"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  useSecurityControls, 
  useCreateSecurityControl,
  type SecurityControl 
} from "@/lib/api/security"
import { 
  controlTypeValues, 
  controlCategoryValues 
} from "@/lib/db/schema/security"
import { toast } from "sonner"

// Framework display names
const frameworkLabels: Record<string, { label: string; color: string }> = {
  "iso-27001": { label: "ISO", color: "bg-blue-500" },
  "soc-2": { label: "SOC 2", color: "bg-green-500" },
}

// Status badge variants
const statusVariants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Active", variant: "default" },
  inactive: { label: "Inactive", variant: "secondary" },
  under_review: { label: "Under Review", variant: "outline" },
}

const implementationStatusVariants: Record<string, { label: string; className: string }> = {
  not_implemented: { label: "Not Implemented", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  partially_implemented: { label: "Partial", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  implemented: { label: "Implemented", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  effective: { label: "Effective", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
}

// Table columns
const columns = [
  {
    accessorKey: "controlId",
    header: "Control ID",
    cell: ({ row }: { row: { original: SecurityControl } }) => (
      <span className="font-medium">{row.original.controlId}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }: { row: { original: SecurityControl } }) => (
      <div>
        <p className="font-medium">{row.original.title}</p>
        {row.original.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }: { row: { original: SecurityControl } }) => (
      <span className="text-sm">{row.original.ownerName || "Unassigned"}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityControl } }) => {
      const variant = statusVariants[row.original.status]
      return (
        <Badge variant={variant?.variant || "default"}>
          {variant?.label || row.original.status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "implementationStatus",
    header: "Implementation",
    cell: ({ row }: { row: { original: SecurityControl } }) => {
      const variant = implementationStatusVariants[row.original.implementationStatus]
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant?.className || ""}`}>
          {variant?.label || row.original.implementationStatus}
        </span>
      )
    },
  },
  {
    accessorKey: "frameworkCodes",
    header: "Frameworks",
    cell: ({ row }: { row: { original: SecurityControl & { frameworkCodes?: string[] } } }) => {
      const frameworks = row.original.frameworkCodes || []
      const mappingsCount = row.original.mappingsCount || 0
      
      if (frameworks.length === 0) {
        return (
          <span className="text-xs text-muted-foreground">No mappings</span>
        )
      }
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                {frameworks.map(code => {
                  const fw = frameworkLabels[code] || { label: code, color: "bg-gray-500" }
                  return (
                    <span 
                      key={code} 
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${fw.color}`}
                    >
                      {fw.label}
                    </span>
                  )
                })}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{mappingsCount} standard control{mappingsCount !== 1 ? "s" : ""} mapped</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }: { row: { original: SecurityControl } }) => (
      <span className="text-sm text-muted-foreground">{row.original.category || "-"}</span>
    ),
  },
]

// Form schema
const createFormSchema = z.object({
  controlId: z.string().min(1, "Control ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  controlType: z.string().optional(),
  implementationStatus: z.enum(["not_implemented", "partially_implemented", "implemented", "effective"]).default("not_implemented"),
  reviewFrequencyDays: z.coerce.number().int().min(1).max(365).optional(),
})

// Form config
const formConfig = {
  controlId: {
    component: "input" as const,
    label: "Control ID",
    placeholder: "e.g., CTL-001",
    required: true,
    type: "text",
  },
  title: {
    component: "input" as const,
    label: "Title",
    placeholder: "Enter control title",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "Describe the control",
  },
  category: {
    component: "select" as const,
    label: "Category",
    placeholder: "Select category",
    options: controlCategoryValues.map(v => ({ 
      value: v, 
      label: v.charAt(0).toUpperCase() + v.slice(1) 
    })),
  },
  controlType: {
    component: "select" as const,
    label: "Control Type",
    placeholder: "Select type",
    options: controlTypeValues.map(v => ({ 
      value: v, 
      label: v.charAt(0).toUpperCase() + v.slice(1) 
    })),
  },
  implementationStatus: {
    component: "select" as const,
    label: "Implementation Status",
    placeholder: "Select status",
    options: [
      { value: "not_implemented", label: "Not Implemented" },
      { value: "partially_implemented", label: "Partially Implemented" },
      { value: "implemented", label: "Implemented" },
      { value: "effective", label: "Effective" },
    ],
    required: true,
  },
  reviewFrequencyDays: {
    component: "input" as const,
    label: "Review Frequency (days)",
    placeholder: "e.g., 90",
    type: "number",
  },
}

export default function ControlsPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  
  const { data: controlsData, isLoading } = useSecurityControls()
  const createControl = useCreateSecurityControl()
  
  const controls = controlsData?.data || []
  
  // Calculate stats
  const effectiveCount = controls.filter(c => c.implementationStatus === "effective").length
  const implementedCount = controls.filter(c => c.implementationStatus === "implemented").length
  const partialCount = controls.filter(c => c.implementationStatus === "partially_implemented").length
  const notImplementedCount = controls.filter(c => c.implementationStatus === "not_implemented").length
  
  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    try {
      await createControl.mutateAsync(values)
      toast.success("Control created successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create control")
    }
  }
  
  return (
    <PageShell
      title="Controls Library"
      description="Manage security controls and track their implementation status."
      action={
        <Protected module="security.controls" action="write">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Control
          </Button>
        </Protected>
      }
    >
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Effective</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{effectiveCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-400">Implemented</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-300">{implementedCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Partial</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-yellow-900 dark:text-yellow-300">{partialCount}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Total Controls</span>
          </div>
          <p className="text-2xl font-bold mt-1">{controls.length}</p>
        </div>
      </div>
      
      <DataTable
        columns={columns}
        data={controls}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search controls..."
        onRowClick={(control) => router.push(`/security/controls/${control.id}`)}
        facetedFilters={{
          status: {
            type: "enum",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "Under Review", value: "under_review" },
            ],
          },
          implementationStatus: {
            type: "enum",
            options: [
              { label: "Not Implemented", value: "not_implemented" },
              { label: "Partial", value: "partially_implemented" },
              { label: "Implemented", value: "implemented" },
              { label: "Effective", value: "effective" },
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
        onOpenChange={setCreateOpen}
        title="Create Control"
        description="Add a new security control to the library"
        schema={createFormSchema}
        config={formConfig}
        fields={["controlId", "title", "description", "category", "controlType", "implementationStatus", "reviewFrequencyDays"]}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
