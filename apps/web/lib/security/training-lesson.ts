/**
 * Security Training - animated lessons
 *
 * A lesson is a sequence of scenes. Each scene has spoken narration (also shown as captions)
 * and a visual that the lesson player animates while the narration plays.
 * Shared by API validation and the UI (no database access here).
 */

import { z } from "zod"

// ============================================================================
// SCHEMA
// ============================================================================

export const lessonIconValues = [
  "shield", "mail", "lock", "key", "users", "phone", "wifi", "laptop",
  "alert", "bug", "refresh", "megaphone", "check", "eye",
] as const
export type LessonIcon = (typeof lessonIconValues)[number]

export const lessonToneValues = ["info", "warning", "danger", "success"] as const
export type LessonTone = (typeof lessonToneValues)[number]

export const emailFlagTargetValues = ["from", "subject", "body", "link", "attachment"] as const

const text = (max: number) => z.string().trim().min(1).max(max)

const titleVisualSchema = z.object({
  type: z.literal("title"),
  heading: text(120),
  subheading: z.string().trim().max(200).optional(),
  icon: z.enum(lessonIconValues).optional(),
})

const emailVisualSchema = z.object({
  type: z.literal("email"),
  fromName: text(100),
  fromAddress: text(200),
  subject: text(200),
  body: z.array(text(400)).min(1).max(8),
  link: z.object({ text: text(100), url: text(300) }).optional(),
  attachment: z.string().trim().max(120).optional(),
  flags: z.array(z.object({
    target: z.enum(emailFlagTargetValues),
    label: text(160),
  })).max(6),
})

const messagesVisualSchema = z.object({
  type: z.literal("messages"),
  channel: z.enum(["sms", "chat", "phone"]),
  contact: text(80),
  messages: z.array(z.object({
    from: z.enum(["them", "you"]),
    text: text(300),
  })).min(1).max(8),
})

const checklistVisualSchema = z.object({
  type: z.literal("checklist"),
  heading: z.string().trim().max(120).optional(),
  items: z.array(z.object({ text: text(200), good: z.boolean() })).min(1).max(8),
})

const comparisonVisualSchema = z.object({
  type: z.literal("comparison"),
  bad: z.object({ title: text(60), items: z.array(text(160)).min(1).max(6) }),
  good: z.object({ title: text(60), items: z.array(text(160)).min(1).max(6) }),
})

const stepsVisualSchema = z.object({
  type: z.literal("steps"),
  heading: z.string().trim().max(120).optional(),
  steps: z.array(text(200)).min(1).max(6),
})

const calloutVisualSchema = z.object({
  type: z.literal("callout"),
  value: text(80),
  label: z.string().trim().max(200).optional(),
  tone: z.enum(lessonToneValues).default("info"),
  icon: z.enum(lessonIconValues).optional(),
})

/**
 * Illustrated, animated scenes that act out what the narration describes.
 * Each illustration steps forward one "beat" per narration sentence.
 */
export const lessonIllustrationValues = [
  "se-intro",
  "se-phone-call",
  "se-levers",
  "se-tailgating",
  "se-usb-drop",
  "se-bank-change",
  "se-overshare",
  "se-verify",
] as const
export type LessonIllustration = (typeof lessonIllustrationValues)[number]

export const lessonIllustrationLabels: Record<LessonIllustration, string> = {
  "se-intro": "Social engineering: intro with Byte",
  "se-phone-call": "Fake IT support phone call",
  "se-levers": "Manipulation levers",
  "se-tailgating": "Tailgating through a secure door",
  "se-usb-drop": "USB stick found in the car park",
  "se-bank-change": "Supplier bank detail change",
  "se-overshare": "Oversharing on social media",
  "se-verify": "Verify through a trusted channel",
}

/** Number of animation beats in each illustration; its narration should have one sentence per beat */
export const lessonIllustrationBeats: Record<LessonIllustration, number> = {
  "se-intro": 5,
  "se-phone-call": 6,
  "se-levers": 5,
  "se-tailgating": 5,
  "se-usb-drop": 5,
  "se-bank-change": 5,
  "se-overshare": 5,
  "se-verify": 5,
}

const illustrationVisualSchema = z.object({
  type: z.literal("illustration"),
  scene: z.enum(lessonIllustrationValues),
})

export const lessonVisualSchema = z.discriminatedUnion("type", [
  titleVisualSchema,
  emailVisualSchema,
  messagesVisualSchema,
  checklistVisualSchema,
  comparisonVisualSchema,
  stepsVisualSchema,
  calloutVisualSchema,
  illustrationVisualSchema,
])

/**
 * Pre-recorded narration for a scene (generated with scripts/training-audio).
 * Only app-hosted files are allowed.
 */
