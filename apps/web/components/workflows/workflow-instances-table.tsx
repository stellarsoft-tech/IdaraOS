"use client"

import { useMemo } from "react"
import Link from "next/link"
import { 
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Workflow,
  UserPlus,
  UserMinus,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InstanceStatusBadge, type InstanceStatus } from "@/components/workflows"
import { 
  useCancelWorkflowInstance,
  type WorkflowInstance,
} from "@/lib/api/workflows"
import { toast } from "sonner"

// Type config for colored pill styling
const typeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  onboarding: { 
    label: "Onboarding", 
    icon: <UserPlus className="h-3 w-3" />,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  },
  offboarding: { 
    label: "Offboarding", 
    icon: <UserMinus className="h-3 w-3" />,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  },
  manual: { 
    label: "Manual", 
    icon: <Workflow className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  },
  asset_provisioning: { 
    label: "Asset Provisioning", 
    icon: <Workflow className="h-3 w-3" />,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
  },
  review: { 
    label: "Review", 
    icon: <Workflow className="h-3 w-3" />,
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
  },
}

// All available trigger type options
const allTriggerTypeOptions = [
  { label: "Manual", value: "manual" },
  { label: "Onboarding", value: "onboarding" },
  { label: "Offboarding", value: "offboarding" },
  { label: "Asset Provisioning", value: "asset_provisioning" },
  { label: "Review", value: "review" },
]

// Module-specific trigger type options
const moduleTriggerTypes: Record<string, string[]> = {
  people: ["manual", "onboarding", "offboarding", "review"],
  assets: ["manual", "asset_provisioning", "review"],
  global: ["manual", "onboarding", "offboarding", "asset_provisioning", "review"],
}

