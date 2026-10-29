"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, KeyRound, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, UserCheck } from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { AccessDenied, Protected } from "@/components/primitives/protected"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  useAccessGroupsList,
  useAccessRegisterList,
  useCreateAccessRegisterEntry,
  useDeleteAccessRegisterEntry,
  useUpdateAccessRegisterEntry,
  type AccessRegisterEntry,
} from "@/lib/api/access-control"
import { useUsersList } from "@/lib/api/users"
import { useCanAccess, usePermission } from "@/lib/rbac/context"

const reviewVariants: Record<AccessRegisterEntry["reviewStatus"], "default" | "secondary" | "outline" | "destructive"> = {
  not_reviewed: "outline",
  approved: "default",
  changes_required: "destructive",
  revoked: "secondary",
}

const reviewStatusOptions: { value: AccessRegisterEntry["reviewStatus"]; label: string }[] = [
  { value: "not_reviewed", label: "Not reviewed" },
  { value: "approved", label: "Approved" },
  { value: "changes_required", label: "Changes required" },
  { value: "revoked", label: "Revoked" },
]

function formatDate(value: string | null) {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
}

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return ""
  const date = typeof value === "string" ? new Date(value) : value
  return date.toISOString().slice(0, 10)
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null
}

function getDefaultReviewDate() {
  const date = new Date()
  date.setDate(date.getDate() + 90)
  return toDateInputValue(date)
}