export const lessonSceneAudioSchema = z.object({
  url: z.string().regex(/^\/training\/audio\/[a-z0-9/_-]+\.mp3$/, "Audio must be an app-hosted training file"),
  durationMs: z.number().int().positive().max(10 * 60 * 1000),
  /** Start time of each narration sentence, used for captions and illustration beats */
  sentenceStartsMs: z.array(z.number().int().min(0)).max(50),
})

export const lessonSceneSchema = z.object({
  title: text(120),
  narration: text(1200),
  visual: lessonVisualSchema,
  audio: lessonSceneAudioSchema.optional(),
})

export const trainingLessonSchema = z.object({
  scenes: z.array(lessonSceneSchema).min(1, "A lesson needs at least one scene").max(20, "A lesson can have at most 20 scenes"),
})

export type LessonVisual = z.infer<typeof lessonVisualSchema>
export type LessonVisualType = LessonVisual["type"]
export type LessonSceneAudio = z.infer<typeof lessonSceneAudioSchema>
export type LessonScene = z.infer<typeof lessonSceneSchema>
export type TrainingLesson = z.infer<typeof trainingLessonSchema>

/**
 * FNV-1a 32-bit hash of narration text, as 8 hex chars.
 * Recordings are keyed by this hash (scripts/training-audio), so recorded audio is only
 * attached while the narration it was recorded from is unchanged.
 */
export function narrationHash(narration: string): string {
  let hash = 0x811c9dc5
  const bytes = new TextEncoder().encode(narration)
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

// ============================================================================
// TIMING
// ============================================================================

/** Average narration speed (words per second, ~155 words per minute) */
const WORDS_PER_SECOND = 2.6
/** Pause after each scene's narration */
const SCENE_PAUSE_MS = 1200
const MIN_SCENE_MS = 4000

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

/** Estimated time to narrate a scene, used for captions-only playback and animations */
export function estimateSceneMs(scene: Pick<LessonScene, "narration">): number {
  return Math.max(MIN_SCENE_MS, Math.round((countWords(scene.narration) / WORDS_PER_SECOND) * 1000) + SCENE_PAUSE_MS)
}

/** Scene length: the recording's length when it has recorded narration, otherwise the estimate */
export function sceneDurationMs(scene: Pick<LessonScene, "narration" | "audio">): number {
  return scene.audio ? scene.audio.durationMs + SCENE_PAUSE_MS : estimateSceneMs(scene)
}

export function estimateLessonMinutes(lesson: TrainingLesson): number {
  const totalMs = lesson.scenes.reduce((sum, s) => sum + sceneDurationMs(s), 0)
  return Math.max(1, Math.round(totalMs / 60000))
}

/** Split narration into sentences so speech can be spoken in short, reliable chunks */
export function splitSentences(narration: string): string[] {
  const parts = narration.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [narration]
  return parts.map((p) => p.trim()).filter(Boolean)
}

// ============================================================================
// TEMPLATES (used by the lesson editor when adding a scene)
// ============================================================================

export const lessonVisualLabels: Record<LessonVisualType, string> = {
  title: "Title card",
  email: "Email with red flags",
  messages: "Text / chat / call",
  checklist: "Do and don't checklist",
  comparison: "Bad vs good comparison",
  steps: "Numbered steps",
  callout: "Key message",
  illustration: "Animated illustration",
}

export function createSceneTemplate(type: LessonVisualType): LessonScene {
  const visuals: Record<LessonVisualType, LessonVisual> = {
    title: { type: "title", heading: "Lesson title", subheading: "What employees will learn", icon: "shield" },
    email: {
      type: "email",
      fromName: "IT Support",
      fromAddress: "it-support@example-helpdesk.com",
      subject: "Action required",
      body: ["Dear user,", "Please verify your account today."],
      link: { text: "Verify now", url: "https://example-login.com" },
      flags: [{ target: "from", label: "Look-alike sender domain" }],
    },
    messages: {
      type: "messages",
      channel: "sms",
      contact: "Unknown number",
      messages: [{ from: "them", text: "Your parcel is on hold. Pay the fee here." }],
    },
    checklist: {
      type: "checklist",
      heading: "Do and don't",
      items: [
        { text: "Something to do", good: true },
        { text: "Something to avoid", good: false },
      ],
    },
    comparison: {
      type: "comparison",
      bad: { title: "Avoid", items: ["Risky habit"] },
      good: { title: "Do instead", items: ["Safe habit"] },
    },
    steps: { type: "steps", heading: "What to do", steps: ["First step", "Second step"] },
    callout: { type: "callout", value: "Key message", label: "Supporting detail", tone: "info", icon: "shield" },
    illustration: { type: "illustration", scene: "se-verify" },
  }
  return {
    title: lessonVisualLabels[type],
    narration: "Write what the narrator says during this scene.",
    visual: visuals[type],
  }
}
