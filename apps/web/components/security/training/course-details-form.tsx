"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUpdateTrainingCourse, type TrainingCourseDetail } from "@/lib/api/security-training"
import {
  QUESTIONS_PER_COURSE,
  parseTrainingVideoUrl,
  requiredCorrectAnswers,
  trainingCategoryLabels,
} from "@/lib/security/training"
import { trainingCourseCategoryValues, type TrainingCourseCategory } from "@/lib/db/schema/security-training"

interface CourseDetailsFormProps {
  course: TrainingCourseDetail
  canEdit: boolean
}

export function CourseDetailsForm({ course, canEdit }: CourseDetailsFormProps) {
  const updateCourse = useUpdateTrainingCourse()
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description ?? "")
  const [category, setCategory] = useState<TrainingCourseCategory>(course.category)
  const [videoUrl, setVideoUrl] = useState(course.videoUrl ?? "")
  const [duration, setDuration] = useState(course.videoDurationMinutes ? String(course.videoDurationMinutes) : "")
  const [passingScore, setPassingScore] = useState(String(course.passingScore))

  useEffect(() => {
    setTitle(course.title)
    setDescription(course.description ?? "")
    setCategory(course.category)
    setVideoUrl(course.videoUrl ?? "")
    setDuration(course.videoDurationMinutes ? String(course.videoDurationMinutes) : "")
    setPassingScore(String(course.passingScore))
  }, [course])

  const passingScoreNumber = Number(passingScore)
  const passingScoreValid =
    passingScore !== "" && Number.isInteger(passingScoreNumber) && passingScoreNumber >= 0 && passingScoreNumber <= 100
  const durationNumber = Number(duration)
  const durationValid = duration === "" || (Number.isInteger(durationNumber) && durationNumber >= 1 && durationNumber <= 120)
  const videoValid = videoUrl.trim() === "" || !!parseTrainingVideoUrl(videoUrl)
  const canSave = canEdit && title.trim() !== "" && passingScoreValid && durationValid && videoValid

  const handleSave = async () => {
    try {
      await updateCourse.mutateAsync({
        id: course.id,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          category,
          videoUrl: videoUrl.trim() || null,
          videoDurationMinutes: duration === "" ? null : durationNumber,
          passingScore: passingScoreNumber,
        },
      })
      toast.success("Course details saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save course")
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="course-title">Course Title</Label>
        <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="course-description">Description</Label>
        <Textarea
          id="course-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={!canEdit}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as TrainingCourseCategory)} disabled={!canEdit}>
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {trainingCourseCategoryValues.map((value) => (
              <SelectItem key={value} value={value}>
                {trainingCategoryLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="course-video">External Video URL (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Only used when the course has no lesson. Build a narrated lesson on the Lesson tab instead.
        </p>
        <Input
          id="course-video"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={!canEdit}
        />
        {videoUrl.trim() !== "" && (
          videoValid ? (
            <p className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Supported video link
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              Use a YouTube or Vimeo link, or a direct .mp4/.webm file
            </p>
          )
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="course-duration">Video Length (minutes)</Label>
          <Input
            id="course-duration"
            type="number"
            min={1}
            max={120}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={!canEdit}
          />
          {!durationValid && <p className="text-xs text-destructive">Enter 1-120 minutes</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="course-passing-score">Minimum Passing Score (%)</Label>
          <Input
            id="course-passing-score"
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
            disabled={!canEdit}
          />
          {passingScoreValid ? (
            <p className="text-xs text-muted-foreground">
              Employees need {requiredCorrectAnswers(passingScoreNumber)} of {QUESTIONS_PER_COURSE} correct.
              Anyone below this score must retake the course.
            </p>
          ) : (
            <p className="text-xs text-destructive">Enter a whole number between 0 and 100</p>
          )}
        </div>
      </div>

      {canEdit && (
        <Button onClick={handleSave} disabled={!canSave || updateCourse.isPending}>
          {updateCourse.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Details
        </Button>
      )}
    </div>
  )
}
