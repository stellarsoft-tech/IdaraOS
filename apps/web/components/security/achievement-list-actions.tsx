"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { FileCheck, Link2, MoreHorizontal, Pencil } from "lucide-react"
import { z } from "zod"

import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useSecurityEvidence,
  useUpdateSecurityAchievement,
  type SecurityAchievement,
  type SecurityEvidence,
} from "@/lib/api/security"
import { periodFromYear } from "@/lib/security/achievements"
import {
  achievementFormConfig,
  achievementFormSchema,
  buildAchievementEvidenceFieldConfig,
  buildAchievementYearFieldConfig,
  getAchievementFormDefaults,
  getAchievementYearDefault,
} from "@/components/security/achievement-form-shared"
import { toast } from "sonner"

interface AchievementEditDrawerProps {
  achievement: SecurityAchievement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Inline edit drawer for achievements from the list or detail page. */
export function AchievementEditDrawer({
  achievement,
  open,
  onOpenChange,
}: AchievementEditDrawerProps) {
  const updateAchievement = useUpdateSecurityAchievement()
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const evidenceList = evidenceData?.data ?? []

  const formConfig = useMemo(() => {
    const yearExtra = achievement
      ? [Number(getAchievementYearDefault(achievement))]
      : []
    return {
      ...achievementFormConfig,
      year: buildAchievementYearFieldConfig(yearExtra),
      linkedEvidenceIds: buildAchievementEvidenceFieldConfig(evidenceList),
    }
  }, [achievement, evidenceList])

  const handleUpdate = async (values: z.infer<typeof achievementFormSchema>) => {
    if (!achievement) return
    const { year, linkedEvidenceIds, ...rest } = values
    const period = periodFromYear(year)
    try {
      await updateAchievement.mutateAsync({
        id: achievement.id,
        data: { ...rest, ...period, linkedEvidenceIds },
      })
      toast.success("Achievement updated")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update achievement")
    }
  }

  if (!achievement) return null

  return (
    <FormDrawer
      key={achievement.id}
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Achievement"
      description={achievement.name}
      schema={achievementFormSchema}
      config={formConfig}
      defaultValues={getAchievementFormDefaults(achievement)}
      fields={[
        "name",
        "description",
        "year",
        "achievementDate",
        "evidenceRequired",
        "linkedEvidenceIds",
        "notes",
      ]}
      mode="edit"
      onSubmit={handleUpdate}
    />
  )
}

interface AchievementEvidenceDialogProps {
  achievement: SecurityAchievement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Quick-link dialog to attach one evidence item to an achievement. */
export function AchievementEvidenceDialog({
  achievement,
  open,
  onOpenChange,
}: AchievementEvidenceDialogProps) {
  const updateAchievement = useUpdateSecurityAchievement()
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const allEvidence = evidenceData?.data ?? []

  const available = useMemo(() => {
    const linked = new Set(achievement?.linkedEvidenceIds ?? [])
    return allEvidence.filter((e) => !linked.has(e.id))
  }, [allEvidence, achievement?.linkedEvidenceIds])

  const handleLink = async (evidence: SecurityEvidence) => {
    if (!achievement) return
    const current = achievement.linkedEvidenceIds ?? []
    try {
      await updateAchievement.mutateAsync({
        id: achievement.id,
        data: { linkedEvidenceIds: [...current, evidence.id] },
      })
      toast.success(`Linked evidence: ${evidence.title}`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to link evidence")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Evidence</DialogTitle>
          <DialogDescription>
            Attach supporting evidence to {achievement?.name ?? "this achievement"}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-2 overflow-y-auto py-2">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No additional evidence available.{" "}
              <Link href="/security/evidence" className="text-primary hover:underline">
                Add evidence
              </Link>{" "}
              first.
            </p>
          ) : (
            available.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm hover:bg-muted/50"
                onClick={() => handleLink(item)}
              >
                <FileCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="font-medium block">{item.title}</span>
                  <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface UseAchievementTableColumnsOptions {
  baseColumns: ColumnDef<SecurityAchievement, unknown>[]
  canEdit: boolean
  onEdit: (achievement: SecurityAchievement) => void
  onLinkEvidence: (achievement: SecurityAchievement) => void
}

/** Append row actions column when the user can edit achievements. */
export function useAchievementTableColumns({
  baseColumns,
  canEdit,
  onEdit,
  onLinkEvidence,
}: UseAchievementTableColumnsOptions): ColumnDef<SecurityAchievement, unknown>[] {
  return useMemo(() => {
    if (!canEdit) return baseColumns
    return [
      ...baseColumns,
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLinkEvidence(row.original)}>
                <Link2 className="mr-2 h-4 w-4" />
                Link Evidence
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ]
  }, [baseColumns, canEdit, onEdit, onLinkEvidence])
}
