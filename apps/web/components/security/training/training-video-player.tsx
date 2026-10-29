"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Clock, VideoOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { parseTrainingVideoUrl } from "@/lib/security/training"

// Minimal typings for the YouTube IFrame API (loaded at runtime from youtube.com)
interface YTPlayer {
  destroy: () => void
}
interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      host?: string
      playerVars?: Record<string, number | string>
      events?: { onStateChange?: (event: { data: number }) => void }
    }
  ) => YTPlayer
  PlayerState: { ENDED: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let youTubeApiPromise: Promise<YTNamespace> | null = null

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youTubeApiPromise) return youTubeApiPromise

  youTubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      youTubeApiPromise = null
      reject(new Error("Failed to load YouTube player"))
    }
    document.body.appendChild(script)
  })
  return youTubeApiPromise
}

export interface TrainingVideoPlayerProps {
  videoUrl: string | null
  /** Expected video length, used to time the manual confirmation fallback */
  durationMinutes?: number | null
  /** True once the user has completed the video (server state) */
  completed: boolean
  /** Called when the video finishes (or the user confirms after the minimum watch time) */
  onComplete: () => void
  completing?: boolean
}

/**
 * Plays a course video and reports completion.
 * - YouTube: completion detected from the player's "ended" event
 * - Direct video files: completion detected from the <video> "ended" event
 * - Vimeo (or if the YouTube API cannot load): a confirmation button unlocks after the minimum watch time
 */
export function TrainingVideoPlayer({
  videoUrl,
  durationMinutes,
  completed,
  onComplete,
  completing,
}: TrainingVideoPlayerProps) {
  const source = parseTrainingVideoUrl(videoUrl)
  const youTubeVideoId = source?.kind === "youtube" ? source.videoId : null
  const youTubeContainerRef = useRef<HTMLDivElement>(null)
  const [youTubeFailed, setYouTubeFailed] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Minimum time on page before manual confirmation is allowed (80% of expected length, 30s floor)
  const minimumWatchSeconds = Math.max(30, Math.round((durationMinutes ?? 1) * 60 * 0.8))
  const needsManualConfirm = source?.kind === "vimeo" || (source?.kind === "youtube" && youTubeFailed)
  const [secondsRemaining, setSecondsRemaining] = useState(minimumWatchSeconds)

  useEffect(() => {
    const container = youTubeContainerRef.current
    if (!youTubeVideoId || completed || !container) return
    let player: YTPlayer | null = null
    let cancelled = false

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        // The API replaces its target element, so give it a child React does not manage
        const target = document.createElement("div")
        container.appendChild(target)
        player = new YT.Player(target, {
          videoId: youTubeVideoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED) onCompleteRef.current()
            },
          },
        })
      })
      .catch(() => {
        if (!cancelled) setYouTubeFailed(true)
      })

    return () => {
      cancelled = true
      player?.destroy()
      container.replaceChildren()
    }
  }, [youTubeVideoId, completed])

  useEffect(() => {
    if (!needsManualConfirm || completed) return
    setSecondsRemaining(minimumWatchSeconds)
    const timer = setInterval(() => {
      setSecondsRemaining((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [needsManualConfirm, completed, minimumWatchSeconds])

  if (!source) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 text-muted-foreground">
        <VideoOff className="mb-2 h-8 w-8" />
        <p className="text-sm">This course does not have a playable video yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
        {source.kind === "youtube" && !youTubeFailed && !completed && (
          <div ref={youTubeContainerRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
        )}
        {source.kind === "youtube" && (youTubeFailed || completed) && (
          <iframe
            src={source.embedUrl}
            title="Course video"
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}
        {source.kind === "vimeo" && (
          <iframe
            src={source.embedUrl}
            title="Course video"
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
        {source.kind === "file" && (
          <video
            src={source.url}
            controls
            playsInline
            className="h-full w-full"
            onEnded={() => onCompleteRef.current()}
          />
        )}
      </div>

      {completed ? (
        <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          Video completed
        </p>
      ) : needsManualConfirm ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => onComplete()} disabled={secondsRemaining > 0 || completing}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            I&apos;ve watched the video
          </Button>
          {secondsRemaining > 0 && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Available in {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Watch the video to the end to unlock the quiz.
        </p>
      )}
    </div>
  )
}
