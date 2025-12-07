"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  MoreHorizontal, 
  UserMinus, 
  Users,
  HardDrive,
  Calendar,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"

// API hooks
import { 
  useAssignmentsList, 
  useReturnAsset,
  type Assignment,
} from "@/lib/api/assets"

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

export default function AssignmentsPage() {
  const canAccess = useCanAccess("assets.assignments")
  const canEdit = usePermission("assets.assignments", "edit")
  const router = useRouter()
  
  // State - default to showing full history (transactional log)
  const [includeReturned, setIncludeReturned] = useState(true)
  const [returnOpen, setReturnOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [returnNotes, setReturnNotes] = useState<string>("")
  
  // Fetch data
  const { data: assignments = [], isLoading, error } = useAssignmentsList({ includeReturned })
  
  // Mutations
  const returnMutation = useReturnAsset()
  
  // Calculate stats
  const stats = useMemo(() => {
    const current = assignments.filter(a => !a.returnedAt).length
    const returned = assignments.filter(a => a.returnedAt).length
    const uniqueAssets = new Set(assignments.map(a => a.assetId)).size
    const uniquePeople = new Set(assignments.map(a => a.personId)).size
    
    return { current, returned, uniqueAssets, uniquePeople }
  }, [assignments])
  
  // Table columns
  const columns: ColumnDef<Assignment>[] = [
    {
      id: "asset",
      header: "Asset",
      accessorFn: (row) => row.asset.assetTag,
      cell: ({ row }) => {
        const assignment = row.original
        return (
          <div className="flex flex-col">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/assets/inventory/${assignment.assetId}`)
              }}
              className="text-sm font-medium !font-mono text-primary hover:underline text-left"
            >
              {assignment.asset.assetTag}
            </button>
            <span className="text-xs text-muted-foreground">{assignment.asset.name}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 180,
    },
    {
      id: "model",
      header: "Model",
      accessorFn: (row) => row.asset.model,
      cell: ({ row }) => row.original.asset.model || <span className="text-muted-foreground">—</span>,
      size: 150,
    },
    {
      id: "person",
      header: "Assigned To",
      accessorFn: (row) => row.person.name,
      cell: ({ row }) => {
        const assignment = row.original
        return (
          <div className="flex flex-col">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/people/directory/${assignment.person.slug}`)
              }}
              className="text-sm font-medium text-primary hover:underline text-left"
            >
              {assignment.person.name}
            </button>
            <span className="text-xs text-muted-foreground">{assignment.person.email}</span>
          </div>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 200,
    },
    {
      id: "assignedAt",
      header: "Assigned",
      accessorKey: "assignedAt",
      cell: ({ row }) => {
        const date = new Date(row.original.assignedAt)
        return (
          <div className="flex flex-col">
            <span className="text-sm">{date.toLocaleDateString()}</span>
            <span className="text-xs text-muted-foreground">{date.toLocaleTimeString()}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 120,
    },
    {
      id: "returnedAt",
      header: "Returned",
      accessorKey: "returnedAt",
      cell: ({ row }) => {
        const returnedAt = row.original.returnedAt
        if (!returnedAt) {
          return <span className="text-muted-foreground">—</span>
        }
        const date = new Date(returnedAt)
        return (
          <div className="flex flex-col">
            <span className="text-sm">{date.toLocaleDateString()}</span>
            <span className="text-xs text-muted-foreground">{date.toLocaleTimeString()}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 120,
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const assignedAt = new Date(row.original.assignedAt)
        const endDate = row.original.returnedAt 
          ? new Date(row.original.returnedAt) 
          : new Date()
        
        const diffMs = endDate.getTime() - assignedAt.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        
        if (diffDays === 0) {
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
          return <span className="text-sm text-muted-foreground">{diffHours}h</span>
        } else if (diffDays < 30) {
          return <span className="text-sm">{diffDays}d</span>
        } else if (diffDays < 365) {
          const months = Math.floor(diffDays / 30)
          return <span className="text-sm">{months}mo</span>
        } else {
          const years = Math.floor(diffDays / 365)
          const remainingMonths = Math.floor((diffDays % 365) / 30)
          return <span className="text-sm">{years}y {remainingMonths}mo</span>
        }
      },
      enableSorting: false,
      size: 80,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isReturned = !!row.original.returnedAt
        return isReturned ? (
          <Badge variant="secondary">Returned</Badge>
        ) : (
          <Badge variant="default" className="bg-green-600 hover:bg-green-600">Active</Badge>
        )
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 100,
    },
    {
      id: "assignedBy",
      header: "Assigned By",
      accessorFn: (row) => row.assignedBy?.name,
      cell: ({ row }) => {
        const assignedBy = row.original.assignedBy
        if (!assignedBy) return <span className="text-muted-foreground">—</span>
        return <span className="text-sm">{assignedBy.name}</span>
      },
      size: 150,
    },
    {
      id: "notes",
      header: "Notes",
      accessorKey: "notes",
      cell: ({ row }) => {
        const notes = row.original.notes
        if (!notes) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[150px]" title={notes}>
            {notes.length > 30 ? `${notes.slice(0, 30)}...` : notes}
          </span>
        )
      },
      size: 150,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const assignment = row.original
        const isReturned = !!assignment.returnedAt
        
        if (isReturned) return null
        
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
                  router.push(`/assets/inventory/${assignment.assetId}`)
                }}
              >
                View Asset
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault()
                  router.push(`/people/directory/${assignment.person.slug}`)
                }}
              >
                View Person
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem 
                  onSelect={(e) => { 
                    e.preventDefault()
                    setSelectedAssignment(assignment)
                    setReturnNotes("")
                    setReturnOpen(true)
                  }}
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Return Asset
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      size: 50,
    },
  ]
  
  // Handlers
  const handleReturn = async () => {
    if (!selectedAssignment) return
    try {
      const result = await returnMutation.mutateAsync({ 
        id: selectedAssignment.assetId,
        notes: returnNotes || undefined,
      })
      toast.success(result.message)
      setReturnOpen(false)
      setSelectedAssignment(null)
      setReturnNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return asset")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Assignments">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view asset assignments." 
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell
        title="Assignments"
        description="Track asset assignments to people."
      >
        <div className="flex items-center justify-center h-64 text-destructive">
          Failed to load assignments
        </div>
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Asset Assignments"
      description="Complete transactional history of all asset assignments and returns."
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Active Assignments"
            value={stats.current}
            subtitle="currently assigned"
            icon={<ArrowRightLeft className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Unique Assets"
            value={stats.uniqueAssets}
            subtitle="with assignment history"
            icon={<HardDrive className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="People"
            value={stats.uniquePeople}
            subtitle="have/had assignments"
            icon={<Users className="h-4 w-4" />}
            loading={isLoading}
          />
          <StatsCard
            title="Returned"
            value={stats.returned}
            subtitle="total returned"
            icon={<Calendar className="h-4 w-4" />}
            loading={isLoading}
          />
        </div>

        {/* Assignments Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Assignment Log</CardTitle>
                <CardDescription>
                  {includeReturned 
                    ? "Complete chain of custody for all assets." 
                    : "Currently active assignments only."}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-returned"
                  checked={includeReturned}
                  onCheckedChange={setIncludeReturned}
                />
                <Label htmlFor="include-returned" className="text-sm text-muted-foreground">
                  {includeReturned ? "Full history" : "Active only"}
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={assignments}
              loading={isLoading}
              searchKey="person"
              searchPlaceholder="Search by person or asset..."
              enableColumnFilters
              enableSorting
              enableExport
              enableColumnVisibility
              emptyState={
                <div className="text-center py-12">
                  <ArrowRightLeft className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No assignments found</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    {includeReturned 
                      ? "No assignment history yet." 
                      : "No active assignments. Try enabling 'Show returned' to see history."}
                  </p>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Return Dialog */}
      <Dialog open={returnOpen} onOpenChange={(open) => {
        setReturnOpen(open)
        if (!open) {
          setSelectedAssignment(null)
          setReturnNotes("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>
              Return {selectedAssignment?.asset.name} ({selectedAssignment?.asset.assetTag}) from {selectedAssignment?.person.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedAssignment && selectedAssignment.asset.source === "intune_sync" && selectedAssignment.asset.syncEnabled && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Intune Sync Warning</AlertTitle>
                <AlertDescription>
                  This asset is synced from Microsoft Intune. After returning it here, you must also manually unassign the device from the user in Intune. Otherwise, the next sync will automatically re-assign it to the same person.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="return-notes">Notes (optional)</Label>
              <Textarea
                id="return-notes"
                placeholder="Add any notes about this return (condition, reason, etc.)..."
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnOpen(false)
                setSelectedAssignment(null)
                setReturnNotes("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReturn}
              disabled={returnMutation.isPending}
            >
              {returnMutation.isPending ? "Returning..." : "Return Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
