"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Award, Calendar, FileCheck, AlertCircle } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AchievementEditDrawer,
  AchievementEvidenceDialog,
  useAchievementTableColumns,
} from "@/components/security/achievement-list-actions"
import { useUser } from "@/lib/rbac/context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useSecurityAchievements,
  useSecurityEvidence,
  useCreateSecurityAchievement,
  type SecurityAchievement,
} from "@/lib/api/security"
import {
  achievementFormConfig,
  achievementFormSchema,
  buildAchievementEvidenceFieldConfig,
  buildAchievementYearFieldConfig,
} from "@/components/security/achievement-form-shared"
import {
  getCurrentAchievementYear,
  getAvailableAchievementYears,
  periodFromYear,
} from "@/lib/security/achievements"
import { toast } from "sonner"

const baseColumns = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }: { row: { original: SecurityAchievement } }) => (
      <div>
        <Link
          href={`/security/achievements/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        {row.original.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "achievementDate",
    header: "Date",
    cell: ({ row }: { row: { original: SecurityAchievement } }) => (
      <div className="flex items-center gap-1 text-sm">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        {format(new Date(row.original.achievementDate), "MMM d, yyyy")}
      </div>
    ),
  },
  {
    accessorKey: "periodLabel",
    header: "Period",
    cell: ({ row }: { row: { original: SecurityAchievement } }) => (
      <span className="text-sm">{row.original.periodLabel || "—"}</span>
    ),
  },
  {
    accessorKey: "evidenceRequired",
    header: "Evidence",
    cell: ({ row }: { row: { original: SecurityAchievement } }) => {
      const count = row.original.linkedEvidenceIds?.length ?? 0
      const required = row.original.evidenceRequired
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{count}</span>
          </div>
          {required && (
            <Badge variant={count > 0 ? "secondary" : "destructive"} className="text-xs">
              {count > 0 ? "Required" : "Missing"}
            </Badge>
          )}
        </div>
      )
    },
  },
]

export default function AchievementsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [yearFilter, setYearFilter] = useState<number>(getCurrentAchievementYear())
  const [editingAchievement, setEditingAchievement] = useState<SecurityAchievement | null>(null)
  const [evidenceAchievement, setEvidenceAchievement] = useState<SecurityAchievement | null>(null)

  const { hasPermission } = useUser()
  const canEdit =
    hasPermission("security.achievements", "edit") ||
    hasPermission("security.achievements", "create")

  const { data: achievementsData, isLoading } = useSecurityAchievements({
    periodLabel: periodFromYear(yearFilter).periodLabel,
    limit: 200,
  })
  const createAchievement = useCreateSecurityAchievement()
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const evidenceList = evidenceData?.data ?? []

  const createFormConfig = useMemo(
    () => ({
      ...achievementFormConfig,
      year: buildAchievementYearFieldConfig([yearFilter]),
      linkedEvidenceIds: buildAchievementEvidenceFieldConfig(evidenceList),
    }),
    [yearFilter, evidenceList]
  )

  const achievements = achievementsData?.data || []

  const yearOptions = useMemo(
    () => getAvailableAchievementYears(achievements),
    [achievements]
  )

  const withEvidenceCount = achievements.filter(
    (a) => (a.linkedEvidenceIds?.length ?? 0) > 0
  ).length
  const missingEvidenceCount = achievements.filter(
    (a) => a.evidenceRequired && (a.linkedEvidenceIds?.length ?? 0) === 0
  ).length

  const tableColumns = useAchievementTableColumns({
    baseColumns,
    canEdit,
    onEdit: setEditingAchievement,
    onLinkEvidence: setEvidenceAchievement,
  })

  const handleCreate = async (values: z.infer<typeof achievementFormSchema>) => {
    const { year, linkedEvidenceIds, ...rest } = values
    const period = periodFromYear(year)
    try {
      await createAchievement.mutateAsync({ ...rest, ...period, linkedEvidenceIds })
      toast.success("Achievement created successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create achievement")
    }
  }

  return (
    <PageShell
      title="Security Achievements"
      description="Record and track security achievements by year."
      action={
        <Protected module="security.achievements" anyAction={["create", "edit"]}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Achievement
          </Button>
        </Protected>
      }
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Year:</span>
        <Select
          value={String(yearFilter)}
          onValueChange={(value) => setYearFilter(Number(value))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{achievements.length}</p>
        </div>
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">
              With Evidence
            </span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">
            {withEvidenceCount}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">
              Missing Evidence
            </span>
          </div>
          <p className="text-2xl font-bold mt-1 text-red-900 dark:text-red-300">
            {missingEvidenceCount}
          </p>
        </div>
      </div>

      {!isLoading && achievements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed mb-6">
          <Award className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-1">No achievements for {yearFilter} yet.</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first security achievement for this year.
          </p>
          <Protected module="security.achievements" anyAction={["create", "edit"]}>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Achievement
            </Button>
          </Protected>
        </div>
      )}

      <DataTable
        columns={tableColumns}
        data={achievements}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Search achievements..."
        enableColumnFilters
        enableSorting
        enableExport
        enableColumnVisibility
      />

      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Achievement"
        description="Add a new security achievement"
        schema={achievementFormSchema}
        config={createFormConfig}
        defaultValues={{
          year: String(yearFilter),
          evidenceRequired: false,
          linkedEvidenceIds: [],
        }}
        fields={[
          "name",
          "description",
          "year",
          "achievementDate",
          "evidenceRequired",
          "linkedEvidenceIds",
          "notes",
        ]}
        mode="create"
        onSubmit={handleCreate}
      />

      <AchievementEditDrawer
        achievement={editingAchievement}
        open={!!editingAchievement}
        onOpenChange={(open) => !open && setEditingAchievement(null)}
      />
      <AchievementEvidenceDialog
        achievement={evidenceAchievement}
        open={!!evidenceAchievement}
        onOpenChange={(open) => !open && setEvidenceAchievement(null)}
      />
    </PageShell>
  )
}
