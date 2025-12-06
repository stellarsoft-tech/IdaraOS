"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { 
  History,
  Package,
  UserPlus,
  UserMinus,
  Wrench,
  ArrowRight,
  Archive,
  Trash2,
  Filter,
} from "lucide-react"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"

// Lifecycle event type
interface LifecycleEvent {
  id: string
  assetId: string
  asset: {
    id: string
    assetTag: string
    name: string
  }
  eventType: "acquired" | "assigned" | "returned" | "maintenance" | "transferred" | "retired" | "disposed"
  eventDate: string
  details: Record<string, unknown>
  performedBy: {
    id: string
    name: string
    email: string
  } | null
  createdAt: string
}

// Event type icons
const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  acquired: Package,
  assigned: UserPlus,
  returned: UserMinus,
  maintenance: Wrench,
  transferred: ArrowRight,
  retired: Archive,
  disposed: Trash2,
}

// Event type colors
const eventColors: Record<string, string> = {
  acquired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  returned: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  maintenance: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  transferred: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  retired: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  disposed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

// Fetch lifecycle events
async function fetchLifecycleEvents(eventType?: string): Promise<LifecycleEvent[]> {
  const params = new URLSearchParams()
  if (eventType && eventType !== "all") {
    params.set("eventType", eventType)
  }
  
  const url = params.toString() 
    ? `/api/assets/lifecycle?${params}` 
    : "/api/assets/lifecycle"
  
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch lifecycle events")
  return res.json()
}

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

export default function LifecyclePage() {
  const canAccess = useCanAccess("assets.lifecycle")
  const router = useRouter()
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")
  
  // Fetch data
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["asset-lifecycle", eventTypeFilter],
    queryFn: () => fetchLifecycleEvents(eventTypeFilter),
  })
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = events.length
    const acquired = events.filter(e => e.eventType === "acquired").length
    const retired = events.filter(e => e.eventType === "retired").length
    const disposed = events.filter(e => e.eventType === "disposed").length
    
    return { total, acquired, retired, disposed }
  }, [events])
  
  // Table columns
  const columns: ColumnDef<LifecycleEvent>[] = [
    {
      id: "eventType",
      header: "Event",
      accessorKey: "eventType",
      cell: ({ row }) => {
        const event = row.original
        const Icon = eventIcons[event.eventType] || History
        return (
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${eventColors[event.eventType] || "bg-muted"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="font-medium capitalize">{event.eventType}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 150,
    },
    {
      id: "asset",
      header: "Asset",
      accessorFn: (row) => row.asset.assetTag,
      cell: ({ row }) => {
        const event = row.original
        return (
          <div className="flex flex-col">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/assets/inventory/${event.assetId}`)
              }}
              className="text-sm font-medium text-primary hover:underline text-left"
            >
              {event.asset.assetTag}
            </button>
            <span className="text-xs text-muted-foreground">{event.asset.name}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 180,
    },
    {
      id: "eventDate",
      header: "Date",
      accessorKey: "eventDate",
      cell: ({ row }) => {
        const date = new Date(row.original.eventDate)
        return (
          <div className="flex flex-col">
            <span className="text-sm">{date.toLocaleDateString()}</span>
            <span className="text-xs text-muted-foreground">{date.toLocaleTimeString()}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 140,
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const event = row.original
        const details = event.details as Record<string, string>
        
        // Format details based on event type
        if (event.eventType === "assigned" && details.personName) {
          return <span className="text-sm">Assigned to {details.personName}</span>
        }
        if (event.eventType === "returned" && details.personName) {
          return <span className="text-sm">Returned from {details.personName}</span>
        }
        if (event.eventType === "maintenance" && details.type) {
          return <span className="text-sm capitalize">{details.type}: {details.description || "—"}</span>
        }
        if ((event.eventType === "retired" || event.eventType === "disposed") && details.previousStatus) {
          return <span className="text-sm">Previous status: {details.previousStatus}</span>
        }
        
        // Default: show notes if available
        if (details.notes) {
          return (
            <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={details.notes}>
              {details.notes.length > 40 ? `${details.notes.slice(0, 40)}...` : details.notes}
            </span>
          )
        }
        
        return <span className="text-muted-foreground">—</span>
      },
      size: 250,
    },
    {
      id: "performedBy",
      header: "Performed By",
      accessorFn: (row) => row.performedBy?.name,
      cell: ({ row }) => {
        const performer = row.original.performedBy
        if (!performer) return <span className="text-muted-foreground">System</span>
        return <span className="text-sm">{performer.name}</span>
      },
      enableSorting: true,
      size: 150,
    },
  ]
  
  if (!canAccess) {
    return (
      <PageShell title="Lifecycle">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view asset lifecycle events." 
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell
        title="Lifecycle"
        description="Track asset lifecycle events and audit trail."
      >
        <div className="flex items-center justify-center h-64 text-destructive">
          Failed to load lifecycle events
        </div>
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Asset Lifecycle"
      description="Track all asset events: acquisitions, assignments, maintenance, retirements, and disposals."
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Events"
            value={stats.total}
            subtitle="in the audit trail"
            icon={<History className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Acquisitions"
            value={stats.acquired}
            subtitle="assets added"
            icon={<Package className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Retired"
            value={stats.retired}
            subtitle="assets retired"
            icon={<Archive className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Disposed"
            value={stats.disposed}
            subtitle="assets disposed"
            icon={<Trash2 className="h-4 w-4" />}
            loading={isLoading}
          />
        </div>

        {/* Events Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lifecycle Events</CardTitle>
                <CardDescription>
                  A complete audit trail of all asset lifecycle changes.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="acquired">Acquired</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="disposed">Disposed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={events}
              loading={isLoading}
              searchKey="asset"
              searchPlaceholder="Search by asset..."
              enableSorting
              enableExport
              enableColumnVisibility
              emptyState={
                <div className="text-center py-12">
                  <History className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No lifecycle events</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    {eventTypeFilter !== "all"
                      ? `No ${eventTypeFilter} events found. Try changing the filter.`
                      : "Lifecycle events will appear here as assets are created, assigned, and managed."}
                  </p>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

