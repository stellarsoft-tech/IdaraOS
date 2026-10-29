"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  useReplaceTrainingQuestions,
  type TrainingQuestion,
  type TrainingQuestionInput,
} from "@/lib/api/security-training"
import {
  MAX_OPTIONS_PER_QUESTION,
  MIN_OPTIONS_PER_QUESTION,
  QUESTIONS_PER_COURSE,
} from "@/lib/security/training"

interface QuestionEditorProps {
  courseId: string
  questions: TrainingQuestion[]
  canEdit: boolean
}

interface DraftQuestion {
  question: string
  options: string[]
  correctOptionIndex: number
  explanation: string
}

const blankQuestion = (): DraftQuestion => ({
  question: "",
  options: ["", "", "", ""],
  correctOptionIndex: 0,
  explanation: "",
})

function toDrafts(questions: TrainingQuestion[]): DraftQuestion[] {
  const drafts = questions.slice(0, QUESTIONS_PER_COURSE).map((q) => ({
    question: q.question,
    options: [...q.options],
    correctOptionIndex: q.correctOptionIndex,
    explanation: q.explanation ?? "",
  }))
  while (drafts.length < QUESTIONS_PER_COURSE) drafts.push(blankQuestion())
  return drafts
}

function isComplete(q: DraftQuestion): boolean {
  return (
    q.question.trim() !== "" &&
    q.options.length >= MIN_OPTIONS_PER_QUESTION &&
    q.options.every((o) => o.trim() !== "") &&
    q.correctOptionIndex < q.options.length
  )
}

/**
 * Editor for the course's 10 multiple-choice questions
 */
export function QuestionEditor({ courseId, questions, canEdit }: QuestionEditorProps) {
  const replaceQuestions = useReplaceTrainingQuestions()
  const [drafts, setDrafts] = useState<DraftQuestion[]>(() => toDrafts(questions))

  useEffect(() => {
    setDrafts(toDrafts(questions))
  }, [questions])

  const completeCount = useMemo(() => drafts.filter(isComplete).length, [drafts])

  const update = (index: number, patch: Partial<DraftQuestion>) => {
    setDrafts((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setDrafts((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q
      )
    )
  }

  const addOption = (qIndex: number) => {
    setDrafts((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ""] } : q))
    )
  }

  const removeOption = (qIndex: number, oIndex: number) => {
    setDrafts((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q
        const options = q.options.filter((_, j) => j !== oIndex)
        let correct = q.correctOptionIndex
        if (oIndex === correct) correct = 0
        else if (oIndex < correct) correct -= 1
        return { ...q, options, correctOptionIndex: correct }
      })
    )
  }

  const handleSave = async () => {
    if (completeCount !== QUESTIONS_PER_COURSE) {
      toast.error(`Complete all ${QUESTIONS_PER_COURSE} questions before saving`)
      return
    }
    const payload: TrainingQuestionInput[] = drafts.map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation.trim() || null,
    }))
    try {
      await replaceQuestions.mutateAsync({ courseId, questions: payload })
      toast.success("Quiz saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save quiz")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <p className="text-sm">
          <span className="font-medium">{completeCount}</span> of {QUESTIONS_PER_COURSE} questions complete.
          <span className="text-muted-foreground"> Select the radio button next to the correct answer.</span>
        </p>
        {canEdit && (
          <Button onClick={handleSave} disabled={replaceQuestions.isPending}>
            {replaceQuestions.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Quiz
          </Button>
        )}
      </div>

      {drafts.map((q, qIndex) => (
        <div key={qIndex} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor={`q-${qIndex}`} className="text-sm font-semibold">
              Question {qIndex + 1}
            </Label>
            {!isComplete(q) && <span className="text-xs text-amber-600 dark:text-amber-400">Incomplete</span>}
          </div>
          <Textarea
            id={`q-${qIndex}`}
            value={q.question}
            onChange={(e) => update(qIndex, { question: e.target.value })}
            placeholder="Enter the question"
            rows={2}
            disabled={!canEdit}
          />

          <RadioGroup
            value={String(q.correctOptionIndex)}
            onValueChange={(v) => update(qIndex, { correctOptionIndex: Number(v) })}
            disabled={!canEdit}
            className="space-y-2"
          >
            {q.options.map((option, oIndex) => (
              <div key={oIndex} className="flex items-center gap-2">
                <RadioGroupItem
                  value={String(oIndex)}
                  id={`q-${qIndex}-o-${oIndex}`}
                  aria-label={`Mark option ${oIndex + 1} as correct`}
                />
                <Input
                  value={option}
                  onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                  placeholder={`Option ${oIndex + 1}`}
                  disabled={!canEdit}
                  className={q.correctOptionIndex === oIndex ? "border-green-500" : undefined}
                />
                {canEdit && q.options.length > MIN_OPTIONS_PER_QUESTION && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(qIndex, oIndex)}
                    aria-label={`Remove option ${oIndex + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </RadioGroup>

          {canEdit && q.options.length < MAX_OPTIONS_PER_QUESTION && (
            <Button type="button" variant="outline" size="sm" onClick={() => addOption(qIndex)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add option
            </Button>
          )}

          <div className="space-y-1">
            <Label htmlFor={`q-${qIndex}-explanation`} className="text-xs text-muted-foreground">
              Explanation (shown to employees after they pass)
            </Label>
            <Input
              id={`q-${qIndex}-explanation`}
              value={q.explanation}
              onChange={(e) => update(qIndex, { explanation: e.target.value })}
              placeholder="Why is this the right answer?"
              disabled={!canEdit}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
