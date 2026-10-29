import { describe, it, expect } from "vitest"
import {
  QUESTIONS_PER_COURSE,
  gradeQuiz,
  isAssignmentOverdue,
  parseTrainingVideoUrl,
  requiredCorrectAnswers,
} from "../../lib/security/training"
import { TRAINING_LIBRARY } from "../../lib/security/training-library"
import {
  createSceneTemplate,
  estimateSceneMs,
  lessonIllustrationBeats,
  lessonVisualLabels,
  narrationHash,
  splitSentences,
  trainingLessonSchema,
  type LessonVisualType,
} from "../../lib/security/training-lesson"

const questions = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i}`,
  correctOptionIndex: i % 4,
}))

function answersWithCorrect(count: number): Record<string, number> {
  return Object.fromEntries(
    questions.map((q, i) => [q.id, i < count ? q.correctOptionIndex : (q.correctOptionIndex + 1) % 4])
  )
}

describe("Security Training - gradeQuiz", () => {
  it("scores all correct as 100% and passes", () => {
    const result = gradeQuiz(questions, answersWithCorrect(10), 70)
    expect(result.score).toBe(100)
    expect(result.correctCount).toBe(10)
    expect(result.passed).toBe(true)
  })

  it("passes when the score equals the passing score", () => {
    const result = gradeQuiz(questions, answersWithCorrect(7), 70)
    expect(result.score).toBe(70)
    expect(result.passed).toBe(true)
  })

  it("requires a retake when below the passing score", () => {
    const result = gradeQuiz(questions, answersWithCorrect(6), 70)
    expect(result.score).toBe(60)
    expect(result.passed).toBe(false)
  })

  it("counts unanswered questions as incorrect", () => {
    const partial = { q0: questions[0].correctOptionIndex }
    const result = gradeQuiz(questions, partial, 70)
    expect(result.correctCount).toBe(1)
    expect(result.answers[1]).toEqual({ questionId: "q1", selectedOptionIndex: null, correct: false })
  })

  it("scores an empty quiz as 0", () => {
    expect(gradeQuiz([], {}, 0).score).toBe(0)
  })
})

describe("Security Training - requiredCorrectAnswers", () => {
  it("rounds up to whole questions", () => {
    expect(requiredCorrectAnswers(70)).toBe(7)
    expect(requiredCorrectAnswers(75)).toBe(8)
    expect(requiredCorrectAnswers(0)).toBe(0)
    expect(requiredCorrectAnswers(100)).toBe(10)
  })
})

describe("Security Training - parseTrainingVideoUrl", () => {
  it("parses YouTube watch, short, and embed links", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=K7jIURPBSbQ",
      "https://youtu.be/K7jIURPBSbQ",
      "https://www.youtube.com/embed/K7jIURPBSbQ",
      "https://m.youtube.com/watch?v=K7jIURPBSbQ&t=10",
    ]) {
      const source = parseTrainingVideoUrl(url)
      expect(source?.kind).toBe("youtube")
      expect(source && "videoId" in source && source.videoId).toBe("K7jIURPBSbQ")
    }
  })

  it("parses Vimeo links", () => {
    expect(parseTrainingVideoUrl("https://vimeo.com/76979871")).toMatchObject({ kind: "vimeo", videoId: "76979871" })
  })

  it("accepts direct video files", () => {
    expect(parseTrainingVideoUrl("https://cdn.example.com/training/phishing.mp4")?.kind).toBe("file")
  })

  it("rejects unsupported or unsafe URLs", () => {
    expect(parseTrainingVideoUrl("javascript:alert(1)")).toBeNull()
    expect(parseTrainingVideoUrl("https://example.com/page")).toBeNull()
    expect(parseTrainingVideoUrl("not a url")).toBeNull()
    expect(parseTrainingVideoUrl("")).toBeNull()
  })
})

describe("Security Training - isAssignmentOverdue", () => {
  const today = new Date("2026-10-26T12:00:00")

  it("is overdue after the due date when not passed", () => {
    expect(isAssignmentOverdue("2026-10-25", "in_progress", today)).toBe(true)
  })

  it("is not overdue on the due date itself", () => {
    expect(isAssignmentOverdue("2026-10-26", "not_started", today)).toBe(false)
  })

  it("is never overdue once passed or without a due date", () => {
    expect(isAssignmentOverdue("2026-01-01", "passed", today)).toBe(false)
    expect(isAssignmentOverdue(null, "retake_required", today)).toBe(false)
  })
})

describe("Security Training - lessons", () => {
  it("splits narration into sentences", () => {
    expect(splitSentences("First one. Second one? Third! Trailing words")).toEqual([
      "First one.",
      "Second one?",
      "Third!",
      "Trailing words",
    ])
  })

  it("estimates longer narration as longer scenes, with a minimum", () => {
    const short = estimateSceneMs({ narration: "Hi." })
    const long = estimateSceneMs({ narration: Array(130).fill("word").join(" ") })
    expect(short).toBe(4000)
    expect(long).toBeGreaterThan(45000)
  })

  it("creates a valid template for every scene type", () => {
    for (const type of Object.keys(lessonVisualLabels) as LessonVisualType[]) {
      expect(trainingLessonSchema.safeParse({ scenes: [createSceneTemplate(type)] }).success).toBe(true)
    }
  })

  it("keeps illustrated narration in sync with illustration beats", () => {
    for (const course of TRAINING_LIBRARY) {
      for (const scene of course.lesson.scenes) {
        if (scene.visual.type !== "illustration") continue
        expect(splitSentences(scene.narration).length, `${course.key}: ${scene.title}`).toBe(
          lessonIllustrationBeats[scene.visual.scene]
        )
      }
    }
  })

  it("attaches recorded narration only when it matches the narration text", () => {
    const social = TRAINING_LIBRARY.find((c) => c.key === "social-engineering")!
    for (const scene of social.lesson.scenes) {
      expect(scene.audio, scene.title).toBeDefined()
      expect(scene.audio!.sentenceStartsMs).toHaveLength(splitSentences(scene.narration).length)
      expect(scene.audio!.url).toContain(narrationHash(scene.narration))
    }
    expect(narrationHash("Hello")).toMatch(/^[0-9a-f]{8}$/)
    expect(narrationHash("Hello")).toBe(narrationHash("Hello"))
    expect(narrationHash("Hello")).not.toBe(narrationHash("Hello."))
  })

  it("rejects malformed lessons", () => {
    expect(trainingLessonSchema.safeParse({ scenes: [] }).success).toBe(false)
    expect(
      trainingLessonSchema.safeParse({
        scenes: [{ title: "x", narration: "y", visual: { type: "unknown" } }],
      }).success
    ).toBe(false)
  })
})

describe("Security Training - starter library", () => {
  it("has unique keys and valid, playable courses with 10 questions each", () => {
    const keys = new Set(TRAINING_LIBRARY.map((c) => c.key))
    expect(keys.size).toBe(TRAINING_LIBRARY.length)

    for (const course of TRAINING_LIBRARY) {
      const lesson = trainingLessonSchema.safeParse(course.lesson)
      expect(lesson.success, `${course.key} lesson: ${lesson.error?.errors[0]?.message}`).toBe(true)
      expect(course.questions).toHaveLength(QUESTIONS_PER_COURSE)
      expect(course.passingScore).toBeGreaterThanOrEqual(0)
      expect(course.passingScore).toBeLessThanOrEqual(100)
      for (const q of course.questions) {
        expect(q.options.length).toBeGreaterThanOrEqual(2)
        expect(q.correctOptionIndex).toBeGreaterThanOrEqual(0)
        expect(q.correctOptionIndex).toBeLessThan(q.options.length)
      }
    }
  })
})
