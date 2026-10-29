"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, CheckCircle, GraduationCap, Library, Plus, RotateCcw, Users } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrainingLibraryDialog } from "@/components/security/training/training-library-dialog"
import {
  useCreateTrainingCourse,
  useTrainingCourses,
  type TrainingCourseListItem,
} from "@/lib/api/security-training"
import {
  DEFAULT_PASSING_SCORE,
  QUESTIONS_PER_COURSE,
  trainingCategoryLabels,
  trainingCourseStatusLabels,
} from "@/lib/security/training"
import { trainingCourseCategoryValues } from "@/lib/db/schema/security-training"

const courseStatusVariants: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  published: "default",
  archived: "secondary",
}

const categoryOptions = trainingCourseCategoryValues.map((value) => ({
  value,
  label: trainingCategoryLabels[value],
}))

const columns = [
  {
    accessorKey: "title",
    header: "Course",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) => (
      <div>
        <Link
          href={`/security/training/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.title}
        </Link>
        {row.original.description && (
          <p className="max-w-[360px] truncate text-xs text-muted-foreground">
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) => (
      <span className="text-sm">{trainingCategoryLabels[row.original.category]}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) => (
      <Badge variant={courseStatusVariants[row.original.status]}>
        {trainingCourseStatusLabels[row.original.status]}
      </Badge>
    ),
  },
  {
    accessorKey: "questionCount",
    header: "Questions",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) => {
      const complete = row.original.questionCount === QUESTIONS_PER_COURSE
      return (
        <span className={complete ? "text-sm" : "text-sm text-amber-600 dark:text-amber-400"}>
          {row.original.questionCount}/{QUESTIONS_PER_COURSE}
        </span>
      )
    },
  },
  {
    accessorKey: "passingScore",
    header: "Pass Mark",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) => (
      <span className="text-sm">{row.original.passingScore}%</span>
    ),
  },
  {
    accessorKey: "assignedCount",
    header: "Assigned",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) => (
      <span className="text-sm">{row.original.assignedCount}</span>
    ),
  },
  {
    accessorKey: "passedCount",
    header: "Passed",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) => {
      const { passedCount, assignedCount } = row.original
      if (assignedCount === 0) return <span className="text-muted-foreground">-</span>
      return (
        <span className="text-sm">
          {passedCount}/{assignedCount}
          <span className="ml-1 text-xs text-muted-foreground">
            ({Math.round((passedCount / assignedCount) * 100)}%)
          </span>
        </span>
      )
    },
  },
  {
    accessorKey: "retakeRequiredCount",
    header: "Retake Required",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) =>
      row.original.retakeRequiredCount > 0 ? (
        <span className="text-sm font-medium text-red-600 dark:text-red-400">
          {row.original.retakeRequiredCount}
        </span>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  {
    accessorKey: "averageScore",
    header: "Avg. Score",
    cell: ({ row }: { row: { original: TrainingCourseListItem } }) =>
      row.original.averageScore === null ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <span className="text-sm">{row.original.averageScore}%</span>
      ),
  },
]

const createFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(trainingCourseCategoryValues),
  videoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  videoDurationMinutes: z.coerce.number().int().min(1).max(120).optional().or(z.literal("")),
  passingScore: z.coerce.number().int().min(0, "Minimum is 0").max(100, "Maximum is 100"),
})

const formConfig = {
  title: {
    component: "input" as const,
    label: "Course Title",
    placeholder: "e.g., Recognising Phishing Emails",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "What will employees learn?",
  },
  category: {
    component: "select" as const,
    label: "Category",
    options: categoryOptions,
    required: true,
  },
  videoUrl: {
    component: "input" as const,
    label: "External Video URL (optional)",
    placeholder: "Leave empty to build a narrated lesson instead",
    type: "url",
  },
  videoDurationMinutes: {
    component: "input" as const,
    label: "Video Length (minutes)",
    placeholder: "e.g., 3",
    type: "number",
  },
  passingScore: {
    component: "input" as const,
    label: "Minimum Passing Score (%)",
    placeholder: "70",
    type: "number",
    required: true,
  },
}

export default function TrainingCoursesPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const { data, isLoading } = useTrainingCourses()
  const createCourse = useCreateTrainingCourse()
  const courses = data?.data ?? []

  const publishedCount = courses.filter((c) => c.status === "published").length
  const totalAssigned = courses.reduce((sum, c) => sum + c.assignedCount, 0)
  const totalPassed = courses.reduce((sum, c) => sum + c.passedCount, 0)
  const totalRetake = courses.reduce((sum, c) => sum + c.retakeRequiredCount, 0)

  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    try {
      const result = await createCourse.mutateAsync({
        ...values,
        videoUrl: values.videoUrl || null,
        videoDurationMinutes: values.videoDurationMinutes === "" ? null : values.videoDurationMinutes ?? null,
      })
      toast.success("Course created. Add the 10 quiz questions next.")
      setCreateOpen(false)
      router.push(`/security/training/${result.data.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create course")
    }
  }

  return (
    <PageShell
      title="Training Courses"
      description="Security awareness courses: a short narrated lesson followed by a 10-question quiz. Assign courses to employees and track their scores."
      icon={GraduationCap}
      action={
        <Protected module="security.training" action="create">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLibraryOpen(true)}>
              <Library className="mr-2 h-4 w-4" />
              Starter Courses
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Course
            </Button>
          </div>
        </Protected>
      }
    >
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Published Courses</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{publishedCount}</p>
        </div>
        <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-900/10">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-400">Assignments</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-300">{totalAssigned}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Passed</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-300">{totalPassed}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">Retake Required</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-900 dark:text-red-300">{totalRetake}</p>
        </div>
      </div>

      {!isLoading && courses.length === 0 && (
        <div className="mb-6 flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-1 text-muted-foreground">No training courses yet.</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Install the starter courses (phishing, passwords, social engineering and more) or create your own.
          </p>
          <Protected module="security.training" action="create">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLibraryOpen(true)}>
                <Library className="mr-2 h-4 w-4" />
                Install Starter Courses
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Course
              </Button>
            </div>
          </Protected>
        </div>
      )}

      <DataTable
        columns={columns}
        data={courses}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search courses..."
        onRowClick={(course) => router.push(`/security/training/${course.id}`)}
        facetedFilters={{
          status: {
            type: "enum",
            options: [
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
              { label: "Archived", value: "archived" },
            ],
          },
          category: {
            type: "enum",
            options: categoryOptions,
          },
        }}
        enableColumnFilters
        enableSorting
        enableExport
        enableColumnVisibility
      />

      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Course"
        description="Create a draft course. You can add the quiz questions and publish it afterwards."
        schema={createFormSchema}
        config={formConfig}
        defaultValues={{
          category: "general",
          passingScore: String(DEFAULT_PASSING_SCORE),
        }}
        fields={["title", "description", "category", "videoUrl", "videoDurationMinutes", "passingScore"]}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createCourse.isPending}
      />

      <TrainingLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
    </PageShell>
  )
}
