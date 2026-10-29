"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, Loader2, MoreHorizontal, RotateCcw, Search, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Protected } from "@/components/primitives/protected"
import { useUser } from "@/lib/rbac/context"
import {
  useAssignableTrainingUsers,
  useAssignTrainingCourse,
  useDeleteTrainingAssignment,
  useTrainingAssignments,
  useUpdateTrainingAssignment,
  type TrainingAssignment,
} from "@/lib/api/security-training"
import {
  trainingAssignmentStatusClassNames,
  trainingAssignmentStatusLabels,
} from "@/lib/security/training"

interface CourseAssignmentsProps {
  courseId: string
  courseTitle: string
  isPublished: boolean
  passingScore: number
}

export function CourseAssignments({ courseId, courseTitle, isPublished, passingScore }: CourseAssignmentsProps) {
  const { hasPermission } = useUser()
  const canEdit = hasPermission("security.training", "edit")
  const canDelete = hasPermission("security.training", "delete")
  const [assignOpen, setAssignOpen] = useState(false)
  const [removing, setRemoving] = useState<TrainingAssignment | null>(null)

  const { data, isLoading } = useTrainingAssignments(courseId)
  const updateAssignment = useUpdateTrainingAssignment(courseId)
  const deleteAssignment = useDeleteTrainingAssignment(courseId)
  const assignments = data?.data ?? []

  const handleReset = async (assignment: TrainingAssignment) => {
    try {
      await updateAssignment.mutateAsync({ id: assignment.id, reset: true })
      toast.success(`${assignment.userName} must retake the course`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset assignment")
    }
  }

  const handleRemove = async () => {
    if (!removing) return
    try {
      await deleteAssignment.mutateAsync(removing.id)
      toast.success("Assignment removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove assignment")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Pass mark: <span className="font-medium text-foreground">{passingScore}%</span>.
          Employees below the pass mark are marked <span className="font-medium">Retake Required</span> and
          must watch the video and take the quiz again.
        </p>
        <Protected module="security.training" action="create">
          <Button onClick={() => setAssignOpen(true)} disabled={!isPublished}>
            <UserPlus className="mr-2 h-4 w-4" />
            Assign Course
          </Button>
        </Protected>
      </div>

      {!isPublished && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Publish this course before assigning it to employees.
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Last Score</TableHead>
              <TableHead>Best Score</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && assignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  This course has not been assigned to anyone yet.
                </TableCell>
              </TableRow>
            )}
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.userName}</div>
                  <div className="text-xs text-muted-foreground">{a.userEmail}</div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${trainingAssignmentStatusClassNames[a.status]}`}
                  >
                    {trainingAssignmentStatusLabels[a.status]}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{a.attemptCount}</TableCell>
                <TableCell className="text-sm">
                  {a.lastScore === null ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <span className={a.lastScore >= passingScore ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {a.lastScore}%
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {a.bestScore === null ? <span className="text-muted-foreground">-</span> : `${a.bestScore}%`}
                </TableCell>
                <TableCell className="text-sm">
                  {a.dueDate ? (
                    <span className={a.isOverdue ? "font-medium text-red-600 dark:text-red-400" : undefined}>
                      {format(new Date(`${a.dueDate}T00:00:00`), "MMM d, yyyy")}
                      {a.isOverdue && " (overdue)"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {a.passedAt ? format(new Date(a.passedAt), "MMM d, yyyy") : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  {(canEdit || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${a.userName}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => handleReset(a)} disabled={a.status === "not_started"}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Require retake
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem onClick={() => setRemoving(a)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove assignment
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AssignCourseDialog
        courseId={courseId}
        courseTitle={courseTitle}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        alreadyAssignedUserIds={new Set(assignments.map((a) => a.userId))}
      />

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.userName} will no longer be required to complete &ldquo;{courseTitle}&rdquo;.
              Their attempt history for this course will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface AssignCourseDialogProps {
  courseId: string
  courseTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  alreadyAssignedUserIds: Set<string>
}

function AssignCourseDialog({
  courseId,
  courseTitle,
  open,
  onOpenChange,
  alreadyAssignedUserIds,
}: AssignCourseDialogProps) {
  const { data, isLoading } = useAssignableTrainingUsers(open)
  const assign = useAssignTrainingCourse()
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allUsers, setAllUsers] = useState(false)
  const [dueDate, setDueDate] = useState("")

  const users = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data?.data ?? []).filter(
      (u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    )
  }, [data, search])

  const reset = () => {
    setSearch("")
    setSelected(new Set())
    setAllUsers(false)
    setDueDate("")
  }

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleAssign = async () => {
    try {
      const result = await assign.mutateAsync({
        courseId,
        allUsers,
        userIds: allUsers ? undefined : Array.from(selected),
        dueDate: dueDate || null,
      })
      const { assigned, alreadyAssigned } = result.data
      toast.success(
        `Assigned to ${assigned} employee${assigned === 1 ? "" : "s"}` +
          (alreadyAssigned > 0 ? ` (${alreadyAssigned} already had it)` : "")
      )
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign course")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Course</DialogTitle>
          <DialogDescription>Choose who needs to complete &ldquo;{courseTitle}&rdquo;.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="assign-all" className="font-medium">Assign to everyone</Label>
              <p className="text-xs text-muted-foreground">All active and invited users in the organization</p>
            </div>
            <Switch id="assign-all" checked={allUsers} onCheckedChange={setAllUsers} />
          </div>

          {!allUsers && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email"
                  className="pl-8"
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                {isLoading && <Skeleton className="h-8 w-full" />}
                {!isLoading && users.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No users found</p>
                )}
                {users.map((u) => {
                  const assigned = alreadyAssignedUserIds.has(u.id)
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 has-[:disabled]:cursor-default has-[:disabled]:opacity-60"
                    >
                      <Checkbox
                        checked={assigned || selected.has(u.id)}
                        disabled={assigned}
                        onCheckedChange={(checked) => toggle(u.id, checked === true)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      {assigned && <span className="text-xs text-muted-foreground">Assigned</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="assign-due">Due date (optional)</Label>
            <Input id="assign-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={assign.isPending || (!allUsers && selected.size === 0)}>
            {assign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {allUsers ? "Assign to Everyone" : `Assign to ${selected.size || ""} Selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
