"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Workflow,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { PageShell } from "@/components/primitives/page-shell"
import { DataTable } from "@/components/primitives/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { InstanceStatusBadge, type InstanceStatus } from "@/components/workflows"
import { 
  useWorkflowInstancesList,
  useWorkflowTemplatesList,
  useCancelWorkflowInstance,
  type WorkflowInstance,
} from "@/lib/api/workflows"
import { toast } from "sonner"

const columns: ColumnDef<WorkflowInstance>[] = [
  {
    accessorKey: "name",
    header: "Workflow",
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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <InstanceStatusBadge status={row.original.status as InstanceStatus} size="sm" />
    ),
  },
  {
    accessorKey: "progress",
    header: "Progress",
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
    accessorKey: "template",
    header: "Template",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.template?.name || "Unknown"}
      </span>
    ),
  },
  {
    accessorKey: "owner",
    header: "Owner",
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
  },
  {
    accessorKey: "dueAt",
    header: "Due",
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
  },
  {
    accessorKey: "startedAt",
    header: "Started",
    cell: ({ row }) => {
      if (!row.original.startedAt) return <span className="text-muted-foreground">—</span>
      return (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.startedAt), { addSuffix: true })}
        </span>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const cancelMutation = useCancelWorkflowInstance()
      
      const handleCancel = async () => {
        try {
          await cancelMutation.mutateAsync(row.original.id)
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
              <Link href={`/workflows/instances/${row.original.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            {row.original.status !== "completed" && row.original.status !== "cancelled" && (
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
    },
  },
]

export default function WorkflowInstancesPage() {
  const canAccess = useCanAccess("workflows.instances")
  
  // State for filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [templateFilter, setTemplateFilter] = useState<string>("all")
  
  // Queries
  const { data: instances = [], isLoading } = useWorkflowInstancesList({
    status: statusFilter !== "all" ? statusFilter : undefined,
    templateId: templateFilter !== "all" ? templateFilter : undefined,
  })
  const { data: templates = [] } = useWorkflowTemplatesList({ activeOnly: true })
  
  if (!canAccess) {
    return (
      <PageShell title="Workflows">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view workflow instances." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Active Workflows"
      description="View and manage running workflow instances."
    >
      {/* Data Table */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : instances.length === 0 && statusFilter === "all" && templateFilter === "all" ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
          <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No workflows found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No workflow instances have been created yet
          </p>
          <Button asChild>
            <Link href="/workflows/templates">View Templates</Link>
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={instances}
          searchKey="name"
          searchPlaceholder="Search workflows..."
          toolbarEnd={
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Templates</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workflows found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your filters
              </p>
            </div>
          }
        />
      )}
    </PageShell>
  )
}

