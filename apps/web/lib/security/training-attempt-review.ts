/**
 * Security Training - attempt review shaping (server only)
 * Builds the per-question review shown to an employee after a quiz attempt.
 * Correct answers and explanations are only revealed once the course is passed,
 * so a failed attempt cannot be used to memorise answers for the retake.
 */

import type { TrainingAttempt, TrainingQuestion } from "@/lib/db/schema"

export interface AttemptReviewItem {
  questionId: string
  question: string
  options: string[]
  selectedOptionIndex: number | null
  correct: boolean
  correctOptionIndex?: number
  explanation?: string | null
}

export interface AttemptReview {
  id: string
  score: number
  correctCount: number
  totalQuestions: number
  passingScore: number
  passed: boolean
  submittedAt: Date
  items: AttemptReviewItem[]
}

export function buildAttemptReview(
  attempt: TrainingAttempt,
  questions: TrainingQuestion[],
  revealAnswers: boolean
): AttemptReview {
  const byId = new Map(questions.map((q) => [q.id, q]))

  const items = attempt.answers.flatMap((a): AttemptReviewItem[] => {
    const q = byId.get(a.questionId)
    // Questions edited since the attempt can no longer be shown
    if (!q) return []
    return [{
      questionId: q.id,
      question: q.question,
      options: q.options,
      selectedOptionIndex: a.selectedOptionIndex,
      correct: a.correct,
      ...(revealAnswers && {
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
      }),
    }]
  })

  return {
    id: attempt.id,
    score: attempt.score,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    passingScore: attempt.passingScore,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
    items,
  }
}
