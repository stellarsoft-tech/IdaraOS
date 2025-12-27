"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { 
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Workflow,
  CheckCircle2,
  Clock,
  PlayCircle,
  PauseCircle,
  Users,
  UserPlus,
  UserMinus,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { PageShell } from "@/components/primitives/page-shell"
import { DataTable } from "@/components/primitives/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

// Stats Card Component
interface StatsCardProps {
  readonly title: string
  readonly value: number
  readonly icon: React.ReactNode
  readonly color: string
  readonly loading?: boolean
}

function StatsCard({ title, value, icon, color, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

// Table columns
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
    accessorKey: "triggerType",
    header: "Type",
    cell: ({ row }) => {
      const triggerType = row.original.template?.triggerType
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
      }
      const config = typeConfig[triggerType ?? "manual"] ?? typeConfig.manual
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
          {config.icon}
          {config.label}
        </span>
      )
    },
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

export default function PeopleWorkflowsPage() {
  const canAccess = useCanAccess("people.directory")
  
  // State for filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  
  // Query instances for "person" entity type
  const { data: allInstances = [], isLoading } = useWorkflowInstancesList({
    entityType: "person",
    status: statusFilter !== "all" ? statusFilter : undefined,
  })
  
  // Query templates for people module
  const { data: templates = [] } = useWorkflowTemplatesList({ 
    moduleScope: "people",
    activeOnly: true,
  })
  
  // Filter instances by trigger type (client-side)
  const instances = useMemo(() => {
    if (typeFilter === "all") return allInstances
    return allInstances.filter(i => i.template?.triggerType === typeFilter)
  }, [allInstances, typeFilter])
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = allInstances.length
    const inProgress = allInstances.filter(i => i.status === "in_progress" || i.status === "pending").length
    const completed = allInstances.filter(i => i.status === "completed").length
    const onboarding = allInstances.filter(i => i.template?.triggerType === "onboarding" && i.status !== "completed" && i.status !== "cancelled").length
    const offboarding = allInstances.filter(i => i.template?.triggerType === "offboarding" && i.status !== "completed" && i.status !== "cancelled").length
    return { total, inProgress, completed, onboarding, offboarding }
  }, [allInstances])
  
  if (!canAccess) {
    return (
      <PageShell title="People Workflows">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view people workflows." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="People Workflows"
      description="View and manage workflows related to employees."
      action={
        <Button asChild variant="outline">
          <Link href="/workflows/templates?moduleScope=people">
            <Workflow className="h-4 w-4 mr-2" />
            View Templates
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatsCard 
            title="Total Workflows" 
            value={stats.total}
            icon={<Workflow className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            color="bg-blue-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="In Progress" 
            value={stats.inProgress}
            icon={<PlayCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            color="bg-amber-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="Completed" 
            value={stats.completed}
            icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
            color="bg-green-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="Onboarding" 
            value={stats.onboarding}
            icon={<UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            color="bg-emerald-500/10"
            loading={isLoading}
          />
          <StatsCard 
            title="Offboarding" 
            value={stats.offboarding}
            icon={<UserMinus className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
            color="bg-rose-500/10"
            loading={isLoading}
          />
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : instances.length === 0 && statusFilter === "all" && typeFilter === "all" ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No people workflows</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Workflows will appear here when onboarding or offboarding is triggered for employees.
              Configure automatic workflows in People Settings.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/people/settings">
                  Configure Workflows
                </Link>
              </Button>
              <Button asChild>
                <Link href="/workflows/templates?moduleScope=people">
                  Create Template
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={instances}
            searchKey="name"
            searchPlaceholder="Search workflows..."
            toolbarEnd={
              <>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="offboarding">Offboarding</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
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
      </div>
    </PageShell>
  )
}

