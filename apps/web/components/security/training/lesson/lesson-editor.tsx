"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, Clapperboard, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUpdateTrainingCourse } from "@/lib/api/security-training"
import {
  createSceneTemplate,
  estimateLessonMinutes,
  lessonVisualLabels,
  lessonVisualSchema,
  type LessonScene,
  type LessonVisualType,
  type TrainingLesson,
} from "@/lib/security/training-lesson"
import { LessonPlayer } from "./lesson-player"

interface LessonEditorProps {
  courseId: string
  lesson: TrainingLesson | null
  canEdit: boolean
}

interface DraftScene {
  title: string
  narration: string
  visualJson: string
  /** Recorded narration, kept only while the narration text is unchanged */
  audio?: LessonScene["audio"]
  recordedNarration?: string
}

function toDraft(scene: LessonScene): DraftScene {
  return {
    title: scene.title,
    narration: scene.narration,
    visualJson: JSON.stringify(scene.visual, null, 2),
    audio: scene.audio,
    recordedNarration: scene.audio ? scene.narration : undefined,
  }
}

function keepsRecording(draft: DraftScene): boolean {
  return !!draft.audio && draft.narration.trim() === draft.recordedNarration
}

/** Parse a draft scene, returning the scene or a readable error */
function parseDraft(draft: DraftScene): { scene?: LessonScene; error?: string } {
  if (!draft.title.trim()) return { error: "Title is required" }
  if (!draft.narration.trim()) return { error: "Narration is required" }
  let raw: unknown
  try {
    raw = JSON.parse(draft.visualJson)
  } catch {
    return { error: "Visual content is not valid JSON" }
  }
  const visual = lessonVisualSchema.safeParse(raw)
  if (!visual.success) {
    const issue = visual.error.errors[0]
    return { error: `Visual ${issue.path.join(".") || "content"}: ${issue.message}` }
  }
  return {
    scene: {
      title: draft.title.trim(),
      narration: draft.narration.trim(),
      visual: visual.data,
      ...(keepsRecording(draft) && { audio: draft.audio }),
    },
  }
}

const visualTypes = Object.keys(lessonVisualLabels) as LessonVisualType[]

/**
 * Admin editor for a course's narrated lesson, with a live preview of the saved version
 */
export function LessonEditor({ courseId, lesson, canEdit }: LessonEditorProps) {
  const updateCourse = useUpdateTrainingCourse()
  const [drafts, setDrafts] = useState<DraftScene[]>(() => lesson?.scenes.map(toDraft) ?? [])

  useEffect(() => {
    setDrafts(lesson?.scenes.map(toDraft) ?? [])
  }, [lesson])

  const parsed = useMemo(() => drafts.map(parseDraft), [drafts])
  const errorCount = parsed.filter((p) => p.error).length

  const update = (index: number, patch: Partial<DraftScene>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  const move = (index: number, direction: -1 | 1) =>
    setDrafts((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const addScene = (type: LessonVisualType) =>
    setDrafts((prev) => [...prev, toDraft(createSceneTemplate(type))])

  const handleSave = async () => {
    if (drafts.length === 0) {
      toast.error("Add at least one scene")
      return
    }
    if (errorCount > 0) {
      toast.error(`Fix ${errorCount} scene${errorCount === 1 ? "" : "s"} before saving`)
      return
    }
    try {
      await updateCourse.mutateAsync({
        id: courseId,
        data: { lesson: { scenes: parsed.map((p) => p.scene!) } },
      })
      toast.success("Lesson saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save lesson")
    }
  }

  return (
    <div className="space-y-6">
      {lesson && lesson.scenes.length > 0 ? (
        <section className="max-w-3xl space-y-2">
          <h3 className="text-sm font-semibold">Preview (saved version)</h3>
          <LessonPlayer key={JSON.stringify(lesson)} lesson={lesson} completed onComplete={() => {}} allowSeek />
        </section>
      ) : (
        <div className="flex max-w-3xl flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <Clapperboard className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No lesson yet</p>
          <p className="text-sm text-muted-foreground">
            Build a narrated, animated lesson from scenes. Each scene has narration (spoken and shown as captions) and a
            visual. Courses without a lesson play the external video from the Details tab instead.
          </p>
        </div>
      )}

      <section className="max-w-3xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm">
            <span className="font-medium">{drafts.length}</span> scene{drafts.length === 1 ? "" : "s"}
            {drafts.length > 0 && errorCount === 0 && (
              <span className="text-muted-foreground">
                {" "}· about {estimateLessonMinutes({ scenes: parsed.map((p) => p.scene!) })} min
              </span>
            )}
            {errorCount > 0 && <span className="text-destructive"> · {errorCount} need fixing</span>}
          </p>
          {canEdit && (
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={drafts.length >= 20}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Scene
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {visualTypes.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => addScene(type)}>
                      {lessonVisualLabels[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleSave} disabled={updateCourse.isPending || drafts.length === 0}>
                {updateCourse.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Lesson
              </Button>
            </div>
          )}
        </div>

        {drafts.map((draft, index) => {
          const result = parsed[index]
          const type = result.scene?.visual.type
          return (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Scene {index + 1}</span>
                {type && <Badge variant="outline">{lessonVisualLabels[type]}</Badge>}
                {keepsRecording(draft) ? (
                  <Badge variant="secondary">Recorded voice</Badge>
                ) : draft.audio ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Narration changed: this scene will use the browser voice
                  </span>
                ) : null}
                {result.error && <span className="text-xs text-destructive">{result.error}</span>}
                {canEdit && (
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move scene up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={index === drafts.length - 1} aria-label="Move scene down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Delete scene"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor={`scene-${index}-title`} className="text-xs text-muted-foreground">Scene title</Label>
                <Input
                  id={`scene-${index}-title`}
                  value={draft.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`scene-${index}-narration`} className="text-xs text-muted-foreground">
                  Narration (spoken and shown as captions)
                </Label>
                <Textarea
                  id={`scene-${index}-narration`}
                  value={draft.narration}
                  onChange={(e) => update(index, { narration: e.target.value })}
                  rows={4}
                  disabled={!canEdit}
                />
              </div>

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-2">
                    <ChevronDown className="mr-1 h-4 w-4" />
                    Visual content
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1">
                  <p className="text-xs text-muted-foreground">
                    The on-screen content for this scene, as JSON. Edit the text values; keep the structure.
                  </p>
                  <Textarea
                    value={draft.visualJson}
                    onChange={(e) => update(index, { visualJson: e.target.value })}
                    rows={10}
                    className="font-mono text-xs"
                    spellCheck={false}
                    disabled={!canEdit}
                    aria-label={`Visual content for scene ${index + 1}`}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          )
        })}
      </section>
    </div>
  )
}
