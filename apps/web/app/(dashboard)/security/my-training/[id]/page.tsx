"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { ArrowLeft, CheckCircle2, Loader2, Lock, Send, XCircle } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { TrainingVideoPlayer } from "@/components/security/training/training-video-player"
import { LessonPlayer } from "@/components/security/training/lesson/lesson-player"
import {
  useCompleteTrainingVideo,
  useMyTrainingCourse,
  useSubmitTrainingAttempt,
  type AttemptReview,
} from "@/lib/api/security-training"
import {
  requiredCorrectAnswers,
  trainingAssignmentStatusClassNames,
  trainingAssignmentStatusLabels,
  trainingCategoryLabels,
} from "@/lib/security/training"

export default function MyTrainingCoursePage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useMyTrainingCourse(id)
  const completeVideo = useCompleteTrainingVideo()
  const submitAttempt = useSubmitTrainingAttempt()

  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<AttemptReview | null>(null)

  const item = data?.data

  // Start clean whenever a fresh quiz becomes available (e.g. after re-watching for a retake)
  const quizKey = item?.quizUnlocked ? `${item.id}-${item.attemptCount}` : null
  useEffect(() => {
    setAnswers({})
    if (quizKey) setResult(null)
  }, [quizKey])

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="aspect-video w-full max-w-3xl" />
      </div>
    )
  }

  if (error || !item) {
    return (
      <PageShell title="Course not found">
        <p className="mb-4 text-muted-foreground">This course is not assigned to you or is no longer available.</p>
        <Button asChild variant="outline">
          <Link href="/security/my-training">Back to My Training</Link>
        </Button>
      </PageShell>
    )
  }

  const { course } = item
  const answeredCount = item.questions.filter((q) => answers[q.id] !== undefined).length
  const allAnswered = item.questions.length > 0 && answeredCount === item.questions.length
  const needed = requiredCorrectAnswers(course.passingScore, course.questionCount)
  // Only show the latest result while it still reflects the assignment (an admin reset clears it)
  const review =
    result ?? (item.status === "passed" || item.status === "retake_required" ? item.lastAttemptReview : null)
  const showQuiz = item.quizUnlocked

  const handleVideoComplete = async () => {
    if (item.videoCompletedAt || completeVideo.isPending) return
    try {
      await completeVideo.mutateAsync(item.id)
      toast.success("Video complete. The quiz is now unlocked.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save progress")
    }
  }

  const handleSubmit = async () => {
    try {
      const response = await submitAttempt.mutateAsync({ id: item.id, answers })
      setResult(response.data)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit quiz")
    }
  }

  return (
    <PageShell
      title={course.title}
      description={`${trainingCategoryLabels[course.category]} · Pass mark ${course.passingScore}% (${needed} of ${course.questionCount} correct)`}
      statusBadge={
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${trainingAssignmentStatusClassNames[item.status]}`}
        >
          {trainingAssignmentStatusLabels[item.status]}
        </span>
      }
      backButton={
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/my-training" aria-label="Back to My Training">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="max-w-3xl space-y-8">
        {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}

        {review && <AttemptResult review={review} />}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            {item.status === "passed" ? "Lesson" : `Step 1: Watch the ${course.lesson ? "lesson" : "video"}`}
          </h2>
          {item.status === "retake_required" && !item.videoCompletedAt && (
            <p className="text-sm text-muted-foreground">
              Your last score was below the pass mark. Watch the {course.lesson ? "lesson" : "video"} again to unlock
              the retake.
            </p>
          )}
          {course.lesson ? (
            <LessonPlayer
              // Remount when progress resets so a retake starts from the beginning
              key={`${item.id}-${item.attemptCount}`}
              lesson={course.lesson}
              completed={item.status === "passed" || !!item.videoCompletedAt}
              onComplete={handleVideoComplete}
            />
          ) : (
            <TrainingVideoPlayer
              videoUrl={course.videoUrl}
              durationMinutes={course.videoDurationMinutes}
              completed={item.status === "passed" || !!item.videoCompletedAt}
              onComplete={handleVideoComplete}
              completing={completeVideo.isPending}
            />
          )}
          {course.lesson && item.videoCompletedAt && item.status !== "passed" && (
            <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Lesson completed. The quiz below is unlocked.
            </p>
          )}
        </section>

        {item.status !== "passed" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Step 2: Take the quiz</h2>
              {showQuiz && (
                <span className="text-sm text-muted-foreground">
                  {answeredCount} of {item.questions.length} answered
                </span>
              )}
            </div>

            {!item.quizUnlocked && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Finish the {course.lesson ? "lesson" : "video"} to unlock the {course.questionCount}-question quiz.
              </div>
            )}

            {showQuiz && (
              <>
                <Progress value={(answeredCount / item.questions.length) * 100} />
                {item.questions.map((q, index) => (
                  <fieldset key={q.id} className="space-y-3 rounded-lg border p-4">
                    <legend className="sr-only">Question {index + 1}</legend>
                    <p className="font-medium">
                      <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                      {q.question}
                    </p>
                    <RadioGroup
                      value={answers[q.id] === undefined ? "" : String(answers[q.id])}
                      onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: Number(v) }))}
                      className="space-y-1"
                    >
                      {q.options.map((option, oIndex) => (
                        <Label
                          key={oIndex}
                          htmlFor={`${q.id}-${oIndex}`}
                          className="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                        >
                          <RadioGroupItem value={String(oIndex)} id={`${q.id}-${oIndex}`} className="mt-0.5" />
                          <span>{option}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                ))}
                <div className="flex items-center gap-3">
                  <Button onClick={handleSubmit} disabled={!allAnswered || submitAttempt.isPending}>
                    {submitAttempt.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Submit Answers
                  </Button>
                  {!allAnswered && (
                    <span className="text-sm text-muted-foreground">Answer every question to submit.</span>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {item.attempts.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Attempt history</h2>
            <div className="divide-y rounded-lg border">
              {item.attempts.map((a, index) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Attempt {item.attempts.length - index} · {format(new Date(a.submittedAt), "MMM d, yyyy h:mm a")}
                  </span>
                  <span className={a.passed ? "font-medium text-green-700 dark:text-green-400" : "font-medium text-red-600 dark:text-red-400"}>
                    {a.correctCount}/{a.totalQuestions} ({a.score}%) · {a.passed ? "Passed" : "Below pass mark"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  )
}

function AttemptResult({ review }: { review: AttemptReview }) {
  return (
    <section
      className={`space-y-4 rounded-lg border p-5 ${
        review.passed
          ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/10"
          : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {review.passed ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-green-600" />
        ) : (
          <XCircle className="mt-0.5 h-6 w-6 text-red-600" />
        )}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {review.passed ? "You passed!" : "Not quite. Retake required."}
          </h2>
          <p className="text-sm">
            You scored <span className="font-semibold">{review.score}%</span> ({review.correctCount} of{" "}
            {review.totalQuestions} correct). The pass mark is {review.passingScore}%.
          </p>
          {!review.passed && (
            <p className="text-sm text-muted-foreground">
              Watch the video again, then retake the quiz. Correct answers are shown once you pass.
            </p>
          )}
        </div>
      </div>

      {review.items.length > 0 && (
        <ol className="space-y-2">
          {review.items.map((item, index) => (
            <li key={item.questionId} className="rounded-md border bg-background p-3 text-sm">
              <div className="flex items-start gap-2">
                {item.correct ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <div className="space-y-1">
                  <p className="font-medium">
                    {index + 1}. {item.question}
                  </p>
                  <p className="text-muted-foreground">
                    Your answer:{" "}
                    {item.selectedOptionIndex === null ? "No answer" : item.options[item.selectedOptionIndex]}
                  </p>
                  {item.correctOptionIndex !== undefined && !item.correct && (
                    <p className="text-green-700 dark:text-green-400">
                      Correct answer: {item.options[item.correctOptionIndex]}
                    </p>
                  )}
                  {item.explanation && <p className="text-muted-foreground">{item.explanation}</p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
