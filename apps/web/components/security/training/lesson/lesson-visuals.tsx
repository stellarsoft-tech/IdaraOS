"use client"

import {
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  Eye,
  Key,
  Laptop,
  Link2,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  Paperclip,
  Phone,
  RefreshCw,
  Shield,
  Smartphone,
  Users,
  Wifi,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { LessonIcon, LessonTone, LessonVisual } from "@/lib/security/training-lesson"
import { LessonIllustrationView } from "./lesson-illustrations"

const icons: Record<LessonIcon, LucideIcon> = {
  shield: Shield,
  mail: Mail,
  lock: Lock,
  key: Key,
  users: Users,
  phone: Phone,
  wifi: Wifi,
  laptop: Laptop,
  alert: AlertTriangle,
  bug: Bug,
  refresh: RefreshCw,
  megaphone: Megaphone,
  check: CheckCircle2,
  eye: Eye,
}

const toneClasses: Record<LessonTone, { panel: string; icon: string }> = {
  info: { panel: "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100", icon: "text-blue-600 dark:text-blue-400" },
  warning: { panel: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100", icon: "text-amber-600 dark:text-amber-400" },
  danger: { panel: "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100", icon: "text-red-600 dark:text-red-400" },
  success: { panel: "border-green-300 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100", icon: "text-green-600 dark:text-green-400" },
}

const enter = "animate-in fade-in slide-in-from-bottom-3 duration-500"

/**
 * Whether item `index` of `count` should be visible at this point of the scene.
 * Items appear evenly across the first ~85% of the narration.
 */
function isRevealed(index: number, count: number, progress: number): boolean {
  return progress >= ((index + 1) / (count + 1)) * 0.85
}

interface LessonVisualProps {
  visual: LessonVisual
  /** Scene progress from 0 to 1, drives progressive reveals */
  progress: number
  /** Index of the narration sentence playing now; illustrations step forward one beat per sentence */
  beat: number
  /** Narration is playing (animates Byte) */
  talking: boolean
}

/**
 * Renders one animated lesson scene visual
 */
export function LessonVisualView({ visual, progress, beat, talking }: LessonVisualProps) {
  switch (visual.type) {
    case "illustration":
      return <LessonIllustrationView scene={visual.scene} beat={beat} talking={talking} />
    case "title":
      return <TitleVisual visual={visual} />
    case "email":
      return <EmailVisual visual={visual} progress={progress} />
    case "messages":
      return <MessagesVisual visual={visual} progress={progress} />
    case "checklist":
      return <ChecklistVisual visual={visual} progress={progress} />
    case "comparison":
      return <ComparisonVisual visual={visual} progress={progress} />
    case "steps":
      return <StepsVisual visual={visual} progress={progress} />
    case "callout":
      return <CalloutVisual visual={visual} />
  }
}

function TitleVisual({ visual }: { visual: Extract<LessonVisual, { type: "title" }> }) {
  const Icon = icons[visual.icon ?? "shield"]
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className={cn("rounded-2xl bg-primary/10 p-5 text-primary", "animate-in zoom-in-50 fade-in duration-700")}>
        <Icon className="h-12 w-12 sm:h-16 sm:w-16" />
      </div>
      <h2 className={cn("max-w-xl text-2xl font-bold tracking-tight sm:text-4xl", enter, "delay-200 fill-mode-both")}>
        {visual.heading}
      </h2>
      {visual.subheading && (
        <p className={cn("max-w-lg text-base text-muted-foreground sm:text-lg", enter, "delay-500 fill-mode-both")}>
          {visual.subheading}
        </p>
      )}
    </div>
  )
}

function EmailVisual({ visual, progress }: { visual: Extract<LessonVisual, { type: "email" }>; progress: number }) {
  const visibleFlags = visual.flags.filter((_, i) => isRevealed(i, visual.flags.length, progress))
  const flagged = new Set(visibleFlags.map((f) => f.target))
  const highlight = (target: string) =>
    flagged.has(target as (typeof visual.flags)[number]["target"])
      ? "rounded ring-2 ring-red-500 ring-offset-2 ring-offset-background transition-shadow"
      : "transition-shadow"

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row">
      <div className={cn("flex-1 overflow-hidden rounded-lg border bg-background text-left shadow-sm", enter)}>
        <div className="space-y-1.5 border-b bg-muted/40 px-4 py-3 text-sm">
          <div className={cn("flex flex-wrap items-baseline gap-x-2 p-0.5", highlight("from"))}>
            <span className="text-muted-foreground">From:</span>
            <span className="font-medium">{visual.fromName}</span>
            <span className="text-muted-foreground">&lt;{visual.fromAddress}&gt;</span>
          </div>
          <div className={cn("flex gap-2 p-0.5", highlight("subject"))}>
            <span className="text-muted-foreground">Subject:</span>
            <span className="font-semibold">{visual.subject}</span>
          </div>
        </div>
        <div className="space-y-2 px-4 py-3 text-sm">
          <div className={cn("space-y-2 p-0.5", highlight("body"))}>
            {visual.body.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          {visual.link && (
            <div className={cn("inline-block p-0.5", highlight("link"))}>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
                <Link2 className="h-3.5 w-3.5" />
                {visual.link.text}
              </span>
              {flagged.has("link") && (
                <p className="mt-1 break-all font-mono text-xs text-red-600 dark:text-red-400">
                  Real destination: {visual.link.url}
                </p>
              )}
            </div>
          )}
          {visual.attachment && (
            <div className={cn("flex w-fit items-center gap-2 rounded-md border px-2 py-1 text-xs", highlight("attachment"))}>
              <Paperclip className="h-3.5 w-3.5" />
              {visual.attachment}
            </div>
          )}
        </div>
      </div>
      {visual.flags.length > 0 && (
        <ul className="flex flex-col gap-2 sm:w-56">
          {visibleFlags.map((flag, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
                "animate-in fade-in slide-in-from-right-4 duration-500"
              )}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {flag.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MessagesVisual({ visual, progress }: { visual: Extract<LessonVisual, { type: "messages" }>; progress: number }) {
  const ChannelIcon = visual.channel === "phone" ? Phone : visual.channel === "sms" ? Smartphone : MessageSquare
  const channelLabel = visual.channel === "phone" ? "Incoming call" : visual.channel === "sms" ? "Text message" : "Chat"
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <ChannelIcon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{visual.contact}</p>
          <p className="text-xs text-muted-foreground">{channelLabel}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-4">
        {visual.messages.map((message, i) =>
          isRevealed(i, visual.messages.length, progress) ? (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                message.from === "you"
                  ? "self-end rounded-br-sm bg-primary text-primary-foreground"
                  : "self-start rounded-bl-sm bg-muted",
                enter
              )}
            >
              {visual.channel === "phone" && (
                <span className="mb-0.5 block text-[10px] font-semibold uppercase opacity-70">
                  {message.from === "you" ? "You" : "Caller"}
                </span>
              )}
              {message.text}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

function ChecklistVisual({ visual, progress }: { visual: Extract<LessonVisual, { type: "checklist" }>; progress: number }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-center gap-3">
      {visual.heading && <h3 className={cn("text-lg font-semibold sm:text-xl", enter)}>{visual.heading}</h3>}
      <ul className="space-y-2">
        {visual.items.map((item, i) =>
          isRevealed(i, visual.items.length, progress) ? (
            <li
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm sm:text-base",
                "animate-in fade-in slide-in-from-left-4 duration-500"
              )}
            >
              {item.good ? (
                <span className="mt-0.5 rounded-full bg-green-100 p-1 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="mt-0.5 rounded-full bg-red-100 p-1 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <span>{item.text}</span>
            </li>
          ) : null
        )}
      </ul>
    </div>
  )
}

function ComparisonVisual({ visual, progress }: { visual: Extract<LessonVisual, { type: "comparison" }>; progress: number }) {
  const total = visual.bad.items.length + visual.good.items.length
  const column = (side: "bad" | "good", offset: number) => {
    const data = visual[side]
    const good = side === "good"
    return (
      <div
        className={cn(
          "flex-1 rounded-lg border p-4",
          good
            ? "border-green-300 bg-green-50/60 dark:border-green-800 dark:bg-green-950/30"
            : "border-red-300 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30",
          enter
        )}
      >
        <h3 className={cn("mb-3 flex items-center gap-2 font-semibold", good ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
          {good ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {data.title}
        </h3>
        <ul className="space-y-2">
          {data.items.map((item, i) =>
            isRevealed(offset + i, total, progress) ? (
              <li key={i} className={cn("rounded-md bg-background px-3 py-2 text-sm shadow-sm", enter)}>
                {item}
              </li>
            ) : null
          )}
        </ul>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col justify-center gap-3 sm:flex-row sm:items-stretch">
      {column("bad", 0)}
      {column("good", visual.bad.items.length)}
    </div>
  )
}

function StepsVisual({ visual, progress }: { visual: Extract<LessonVisual, { type: "steps" }>; progress: number }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-center gap-3">
      {visual.heading && <h3 className={cn("text-lg font-semibold sm:text-xl", enter)}>{visual.heading}</h3>}
      <ol className="space-y-2">
        {visual.steps.map((step, i) =>
          isRevealed(i, visual.steps.length, progress) ? (
            <li key={i} className={cn("flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm sm:text-base", enter)}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ) : null
        )}
      </ol>
    </div>
  )
}

function CalloutVisual({ visual }: { visual: Extract<LessonVisual, { type: "callout" }> }) {
  const tone = toneClasses[visual.tone ?? "info"]
  const Icon = icons[visual.icon ?? (visual.tone === "danger" || visual.tone === "warning" ? "alert" : "shield")]
  return (
    <div className="flex h-full items-center justify-center">
      <div className={cn("flex max-w-xl flex-col items-center gap-3 rounded-2xl border-2 px-6 py-8 text-center", tone.panel, "animate-in zoom-in-90 fade-in duration-500")}>
        <Icon className={cn("h-10 w-10", tone.icon)} />
        <p className="text-2xl font-bold sm:text-3xl">{visual.value}</p>
        {visual.label && <p className="text-sm opacity-80 sm:text-base">{visual.label}</p>}
      </div>
    </div>
  )
}
