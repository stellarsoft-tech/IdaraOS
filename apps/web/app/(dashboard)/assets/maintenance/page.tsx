"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  MoreHorizontal, 
  Plus, 
  Wrench,
  Calendar,
  Clock,
  DollarSign,
} from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { z } from "zod"

// API hooks
import { 
  useMaintenanceList, 
  useCreateMaintenance,
  useAssetsList,
  type MaintenanceRecord,
  type CreateMaintenance,
} from "@/lib/api/assets"

// Status badges - using available Badge variants
const statusVariants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  scheduled: "secondary",
  in_progress: "outline",
  completed: "default",
  cancelled: "destructive",
}

const typeLabels: Record<string, string> = {
  scheduled: "Scheduled Maintenance",
  repair: "Repair",
  upgrade: "Upgrade",
}

// Form schema
const createMaintenanceSchema = z.object({
  assetId: z.string().uuid("Select an asset"),
  type: z.enum(["scheduled", "repair", "upgrade"]),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
  description: z.string().optional(),
  scheduledDate: z.string().optional(),
  cost: z.string().optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
})

// Stats card component
interface StatsCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  loading?: boolean
}

function StatsCard({ title, value, subtitle, icon, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export default function MaintenancePage() {
  const canAccess = useCanAccess("assets.maintenance")
  const _canEdit = usePermission("assets.maintenance", "edit")
  const router = useRouter()
  
  // State
  const [createOpen, setCreateOpen] = useState(false)
  
  // Fetch data
  const { data: records = [], isLoading, error } = useMaintenanceList()
  const { data: assets = [] } = useAssetsList()
  
  // Mutations
  const createMutation = useCreateMaintenance()
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = records.length
    const scheduled = records.filter(r => r.status === "scheduled").length
    const inProgress = records.filter(r => r.status === "in_progress").length
    const completed = records.filter(r => r.status === "completed").length
    const totalCost = records
      .filter(r => r.cost)
      .reduce((sum, r) => sum + parseFloat(r.cost!), 0)
    
    return { total, scheduled, inProgress, completed, totalCost }
  }, [records])
  
  // Form config with dynamic assets
  const formConfig = useMemo(() => ({
    assetId: { 
      component: "select" as const,
      label: "Asset", 
      placeholder: "Select asset", 
      options: assets.map(a => ({ value: a.id, label: `${a.assetTag} - ${a.name}` })),
    },
    type: { 
      component: "select" as const,
      label: "Type", 
      options: [
        { value: "scheduled", label: "Scheduled Maintenance" },
        { value: "repair", label: "Repair" },
        { value: "upgrade", label: "Upgrade" },
      ]
    },
    status: { 
      component: "select" as const,
      label: "Status", 
      options: [
        { value: "scheduled", label: "Scheduled" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ]
    },
    description: { component: "textarea" as const, label: "Description", placeholder: "Work to be done" },
    scheduledDate: { component: "date-picker" as const, label: "Scheduled Date" },
    cost: { component: "input" as const, label: "Estimated Cost", placeholder: "0.00" },
    vendor: { component: "input" as const, label: "Vendor/Service Provider", placeholder: "e.g., Apple Care" },
    notes: { component: "textarea" as const, label: "Notes", placeholder: "Additional notes" },
  }), [assets])
  
  const formFields = ["assetId", "type", "status", "description", "scheduledDate", "cost", "vendor", "notes"]
  
  // Table columns
  const columns: ColumnDef<MaintenanceRecord>[] = [
    {
      id: "asset",
      header: "Asset",
      accessorFn: (row) => row.asset?.assetTag,
      cell: ({ row }) => {
        const record = row.original
        if (!record.asset) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-col">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/assets/inventory/${record.assetId}`)
              }}
              className="text-sm font-medium text-primary hover:underline text-left"
            >
              {record.asset.assetTag}
            </button>
            <span className="text-xs text-muted-foreground">{record.asset.name}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 180,
    },
    {
      id: "type",
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => {
        return (
          <Badge variant="outline" className="capitalize">
            {typeLabels[row.original.type] || row.original.type}
          </Badge>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 150,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge variant={statusVariants[status] || "default"} className="capitalize">
            {status.replace("_", " ")}
          </Badge>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 120,
    },
    {
      id: "description",
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => {
        const description = row.original.description
        if (!description) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={description}>
            {description.length > 40 ? `${description.slice(0, 40)}...` : description}
          </span>
        )
      },
      size: 200,
    },
    {
      id: "scheduledDate",
      header: "Scheduled",
      accessorKey: "scheduledDate",
      cell: ({ row }) => {
        const date = row.original.scheduledDate
        if (!date) return <span className="text-muted-foreground">—</span>
        return <span className="text-sm">{new Date(date).toLocaleDateString()}</span>
      },
      enableSorting: true,
      size: 120,
    },
    {
      id: "cost",
      header: "Cost",
      accessorKey: "cost",
      cell: ({ row }) => {
        const cost = row.original.cost
        if (!cost) return <span className="text-muted-foreground">—</span>
        return <span className="text-sm">${parseFloat(cost).toLocaleString()}</span>
      },
      enableSorting: true,
      size: 100,
    },
    {
      id: "vendor",
      header: "Vendor",
      accessorKey: "vendor",
      cell: ({ row }) => row.original.vendor || <span className="text-muted-foreground">—</span>,
      size: 150,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const record = row.original
        
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault()
                  router.push(`/assets/inventory/${record.assetId}`)
                }}
              >
                View Asset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      size: 50,
    },
  ]
  
  // Handlers
  const handleCreate = async (values: CreateMaintenance) => {
    try {
      await createMutation.mutateAsync(values)
      toast.success("Maintenance ticket created")
      setCreateOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Maintenance">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view maintenance records." 
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell
        title="Maintenance"
        description="Track repairs and maintenance schedules."
      >
        <div className="flex items-center justify-center h-64 text-destructive">
          Failed to load maintenance records
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Asset Maintenance"
      description="Track repairs, scheduled maintenance, and upgrades for your assets."
      action={
        <Protected module="assets.maintenance" action="create">
          <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
            New Ticket
        </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Tickets"
            value={stats.total}
            subtitle="all time"
            icon={<Wrench className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Scheduled"
            value={stats.scheduled}
            subtitle="awaiting work"
            icon={<Calendar className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgress}
            subtitle="being worked on"
            icon={<Clock className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Total Cost"
            value={`$${stats.totalCost.toLocaleString()}`}
            subtitle="all maintenance"
            icon={<DollarSign className="h-4 w-4" />}
            loading={isLoading}
          />
      </div>

        {/* Maintenance Table */}
      <Card>
        <CardHeader>
            <CardTitle>Maintenance Records</CardTitle>
            <CardDescription>
              All maintenance tickets, repairs, and upgrades.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <DataTable
              columns={columns}
              data={records}
              loading={isLoading}
              searchKey="asset"
              searchPlaceholder="Search by asset..."
              facetedFilters={{
                status: { type: "enum" },
                type: { type: "enum" },
              }}
              enableColumnFilters
              enableSorting
              enableExport
              enableColumnVisibility
              emptyState={
                <div className="text-center py-12">
                  <Wrench className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No maintenance records</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Create a ticket when an asset needs repair or maintenance.
                  </p>
                  <Protected module="assets.maintenance" action="create">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create first ticket
                    </Button>
                  </Protected>
                </div>
              }
            />
        </CardContent>
      </Card>
    </div>
      
      {/* Create Drawer */}
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Maintenance Ticket"
        description="Create a maintenance ticket for an asset"
        schema={createMaintenanceSchema}
        config={formConfig}
        fields={formFields}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