// Actions cell component to avoid hooks issues
function ActionsCell({ instance }: { instance: WorkflowInstance }) {
  const cancelMutation = useCancelWorkflowInstance()
  
  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(instance.id)
      toast.success("Workflow cancelled")
    } catch {
      toast.error("Failed to cancel workflow")
    }
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/workflows/instances/${instance.id}`}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Link>
        </DropdownMenuItem>
        {instance.status !== "completed" && instance.status !== "cancelled" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={handleCancel}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Workflow
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Column definitions
const columns: ColumnDef<WorkflowInstance>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Workflow",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ row }) => (
      <div className="min-w-[200px]">
        <Link 
          href={`/workflows/instances/${row.original.id}`}
          className="font-medium hover:text-primary hover:underline"
        >
          {row.original.name}
        </Link>
        {row.original.entity && (
          <p className="text-sm text-muted-foreground">
            {row.original.entity.name}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "triggerType",
    accessorFn: (row) => row.template?.triggerType || "manual",
    header: "Type",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ row }) => {
      const triggerType = row.original.template?.triggerType || "manual"
      const config = typeConfig[triggerType] ?? typeConfig.manual
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
          {config.icon}
          {config.label}
        </span>
      )
    },
    filterFn: (row, _columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true
      const triggerType = row.original.template?.triggerType || "manual"
      return filterValue.includes(triggerType)
    },
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ row }) => (
      <InstanceStatusBadge status={row.original.status as InstanceStatus} size="sm" />
    ),
    filterFn: (row, _columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true
      return filterValue.includes(row.original.status)
    },
  },
  {
    id: "progress",
    accessorKey: "progress",
    header: "Progress",
    enableSorting: true,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 min-w-[120px]">
        <Progress value={row.original.progress} className="h-2 w-16" />
        <span className="text-sm text-muted-foreground">
          {row.original.completedSteps}/{row.original.totalSteps}
        </span>
      </div>
    ),
  },
  {
    id: "templateName",
    accessorFn: (row) => row.template?.name || "Unknown",
    header: "Template",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ row }) => (
      <span className="text-sm truncate max-w-[150px]">
        {row.original.template?.name || "Unknown"}
      </span>
    ),
    filterFn: (row, _columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true
      const templateName = row.original.template?.name || "Unknown"
      return filterValue.includes(templateName)
    },
  },
  {
    id: "ownerName",
    accessorFn: (row) => row.owner?.name || "",
    header: "Owner",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ row }) => {
      if (!row.original.owner) {
        return <span className="text-muted-foreground text-sm">—</span>
      }
      return (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
            {row.original.owner.name.charAt(0)}
          </div>
          <span className="text-sm truncate max-w-[100px]">{row.original.owner.name}</span>
        </div>
      )
    },
    filterFn: (row, _columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true
      const ownerName = row.original.owner?.name || ""
      return filterValue.includes(ownerName)
    },
  },
  {
    id: "dueAt",
    accessorKey: "dueAt",
    header: "Due",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ row }) => {
      if (!row.original.dueAt) return <span className="text-muted-foreground">—</span>
      
      const date = new Date(row.original.dueAt)
      const isOverdue = row.original.status !== "completed" && 
                        row.original.status !== "cancelled" && 
                        date < new Date()
      
      return (
        <div className={`flex items-center gap-1 text-sm ${isOverdue ? "text-red-600" : ""}`}>
          {isOverdue && <AlertCircle className="h-3 w-3" />}
          {formatDistanceToNow(date, { addSuffix: true })}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.dueAt ? new Date(rowA.original.dueAt).getTime() : Infinity
      const b = rowB.original.dueAt ? new Date(rowB.original.dueAt).getTime() : Infinity
      return a - b
    },
  },
  {
    id: "startedAt",
    accessorKey: "startedAt",
    header: "Started",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ row }) => {
      if (!row.original.startedAt) return <span className="text-muted-foreground">—</span>
      return (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.startedAt), { addSuffix: true })}
        </span>
      )
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.startedAt ? new Date(rowA.original.startedAt).getTime() : 0
      const b = rowB.original.startedAt ? new Date(rowB.original.startedAt).getTime() : 0
      return b - a // Most recent first
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell instance={row.original} />,
    size: 60,
  },
]

export interface WorkflowInstancesTableProps {
  /** Workflow instances data */
  instances: WorkflowInstance[]
  /** Loading state */
  isLoading?: boolean
  /** Module scope to filter trigger type options (people, assets, global) */
  moduleScope?: "people" | "assets" | "global"
  /** Custom empty state */
  emptyState?: React.ReactNode
  /** Search placeholder text */
  searchPlaceholder?: string
}

export function WorkflowInstancesTable({
  instances,
  isLoading = false,
  moduleScope = "global",
  emptyState,
  searchPlaceholder = "Search workflows...",
}: WorkflowInstancesTableProps) {
  // Get trigger type options based on module scope
  const triggerTypeOptions = useMemo(() => {
    const allowedTypes = moduleTriggerTypes[moduleScope] || moduleTriggerTypes.global
    return allTriggerTypeOptions.filter(opt => allowedTypes.includes(opt.value))
  }, [moduleScope])
  
  // Compute dynamic filter options from data
  const templateOptions = useMemo(() => {
    const uniqueTemplates = new Map<string, string>()
    instances.forEach(i => {
      if (i.template?.name) {
        uniqueTemplates.set(i.template.name, i.template.name)
      }
    })
    return Array.from(uniqueTemplates.values())
      .sort()
      .map(name => ({ label: name, value: name }))
  }, [instances])
  
  const ownerOptions = useMemo(() => {
    const uniqueOwners = new Map<string, string>()
    instances.forEach(i => {
      if (i.owner?.name) {
        uniqueOwners.set(i.owner.name, i.owner.name)
      }
    })
    return Array.from(uniqueOwners.values())
      .sort()
      .map(name => ({ label: name, value: name }))
  }, [instances])
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }
  
  if (instances.length === 0 && emptyState) {
    return <>{emptyState}</>
  }
  
  return (
    <DataTable
      columns={columns}
      data={instances}
      searchKey="name"
      searchPlaceholder={searchPlaceholder}
      enableSorting
      enableColumnFilters
      enableColumnVisibility
      enableExport
      facetedFilters={{
        status: {
          type: "enum",
          options: [
            { label: "Pending", value: "pending" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Cancelled", value: "cancelled" },
            { label: "On Hold", value: "on_hold" },
          ],
        },
        triggerType: {
          type: "enum",
          options: triggerTypeOptions,
        },
        templateName: {
          type: "enum",
          options: templateOptions,
        },
        ownerName: {
          type: "enum",
          options: ownerOptions,
        },
        dueAt: {
          type: "date",
        },
        startedAt: {
          type: "date",
        },
      }}
      initialColumnVisibility={{
        startedAt: false,
      }}
      emptyState={
        emptyState || (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workflows found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your filters
            </p>
          </div>
        )
      }
    />
  )
}