function StatsCard({
  title,
  value,
  subtitle,
  loading,
}: {
  title: string
  value: number | string
  subtitle: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-1 h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <KeyRound className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export default function AccessRegisterPage() {
  const canAccess = useCanAccess("people.access-register")
  const canCreate = usePermission("people.access-register", "create")
  const canEdit = usePermission("people.access-register", "edit")
  const canDelete = usePermission("people.access-register", "delete")

  const [assignOpen, setAssignOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AccessRegisterEntry | null>(null)
  const [userId, setUserId] = useState("")
  const [accessGroupId, setAccessGroupId] = useState("")
  const [reviewDueAt, setReviewDueAt] = useState(getDefaultReviewDate())
  const [reviewStatus, setReviewStatus] = useState<AccessRegisterEntry["reviewStatus"]>("not_reviewed")
  const [notes, setNotes] = useState("")

  const { data: register = [], isLoading } = useAccessRegisterList()
  const { data: groups = [] } = useAccessGroupsList()
  const { data: users = [] } = useUsersList()
  const createMutation = useCreateAccessRegisterEntry()
  const updateMutation = useUpdateAccessRegisterEntry()
  const deleteMutation = useDeleteAccessRegisterEntry()

  const activeGroups = useMemo(() => groups.filter((group) => group.status === "active"), [groups])

  const editGroupOptions = useMemo(() => {
    if (!selectedEntry) return activeGroups
    const current = groups.find((group) => group.id === selectedEntry.accessGroupId)
    if (!current || activeGroups.some((group) => group.id === current.id)) return activeGroups
    return [current, ...activeGroups]
  }, [activeGroups, groups, selectedEntry])

  const stats = useMemo(() => {
    const today = new Date()
    const approved = register.filter((entry) => entry.reviewStatus === "approved").length
    const changesRequired = register.filter((entry) => entry.reviewStatus === "changes_required").length
    const overdue = register.filter((entry) => entry.reviewDueAt && new Date(entry.reviewDueAt) < today && entry.reviewStatus !== "approved").length
    return { approved, changesRequired, overdue }
  }, [register])

  const resetAssignForm = () => {
    setUserId("")
    setAccessGroupId("")
    setReviewDueAt(getDefaultReviewDate())
    setNotes("")
  }

  const openEditDialog = (entry: AccessRegisterEntry) => {
    setSelectedEntry(entry)
    setAccessGroupId(entry.accessGroupId)
    setReviewDueAt(toDateInputValue(entry.reviewDueAt))
    setReviewStatus(entry.reviewStatus)
    setNotes(entry.notes ?? "")
    setEditOpen(true)
  }

  const handleAssign = async () => {
    if (!userId || !accessGroupId) {
      toast.error("Select a user and access group")
      return
    }

    try {
      await createMutation.mutateAsync({
        userId,
        accessGroupId,
        reviewDueAt: toIsoDate(reviewDueAt),
        notes: notes || undefined,
      })
      toast.success("Access group assigned successfully")
      setAssignOpen(false)
      resetAssignForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign access group")
    }
  }

  const handleEdit = async () => {
    if (!selectedEntry || !accessGroupId) {
      toast.error("Select an access group")
      return
    }

    try {
      await updateMutation.mutateAsync({
        id: selectedEntry.id,
        data: {
          accessGroupId,
          reviewDueAt: toIsoDate(reviewDueAt),
          reviewStatus,
          notes: notes || null,
          ...(reviewStatus !== selectedEntry.reviewStatus
            ? { lastReviewedAt: new Date().toISOString() }
            : {}),
        },
      })
      toast.success("Access register entry updated")
      setEditOpen(false)
      setSelectedEntry(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update access register entry")
    }
  }

  const handleReviewStatus = async (entry: AccessRegisterEntry, nextStatus: AccessRegisterEntry["reviewStatus"]) => {
    try {
      await updateMutation.mutateAsync({
        id: entry.id,
        data: {
          reviewStatus: nextStatus,
          lastReviewedAt: new Date().toISOString(),
        },
      })
      toast.success("Access review updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update access review")
    }
  }

  const handleRevoke = async () => {
    if (!selectedEntry) return

    try {
      await deleteMutation.mutateAsync(selectedEntry.id)
      toast.success("Access group revoked")
      setRevokeOpen(false)
      setSelectedEntry(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke access group")
    }
  }

  const columns: ColumnDef<AccessRegisterEntry>[] = useMemo(() => [
    {
      accessorKey: "user.name",
      header: "User",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.user.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.user.email}</div>
        </div>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      accessorKey: "accessGroup.name",
      header: "Access Group",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.accessGroup.name}</div>
          <div className="flex gap-1 pt-1">
            {row.original.accessGroup.isoControls.slice(0, 2).map((control) => (
              <Badge key={control} variant="outline" className="text-[10px]">{control}</Badge>
            ))}
          </div>
        </div>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: "includesString",
    },
    {
      accessorKey: "person.role.name",
      header: "People Role / Team",
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{row.original.person?.role?.name ?? "No linked people role"}</div>
          <div className="text-xs text-muted-foreground">{row.original.person?.team?.name ?? "No linked people team"}</div>
        </div>
      ),
    },
    {
      accessorKey: "user.role",
      header: "System Role",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.user.role}</Badge>
      ),
    },
    {
      accessorKey: "accessGroup.riskLevel",
      header: "Risk",
      cell: ({ row }) => (
        <Badge variant={row.original.accessGroup.riskLevel === "critical" ? "destructive" : "outline"}>
          {row.original.accessGroup.riskLevel}
        </Badge>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "reviewDueAt",
      header: "Review Due",
      cell: ({ row }) => {
        const dueAt = row.original.reviewDueAt
        const overdue = dueAt ? new Date(dueAt) < new Date() && row.original.reviewStatus !== "approved" : false
        return (
          <span className={overdue ? "text-sm font-medium text-destructive" : "text-sm"}>
            {formatDate(dueAt)}
          </span>
        )
      },
      enableSorting: true,
    },
    {
      accessorKey: "reviewStatus",
      header: "Review Status",
      cell: ({ row }) => (
        <Badge variant={reviewVariants[row.original.reviewStatus]}>
          {row.original.reviewStatus.replace("_", " ")}
        </Badge>
      ),
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const entry = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Protected module="people.access-register" action="edit" fallback={null}>
                <DropdownMenuItem onClick={() => openEditDialog(entry)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleReviewStatus(entry, "approved")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Review
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleReviewStatus(entry, "changes_required")}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Changes Required
                </DropdownMenuItem>
              </Protected>
              <Protected module="people.access-register" action="delete" fallback={null}>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setSelectedEntry(entry)
                    setRevokeOpen(true)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Revoke Access
                </DropdownMenuItem>
              </Protected>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      size: 50,
    },
  ], [])

  if (!canAccess) {
    return (
      <PageShell title="Access Register">
        <AccessDenied
          title="Access Denied"
          description="You don't have permission to view the access register."
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Access Register"
      description="See access groups granted to users, linked account context, and ISO 27001:2022 access review status."
      action={
        <Protected module="people.access-register" action="create" fallback={null}>
          <Button onClick={() => setAssignOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign Access Group
          </Button>
        </Protected>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Assignments" value={register.length} subtitle="Access groups granted" loading={isLoading} />
        <StatsCard title="Approved" value={stats.approved} subtitle="Reviewed as appropriate" loading={isLoading} />
        <StatsCard title="Changes Required" value={stats.changesRequired} subtitle="Needs remediation" loading={isLoading} />
        <StatsCard title="Overdue" value={stats.overdue} subtitle="Past review due date" loading={isLoading} />
      </div>

      <DataTable
        columns={columns}
        data={register}
        loading={isLoading}
        searchPlaceholder="Search users or access groups..."
        enableSorting
        enableColumnFilters
        enableColumnVisibility
        enableExport
      />

      <Dialog open={assignOpen} onOpenChange={(open) => {
        setAssignOpen(open)
        if (!open) resetAssignForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Access Group</DialogTitle>
            <DialogDescription>
              Grant a defined access group to a system user and set the next access review date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userId} onValueChange={setUserId} disabled={!canCreate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email}) - {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access Group</Label>
              <Select value={accessGroupId} onValueChange={setAccessGroupId} disabled={!canCreate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select access group" />
                </SelectTrigger>
                <SelectContent>
                  {activeGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.riskLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviewDueAt">Review Due Date</Label>
              <Input
                id="reviewDueAt"
                type="date"
                value={reviewDueAt}
                onChange={(event) => setReviewDueAt(event.target.value)}
                disabled={!canCreate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional approval notes or constraints"
                disabled={!canCreate}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!canCreate || createMutation.isPending}>
              <UserCheck className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedEntry(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Access Register Entry</DialogTitle>
            <DialogDescription>
              Update the access group, review schedule, and review status for {selectedEntry?.user.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Input
                value={selectedEntry ? `${selectedEntry.user.name} (${selectedEntry.user.email})` : ""}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label>Access Group</Label>
              <Select value={accessGroupId} onValueChange={setAccessGroupId} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select access group" />
                </SelectTrigger>
                <SelectContent>
                  {editGroupOptions.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.riskLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editReviewDueAt">Review Due Date</Label>
              <Input
                id="editReviewDueAt"
                type="date"
                value={reviewDueAt}
                onChange={(event) => setReviewDueAt(event.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>Review Status</Label>
              <Select
                value={reviewStatus}
                onValueChange={(value) => setReviewStatus(value as AccessRegisterEntry["reviewStatus"])}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select review status" />
                </SelectTrigger>
                <SelectContent>
                  {reviewStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Textarea
                id="editNotes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional approval notes or constraints"
                disabled={!canEdit}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!canEdit || updateMutation.isPending}>
              <Pencil className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access Group</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke &quot;{selectedEntry?.accessGroup.name}&quot; from {selectedEntry?.user.name}? This removes the register assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEntry(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={!canDelete || deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
