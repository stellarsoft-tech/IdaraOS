/**
 * Security Training - shared helpers
 * Pure functions used by both API routes and UI (no database access here)
 */

import type {
  TrainingAssignmentStatus,
  TrainingCourseCategory,
  TrainingCourseStatus,
} from "@/lib/db/schema/security-training"

/** Every course quiz has exactly this many multiple-choice questions */
export const QUESTIONS_PER_COURSE = 10

/** Allowed number of answer options per question */
export const MIN_OPTIONS_PER_QUESTION = 2
export const MAX_OPTIONS_PER_QUESTION = 6

export const DEFAULT_PASSING_SCORE = 70

// ============================================================================
// LABELS
// ============================================================================

export const trainingCategoryLabels: Record<TrainingCourseCategory, string> = {
  phishing: "Phishing",
  passwords: "Passwords & MFA",
  social_engineering: "Social Engineering",
  data_protection: "Data Protection",
  device_security: "Device Security",
  incident_reporting: "Incident Reporting",
  general: "General",
}

export const trainingCourseStatusLabels: Record<TrainingCourseStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
}

export const trainingAssignmentStatusLabels: Record<TrainingAssignmentStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  passed: "Passed",
  retake_required: "Retake Required",
}

export const trainingAssignmentStatusClassNames: Record<TrainingAssignmentStatus, string> = {
  not_started: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  passed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  retake_required: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

// ============================================================================
// SCORING
// ============================================================================

export interface GradableQuestion {
  id: string
  correctOptionIndex: number
}

export interface GradedAnswer {
  questionId: string
  selectedOptionIndex: number | null
  correct: boolean
}

export interface GradeResult {
  answers: GradedAnswer[]
  correctCount: number
  totalQuestions: number
  score: number
  passed: boolean
}

/**
 * Grade a quiz submission against the course questions.
 * Unanswered questions count as incorrect. Score is a whole-number percentage.
 */
export function gradeQuiz(
  questions: GradableQuestion[],
  submitted: Record<string, number | null | undefined>,
  passingScore: number
): GradeResult {
  const answers = questions.map((q) => {
    const selected = submitted[q.id]
    const selectedOptionIndex = typeof selected === "number" ? selected : null
    return {
      questionId: q.id,
      selectedOptionIndex,
      correct: selectedOptionIndex === q.correctOptionIndex,
    }
  })

  const correctCount = answers.filter((a) => a.correct).length
  const totalQuestions = questions.length
  const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100)

  return {
    answers,
    correctCount,
    totalQuestions,
    score,
    passed: score >= passingScore,
  }
}

/**
 * Number of correct answers needed to pass, for display ("7 of 10")
 */
export function requiredCorrectAnswers(passingScore: number, totalQuestions = QUESTIONS_PER_COURSE): number {
  return Math.ceil((passingScore / 100) * totalQuestions)
}

// ============================================================================
// VIDEO
// ============================================================================

export type TrainingVideoSource =
  | { kind: "youtube"; videoId: string; embedUrl: string }
  | { kind: "vimeo"; videoId: string; embedUrl: string }
  | { kind: "file"; url: string }

/**
 * Resolve a course video URL into something the player can render.
 * Supports YouTube, Vimeo, and direct video files (mp4/webm/ogg). Returns null otherwise.
 */
export function parseTrainingVideoUrl(rawUrl: string | null | undefined): TrainingVideoSource | null {
  if (!rawUrl) return null

  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null

  const host = url.hostname.replace(/^www\.|^m\./, "")

  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    let videoId: string | null = null
    if (host === "youtu.be") {
      videoId = url.pathname.slice(1).split("/")[0] || null
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v")
    } else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)
      videoId = match?.[1] ?? null
    }
    if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return null
    return {
      kind: "youtube",
      videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`,
    }
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/(?:^|\/)(\d{5,})(?:$|\/)/)
    if (!match) return null
    return {
      kind: "vimeo",
      videoId: match[1],
      embedUrl: `https://player.vimeo.com/video/${match[1]}`,
    }
  }

  if (/\.(mp4|webm|ogg|ogv|mov)$/i.test(url.pathname)) {
    return { kind: "file", url: url.toString() }
  }

  return null
}

// ============================================================================
// ASSIGNMENT STATE
// ============================================================================

/**
 * Whether an assignment is past its due date and not yet passed
 */
export function isAssignmentOverdue(
  dueDate: string | null | undefined,
  status: TrainingAssignmentStatus,
  today: Date = new Date()
): boolean {
  if (!dueDate || status === "passed") return false
  const due = new Date(`${dueDate}T23:59:59`)
  return due.getTime() < today.getTime()
}
