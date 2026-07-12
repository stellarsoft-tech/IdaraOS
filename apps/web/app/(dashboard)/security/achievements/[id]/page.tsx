"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Award,
  Calendar,
  Check,
  FileCheck,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { format } from "date-fns"

import { PageHeader } from "@/components/page-header"
import { Protected } from "@/components/primitives/protected"
import { AchievementEditDrawer } from "@/components/security/achievement-list-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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
  useSecurityAchievement,
  useUpdateSecurityAchievement,
  useDeleteSecurityAchievement,
  useSecurityEvidence,
  type SecurityEvidence,
} from "@/lib/api/security"
import { toast } from "sonner"

export default function AchievementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [linkEvidenceOpen, setLinkEvidenceOpen] = useState(false)

  const { data, isLoading } = useSecurityAchievement(id)
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const updateAchievement = useUpdateSecurityAchievement()
  const deleteAchievement = useDeleteSecurityAchievement()

  const achievement = data?.data
  const allEvidence = evidenceData?.data || []

  const linkedEvidence = useMemo(() => {
    const ids = new Set(achievement?.linkedEvidenceIds ?? [])
    return allEvidence.filter((e) => ids.has(e.id))
  }, [allEvidence, achievement?.linkedEvidenceIds])

  const availableEvidence = useMemo(() => {
    const ids = new Set(achievement?.linkedEvidenceIds ?? [])
    return allEvidence.filter((e) => !ids.has(e.id))
  }, [allEvidence, achievement?.linkedEvidenceIds])

  const handleDelete = async () => {
    try {
      await deleteAchievement.mutateAsync(id)
      toast.success("Achievement deleted")
      router.push("/security/achievements")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete achievement")
    }
  }

  const handleLinkEvidence = async (evidence: SecurityEvidence) => {
    const current = achievement?.linkedEvidenceIds ?? []
    if (current.includes(evidence.id)) return
    try {
      await updateAchievement.mutateAsync({
        id,
        data: { linkedEvidenceIds: [...current, evidence.id] },
      })
      toast.success(`Linked evidence: ${evidence.title}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to link evidence")
    }
  }

  const handleUnlinkEvidence = async (evidenceId: string) => {
    const current = achievement?.linkedEvidenceIds ?? []
    try {
      await updateAchievement.mutateAsync({
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

  if (!achievement) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Achievement not found</p>
        <Button variant="link" asChild className="mt-4">
          <Link href="/security/achievements">Back to achievements</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={achievement.name} description={achievement.periodLabel ?? undefined}>
        <Protected module="security.achievements" action="edit">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Protected>
        <Protected module="security.achievements" action="delete">
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </Protected>
      </PageHeader>

      <Button variant="ghost" size="sm" asChild>
        <Link href="/security/achievements">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to achievements
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Achievement Details</CardTitle>
              {achievement.description && (
                <CardDescription>{achievement.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Date</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(achievement.achievementDate), "MMMM d, yyyy")}
                </p>
              </div>
              {achievement.notes && (
                <div>
                  <p className="text-sm font-medium mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{achievement.notes}</p>
                </div>
              )}
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
                    {achievement.evidenceRequired
                      ? "Evidence is required for this achievement"
                      : "Optional supporting evidence"}
                  </CardDescription>
                </div>
                <Protected module="security.achievements" action="edit">
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
                  No evidence linked yet.
                  {achievement.evidenceRequired && " Evidence is required for this achievement."}
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
                      <Protected module="security.achievements" action="edit">
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
                <Award className="h-4 w-4" />
                Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Year</p>
                <p className="font-medium">{achievement.periodLabel || "—"}</p>
              </div>
              {achievement.periodStart && (
                <div>
                  <p className="text-muted-foreground">Start</p>
                  <p className="font-medium">
                    {format(new Date(achievement.periodStart), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {achievement.periodEnd && (
                <div>
                  <p className="text-muted-foreground">End</p>
                  <p className="font-medium">
                    {format(new Date(achievement.periodEnd), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Evidence Required</p>
                <Badge variant={achievement.evidenceRequired ? "default" : "secondary"}>
                  {achievement.evidenceRequired ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AchievementEditDrawer
        achievement={achievement}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete achievement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {achievement.name}.
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
              Select evidence from the Evidence Store to support this achievement.
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
