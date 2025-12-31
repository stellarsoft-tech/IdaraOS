"use client"

import * as React from "react"
import {
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  Loader2,
  MoreHorizontal,
  Play,
  Shield,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { useAcknowledgments, useUpdateRollout, useDeleteRollout } from "@/lib/api/docs"
import { usePermission } from "@/lib/rbac/hooks"
import type { RolloutWithTarget, AcknowledgmentWithUser } from "@/lib/docs/types"

// Helper functions
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

// Status config
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "Pending", variant: "secondary" },
  viewed: { label: "Viewed", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  acknowledged: { label: "Acknowledged", variant: "outline", className: "border-green-500 text-green-600" },
  signed: { label: "Signed", variant: "outline", className: "border-green-500 text-green-600 bg-green-500/10" },
}

// Columns for rollout acknowledgments table (without document column)
const rolloutAckColumns: ColumnDef<AcknowledgmentWithUser>[] = [
  {
    id: "userName",
    accessorKey: "userName",
    header: "User",
    cell: ({ row }) => {
      const ack = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{getInitials(ack.userName || "?")}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{ack.userName}</span>
            <span className="text-xs text-muted-foreground">{ack.userEmail}</span>
          </div>
        </div>
      )
    },
    enableSorting: true,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const config = statusConfig[status]
      return (
        <Badge 
          variant={config?.variant ?? "secondary"} 
          className={config?.className}
        >
          {config?.label ?? status}
        </Badge>
      )
    },
    enableSorting: true,
  },
  {
    id: "versionAcknowledged",
    accessorKey: "versionAcknowledged",
    header: "Version",
    cell: ({ row }) => {
      const version = row.getValue("versionAcknowledged") as string | null
      return version ? (
        <Badge variant="outline">v{version}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
    enableSorting: true,
  },
  {
    id: "viewedAt",
    accessorKey: "viewedAt",
    header: "Viewed At",
    cell: ({ row }) => {
      const viewedAt = row.getValue("viewedAt") as string | null
      return (
        <span className={viewedAt ? "" : "text-muted-foreground"}>
          {formatDateTime(viewedAt)}
        </span>
      )
    },
    enableSorting: true,
  },
  {
    id: "acknowledgedAt",
    accessorKey: "acknowledgedAt",
    header: "Completed At",
    cell: ({ row }) => {
      const ack = row.original
      const completedAt = ack.signedAt || ack.acknowledgedAt
      return (
        <span className={completedAt ? "" : "text-muted-foreground"}>
          {formatDateTime(completedAt)}
        </span>
      )
    },
    enableSorting: true,
  },
]

// Requirement labels
const requirementLabels: Record<string, string> = {
  optional: "Optional",
  required: "Required",
  required_with_signature: "Requires Signature",
}

// Target type icons
const targetTypeIcons: Record<string, React.ReactNode> = {
  organization: <Globe className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
  role: <Shield className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
}

interface RolloutDetailDrawerProps {
  rollout: RolloutWithTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRolloutUpdated?: () => void
}

export function RolloutDetailDrawer({ rollout, open, onOpenChange, onRolloutUpdated }: RolloutDetailDrawerProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  
  const { data: acksData, isLoading } = useAcknowledgments(
    rollout?.id ? { rolloutId: rollout.id } : undefined
  )
  const updateRollout = useUpdateRollout()
  const deleteRollout = useDeleteRollout()
  
  // RBAC permissions
  const canDelete = usePermission("docs.rollouts", "delete")
  const canEdit = usePermission("docs.rollouts", "write")
  
  const acknowledgments = acksData?.data || []
  
  if (!rollout) return null
  
  const handleToggleActive = async () => {
    try {
      await updateRollout.mutateAsync({
        id: rollout.id,
        data: { isActive: !rollout.isActive },
      })
      toast.success(rollout.isActive ? "Rollout deactivated" : "Rollout activated")
      onRolloutUpdated?.()
    } catch (error) {
      toast.error("Failed to update rollout")
    }
  }
  
  const handleDelete = async () => {
    try {
      await deleteRollout.mutateAsync(rollout.id)
      toast.success("Rollout deleted successfully")
      setShowDeleteDialog(false)
      onOpenChange(false)
      onRolloutUpdated?.()
    } catch (error) {
      toast.error("Failed to delete rollout")
    }
  }
  
  const isUpdating = updateRollout.isPending || deleteRollout.isPending
  
  // Calculate stats from acknowledgments
  const stats = {
    total: acknowledgments.length,
    pending: acknowledgments.filter((a) => a.status === "pending").length,
    viewed: acknowledgments.filter((a) => a.status === "viewed").length,
    completed: acknowledgments.filter((a) => ["acknowledged", "signed"].includes(a.status)).length,
  }
  
  const completionPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  
  // Status options for faceted filter
  const statusOptions = [
    { label: "Pending", value: "pending" },
    { label: "Viewed", value: "viewed" },
    { label: "Acknowledged", value: "acknowledged" },
    { label: "Signed", value: "signed" },
  ]
  
  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl w-full overflow-y-auto p-6">
        <SheetHeader className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-xl">
                {rollout.name || `Rollout - ${new Date(rollout.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                {targetTypeIcons[rollout.targetType]}
                <span>{rollout.targetName || rollout.targetType}</span>
              </SheetDescription>
            </div>
            
            {/* Actions Menu */}
            {(canEdit || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isUpdating}>
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <DropdownMenuItem onClick={handleToggleActive}>
                      {rollout.isActive ? (
                        <>
                          <Archive className="mr-2 h-4 w-4" />
                          Deactivate Rollout
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Activate Rollout
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Rollout
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </SheetHeader>
        
        {/* Rollout Info Header */}
        <div className="mt-6 space-y-4">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Requirement:</span>
              <Badge variant={rollout.requirement === "required_with_signature" ? "default" : "secondary"}>
                {requirementLabels[rollout.requirement] || rollout.requirement}
              </Badge>
            </div>
            
            {rollout.dueDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Due:</span>
                <span className="font-medium">{new Date(rollout.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={rollout.isActive ? "default" : "secondary"}>
                {rollout.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          
          {/* Progress Section */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Completion Progress</span>
              <span className="text-muted-foreground">{stats.completed}/{stats.total} completed</span>
            </div>
            <Progress value={completionPercent} className="h-2" />
            
            {/* Mini Stats */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              <div className="text-center">
                <p className="text-lg font-semibold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-yellow-600">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-600">{stats.viewed}</p>
                <p className="text-xs text-muted-foreground">Viewed</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-green-600">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Acknowledgments Table */}
        <div className="mt-6">
          <h4 className="font-medium mb-3">Individual Records</h4>
          <DataTable
            columns={rolloutAckColumns}
            data={acknowledgments}
            loading={isLoading}
            searchKey="userName"
            searchPlaceholder="Search by name..."
            facetedFilters={{
              status: {
                type: "enum",
                options: statusOptions,
              },
            }}
            enableSorting
            enableColumnFilters
            enableExport
            emptyState={
              <div className="text-center py-8">
                <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No acknowledgment records found
                </p>
              </div>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
    
    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Rollout</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this rollout? This will also delete all {acknowledgments.length} acknowledgment records associated with it.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteRollout.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteRollout.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteRollout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

