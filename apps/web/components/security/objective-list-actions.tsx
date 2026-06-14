"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Check, FileCheck, Link2, MoreHorizontal, Pencil } from "lucide-react"
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
  useSecurityObjective,
  useUpdateSecurityObjective,
  type SecurityEvidence,
  type SecurityObjective,
} from "@/lib/api/security"
import { useAssignableObjectiveOwners } from "@/lib/api/security"
import { periodFromYear } from "@/lib/security/objectives"
import {
  buildEvidenceFieldConfig,
  buildOwnerFieldConfig,
  buildYearFieldConfig,
  getObjectiveEditDefaults,
  getObjectiveYearDefault,
  objectiveEditBaseFormConfig,
  objectiveEditBaseSchema,
} from "@/components/security/objective-form-shared"
import { toast } from "sonner"

export const objectiveEditFormSchema = objectiveEditBaseSchema

interface ObjectiveEditDrawerProps {
  objective: SecurityObjective | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Inline edit drawer for objectives from the list or detail page. */
export function ObjectiveEditDrawer({ objective, open, onOpenChange }: ObjectiveEditDrawerProps) {
  const updateObjective = useUpdateSecurityObjective()
  const { data: assignableOwnersData } = useAssignableObjectiveOwners()
  const assignableOwners = assignableOwnersData?.data ?? []
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const evidenceList = evidenceData?.data ?? []

  const formConfig = useMemo(() => {
    const yearExtra = objective
      ? [Number(getObjectiveYearDefault(objective))]
      : []
    return {
      ...objectiveEditBaseFormConfig,
      year: buildYearFieldConfig(yearExtra),
      ownerId: buildOwnerFieldConfig(
        assignableOwners,
        objective?.ownerId
          ? {
              id: objective.ownerId,
              name: objective.ownerName ?? "Unknown user",
              email: objective.ownerEmail,
            }
          : null
      ),
      linkedEvidenceIds: buildEvidenceFieldConfig(evidenceList),
    }
  }, [objective, assignableOwners, evidenceList])

  const handleUpdate = async (values: z.infer<typeof objectiveEditFormSchema>) => {
    if (!objective) return
    const { year, ownerId, linkedEvidenceIds, ...rest } = values
    const period = periodFromYear(year)
    try {
      await updateObjective.mutateAsync({
        id: objective.id,
        data: { ...rest, ...period, ownerId, linkedEvidenceIds },
      })
      toast.success("Objective updated")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update objective")
    }
  }

  if (!objective) return null

  return (
    <FormDrawer
      key={objective.id}
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Objective"
      description={objective.objectiveId}
      schema={objectiveEditFormSchema}
      config={formConfig}
      defaultValues={getObjectiveEditDefaults(objective)}
      fields={[
        "title",
        "description",
        "year",
        "ownerId",
        "achievementStatus",
        "successCriteria",
        "status",
        "targetDate",
        "linkedEvidenceIds",
        "notes",
      ]}
      mode="edit"
      onSubmit={handleUpdate}
    />
  )
}

interface ObjectiveEvidenceDialogProps {
  objective: SecurityObjective | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Link evidence to an objective from the list table. */
export function ObjectiveEvidenceDialog({ objective, open, onOpenChange }: ObjectiveEvidenceDialogProps) {
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const { data: freshData } = useSecurityObjective(open ? objective?.id : undefined)
  const updateObjective = useUpdateSecurityObjective()

  const currentObjective = freshData?.data ?? objective
  const allEvidence = evidenceData?.data ?? []
  const linkedIds = new Set(currentObjective?.linkedEvidenceIds ?? [])
  const availableEvidence = allEvidence.filter((e) => !linkedIds.has(e.id))

  const handleLinkEvidence = async (evidence: SecurityEvidence) => {
    if (!currentObjective) return
    const current = currentObjective.linkedEvidenceIds ?? []
    if (current.includes(evidence.id)) return
    try {
      await updateObjective.mutateAsync({
        id: currentObjective.id,
        data: { linkedEvidenceIds: [...current, evidence.id] },
      })
      toast.success(`Linked evidence: ${evidence.title}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to link evidence")
    }
  }

  if (!currentObjective) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Evidence</DialogTitle>
          <DialogDescription>
            Link evidence to <span className="font-medium">{currentObjective.title}</span>
            {(currentObjective.linkedEvidenceIds?.length ?? 0) > 0 && (
              <span className="block mt-1 text-xs">
                {currentObjective.linkedEvidenceIds?.length} already linked
              </span>
            )}
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
                  <p className="text-xs text-muted-foreground capitalize">{evidence.type}</p>
                </div>
                <Check className="h-4 w-4 text-muted-foreground" />
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

interface UseObjectiveTableColumnsOptions<T extends SecurityObjective> {
  baseColumns: ColumnDef<T>[]
  canEdit: boolean
  onEdit: (objective: T) => void
  onLinkEvidence: (objective: T) => void
}

/** Append an actions column to the objectives table when the user can edit. */
export function useObjectiveTableColumns<T extends SecurityObjective>({
  baseColumns,
  canEdit,
  onEdit,
  onLinkEvidence,
}: UseObjectiveTableColumnsOptions<T>) {
  return useMemo(() => {
    if (!canEdit) return baseColumns

    const actionsColumn: ColumnDef<T> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: T } }) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLinkEvidence(row.original)}>
                <Link2 className="h-4 w-4 mr-2" />
                Link Evidence
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/security/objectives/${row.original.id}`}>
                  <FileCheck className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    }

    return [...baseColumns, actionsColumn]
  }, [baseColumns, canEdit, onEdit, onLinkEvidence])
}
