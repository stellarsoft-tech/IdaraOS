"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  Check,
  FileCheck,
  Link2,
  Pencil,
  Plus,
  Target,
  Trash2,
  User,
  X,
} from "lucide-react"
import { format } from "date-fns"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Protected } from "@/components/primitives/protected"
import { ObjectiveEditDrawer } from "@/components/security/objective-list-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useSecurityObjective,
  useUpdateSecurityObjective,
  useDeleteSecurityObjective,
  useSecurityEvidence,
  type SecurityObjective,
  type SecurityEvidence,
} from "@/lib/api/security"
import { objectiveAchievementStatusValues } from "@/lib/db/schema/security"
import { toast } from "sonner"

const achievementLabels: Record<SecurityObjective["achievementStatus"], string> = {
  not_measured: "Not Measured",
  not_achieved: "Not Achieved",
  partially_achieved: "Partially Achieved",
  achieved: "Achieved",
}

export default function ObjectiveDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [linkEvidenceOpen, setLinkEvidenceOpen] = useState(false)

  const { data, isLoading } = useSecurityObjective(id)
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const updateObjective = useUpdateSecurityObjective()
  const deleteObjective = useDeleteSecurityObjective()

  const objective = data?.data
  const allEvidence = evidenceData?.data || []

  const linkedEvidence = useMemo(() => {
    const ids = new Set(objective?.linkedEvidenceIds ?? [])
    return allEvidence.filter((e) => ids.has(e.id))
  }, [allEvidence, objective?.linkedEvidenceIds])

  const availableEvidence = useMemo(() => {
    const ids = new Set(objective?.linkedEvidenceIds ?? [])
    return allEvidence.filter((e) => !ids.has(e.id))
  }, [allEvidence, objective?.linkedEvidenceIds])

  const handleDelete = async () => {
    try {
      await deleteObjective.mutateAsync(id)
      toast.success("Objective deleted")
      router.push(
        objective?.frameworkCode === "iso-27001"
          ? "/security/frameworks/iso-27001/objectives"
          : "/security/objectives"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete objective")
    }
  }

  const handleAchievementChange = async (achievementStatus: SecurityObjective["achievementStatus"]) => {
    try {
      await updateObjective.mutateAsync({ id, data: { achievementStatus } })
      toast.success("Achievement status updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update achievement status")
    }
  }

  const handleLinkEvidence = async (evidence: SecurityEvidence) => {
    const current = objective?.linkedEvidenceIds ?? []
    if (current.includes(evidence.id)) return
    try {
      await updateObjective.mutateAsync({
        id,
        data: { linkedEvidenceIds: [...current, evidence.id] },
      })
      toast.success(`Linked evidence: ${evidence.title}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to link evidence")
    }
  }

  const handleUnlinkEvidence = async (evidenceId: string) => {
    const current = objective?.linkedEvidenceIds ?? []
    try {
      await updateObjective.mutateAsync({
        id,
        data: { linkedEvidenceIds: current.filter((eid) => eid !== evidenceId) },
      })
      toast.success("Evidence unlinked")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink evidence")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!objective) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Objective not found</p>
        <Button variant="link" asChild className="mt-4">
          <Link href="/security/objectives">Back to objectives</Link>
        </Button>
      </div>
    )
  }

  const backHref =
    objective.frameworkCode === "iso-27001"
      ? "/security/frameworks/iso-27001/objectives"
      : "/security/objectives"

  return (
    <div className="space-y-6">
      <PageHeader title={objective.title} description={objective.objectiveId}>
        <Protected module="security.objectives" action="edit">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Protected>
        <Protected module="security.objectives" action="delete">
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </Protected>
      </PageHeader>

      <Button variant="ghost" size="sm" asChild>
        <Link href={backHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to objectives
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Objective Details</CardTitle>
              {objective.description && (
                <CardDescription>{objective.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {objective.successCriteria && (
                <div>
                  <p className="text-sm font-medium mb-1">Success Criteria</p>
                  <p className="text-sm text-muted-foreground">{objective.successCriteria}</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{objective.progress}%</span>
                </div>
                <Progress value={objective.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-4 w-4" />
                    Linked Evidence
                  </CardTitle>
                  <CardDescription>
                    Evidence supporting measurement and achievement of this objective
                  </CardDescription>
                </div>
                <Protected module="security.objectives" action="edit">
                  <Button size="sm" variant="outline" onClick={() => setLinkEvidenceOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Link Evidence
                  </Button>
                </Protected>
              </div>
            </CardHeader>
            <CardContent>
              {linkedEvidence.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No evidence linked yet. Link reports, measurement records, or attestation artifacts.
                </p>
              ) : (
                <div className="space-y-2">
                  {linkedEvidence.map((evidence) => (
                    <div
                      key={evidence.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Link
                            href={`/security/evidence/${evidence.id}`}
                            className="font-medium text-sm hover:underline"
                          >
                            {evidence.title}
                          </Link>
                          <p className="text-xs text-muted-foreground capitalize">
                            {evidence.type}
                          </p>
                        </div>
                      </div>
                      <Protected module="security.objectives" action="edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnlinkEvidence(evidence.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </Protected>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Achievement
              </CardTitle>
              <CardDescription>Outcome for the reporting period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Protected module="security.objectives" action="edit">
                <Select
                  value={objective.achievementStatus}
                  onValueChange={(v) =>
                    handleAchievementChange(v as SecurityObjective["achievementStatus"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {objectiveAchievementStatusValues.map((status) => (
                      <SelectItem key={status} value={status}>
                        {achievementLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Protected>
              <StatusBadge
                variant={
                  objective.achievementStatus === "achieved"
                    ? "success"
                    : objective.achievementStatus === "partially_achieved"
                      ? "warning"
                      : objective.achievementStatus === "not_achieved"
                        ? "danger"
                        : "default"
                }
              >
                {achievementLabels[objective.achievementStatus]}
              </StatusBadge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Reporting Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Period</p>
                <p className="font-medium">{objective.periodLabel || "—"}</p>
              </div>
              {objective.periodStart && (
                <div>
                  <p className="text-muted-foreground">Start</p>
                  <p className="font-medium">
                    {format(new Date(objective.periodStart), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {objective.periodEnd && (
                <div>
                  <p className="text-muted-foreground">End</p>
                  <p className="font-medium">
                    {format(new Date(objective.periodEnd), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {objective.targetDate && (
                <div>
                  <p className="text-muted-foreground">Target Date</p>
                  <p className="font-medium">
                    {format(new Date(objective.targetDate), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {objective.frameworkCode && (
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">{objective.frameworkCode}</Badge>
                </div>
              )}
              {objective.ownerName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{objective.ownerName}</span>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Workflow Status</p>
                <p className="font-medium capitalize">{objective.status.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Priority</p>
                <p className="font-medium capitalize">{objective.priority}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ObjectiveEditDrawer
        objective={objective}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete objective?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {objective.objectiveId} — {objective.title}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={linkEvidenceOpen} onOpenChange={setLinkEvidenceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Evidence</DialogTitle>
            <DialogDescription>
              Select evidence from the Evidence Store to support this objective.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {availableEvidence.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No available evidence.{" "}
                <Link href="/security/evidence" className="text-primary hover:underline">
                  Add evidence
                </Link>{" "}
                first.
              </p>
            ) : (
              availableEvidence.map((evidence) => (
                <button
                  key={evidence.id}
                  type="button"
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 text-left"
                  onClick={() => handleLinkEvidence(evidence)}
                >
                  <div>
                    <p className="font-medium text-sm">{evidence.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {evidence.type}
                    </p>
                  </div>
                  <Check className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkEvidenceOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
