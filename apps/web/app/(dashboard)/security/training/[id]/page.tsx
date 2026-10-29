"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Archive, ArrowLeft, Loader2, Rocket, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { CourseDetailsForm } from "@/components/security/training/course-details-form"
import { QuestionEditor } from "@/components/security/training/question-editor"
import { CourseAssignments } from "@/components/security/training/course-assignments"
import { TrainingVideoPlayer } from "@/components/security/training/training-video-player"
import { LessonEditor } from "@/components/security/training/lesson/lesson-editor"
import { useUser } from "@/lib/rbac/context"
import {
  useDeleteTrainingCourse,
  useTrainingCourse,
  useUpdateTrainingCourse,
} from "@/lib/api/security-training"
import {
  QUESTIONS_PER_COURSE,
  trainingCategoryLabels,
  trainingCourseStatusLabels,
} from "@/lib/security/training"
import type { TrainingCourseStatus } from "@/lib/db/schema/security-training"

const statusVariants: Record<TrainingCourseStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  published: "default",
  archived: "secondary",
}

export default function TrainingCourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { hasPermission } = useUser()
  const canEdit = hasPermission("security.training", "edit")

  const { data, isLoading, error } = useTrainingCourse(id)
  const updateCourse = useUpdateTrainingCourse()
  const deleteCourse = useDeleteTrainingCourse()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const course = data?.data

  const setStatus = async (status: TrainingCourseStatus, message: string) => {
    if (!course) return
    try {
      await updateCourse.mutateAsync({ id: course.id, data: { status } })
      toast.success(message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update course")
    }
  }

  const handleDelete = async () => {
    if (!course) return
    try {
      await deleteCourse.mutateAsync(course.id)
      toast.success("Course deleted")
      router.push("/security/training")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete course")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !course) {
    return (
      <PageShell title="Course not found">
        <p className="mb-4 text-muted-foreground">This course does not exist or you do not have access to it.</p>
        <Button asChild variant="outline">
          <Link href="/security/training">Back to Training Courses</Link>
        </Button>
      </PageShell>
    )
  }

  const quizComplete = course.questions.length === QUESTIONS_PER_COURSE

  return (
    <PageShell
      title={course.title}
      description={`${trainingCategoryLabels[course.category]} · Pass mark ${course.passingScore}% · ${course.questions.length}/${QUESTIONS_PER_COURSE} questions`}
      statusBadge={<Badge variant={statusVariants[course.status]}>{trainingCourseStatusLabels[course.status]}</Badge>}
      backButton={
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/training" aria-label="Back to Training Courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      action={
        <div className="flex flex-wrap gap-2">
          <Protected module="security.training" action="edit">
            {course.status !== "published" && (
              <Button
                onClick={() => setStatus("published", "Course published. You can now assign it.")}
                disabled={updateCourse.isPending}
                title={quizComplete ? undefined : `Add all ${QUESTIONS_PER_COURSE} questions first`}
              >
                {updateCourse.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Publish
              </Button>
            )}
            {course.status === "published" && (
              <>
                <Button variant="outline" onClick={() => setStatus("draft", "Course moved back to draft")} disabled={updateCourse.isPending}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Unpublish
                </Button>
                <Button variant="outline" onClick={() => setStatus("archived", "Course archived and hidden from employees")} disabled={updateCourse.isPending}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              </>
            )}
          </Protected>
          <Protected module="security.training" action="delete">
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </Protected>
        </div>
      }
    >
      {course.description && <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{course.description}</p>}

      <Tabs defaultValue={course.status === "published" ? "assignments" : quizComplete ? "details" : "quiz"}>
        <TabsList>
          <TabsTrigger value="assignments">Assignments & Scores</TabsTrigger>
          <TabsTrigger value="quiz">Quiz ({course.questions.length}/{QUESTIONS_PER_COURSE})</TabsTrigger>
          <TabsTrigger value="lesson">Lesson</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
          <CourseAssignments
            courseId={course.id}
            courseTitle={course.title}
            isPublished={course.status === "published"}
            passingScore={course.passingScore}
          />
        </TabsContent>

        <TabsContent value="quiz" className="mt-4">
          <QuestionEditor courseId={course.id} questions={course.questions} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <CourseDetailsForm course={course} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="lesson" className="mt-4">
          <LessonEditor courseId={course.id} lesson={course.lesson} canEdit={canEdit} />
          {!course.lesson && course.videoUrl && (
            <section className="mt-6 max-w-3xl space-y-2">
              <h3 className="text-sm font-semibold">External video (used while there is no lesson)</h3>
              {/* Admin preview: completion is not tracked here */}
              <TrainingVideoPlayer
                videoUrl={course.videoUrl}
                durationMinutes={course.videoDurationMinutes}
                completed
                onComplete={() => {}}
              />
            </section>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{course.title}&rdquo;, its quiz, all assignments and every employee&apos;s scores will be
              permanently deleted. To keep the history, archive the course instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
