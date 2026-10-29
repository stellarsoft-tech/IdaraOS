"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Captions,
  CaptionsOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  countWords,
  estimateLessonMinutes,
  sceneDurationMs,
  splitSentences,
  type TrainingLesson,
} from "@/lib/security/training-lesson"
import { LessonVisualView } from "./lesson-visuals"
import { illustrationsWithBot } from "./lesson-illustrations"
import { TrainingBot } from "./training-bot"

const MUTED_STORAGE_KEY = "idaraos.training.lessonMuted"
const TICK_MS = 100
/** Minimum time a scene stays on screen after its narration finishes */
const MIN_SCENE_AFTER_NARRATION_MS = 1200
/** A browser-spoken scene never ends before this fraction of its estimated reading time */
const MIN_SPEECH_FRACTION = 0.6

/**
 * How a scene's narration is delivered:
 * - audio: pre-recorded narration file (natural voice, exact caption timings)
 * - speech: the browser's built-in speech synthesis
 * - timer: captions only, advancing at reading speed
 */
type NarrationMode = "audio" | "speech" | "timer"

function readMutedPreference(): boolean {
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function writeMutedPreference(muted: boolean) {
  try {
    window.localStorage.setItem(MUTED_STORAGE_KEY, String(muted))
  } catch {
    // Storage may be unavailable (private mode); the preference just won't persist
  }
}

/** Pick the most natural-sounding English voice available in this browser */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"))
  if (english.length === 0) return voices[0] ?? null
  const preferredLang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en-us"
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 4 : 0) +
    (/google|microsoft|samantha|daniel/i.test(v.name) ? 2 : 0) +
    (v.lang.toLowerCase() === preferredLang ? 1 : 0)
  return [...english].sort((a, b) => score(b) - score(a))[0]
}

export interface LessonPlayerProps {
  lesson: TrainingLesson
  /** True once the user has completed the lesson (server state); unlocks free navigation */
  completed: boolean
  /** Called once when the last scene finishes */
  onComplete: () => void
  /** Allow jumping to any scene (admin preview) */
  allowSeek?: boolean
}

/**
 * Plays a narrated, animated lesson scene by scene, presented by Byte the bot.
 * Scenes with recorded narration play the audio file; otherwise the browser's speech synthesis
 * reads the narration, and if that is muted or unavailable, captions advance at reading speed.
 * Viewers can go back but cannot skip ahead past scenes they have not watched.
 */
export function LessonPlayer({ lesson, completed, onComplete, allowSeek = false }: LessonPlayerProps) {
  const scenes = lesson.scenes
  const lastIndex = scenes.length - 1

  const [speechSupported, setSpeechSupported] = useState(false)
  // Set when the speech engine or an audio file errors; playback falls back gracefully
  const [speechFailed, setSpeechFailed] = useState(false)
  const [audioFailed, setAudioFailed] = useState(false)
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [muted, setMuted] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [maxReached, setMaxReached] = useState(completed ? lastIndex : 0)
  const [elapsedMs, setElapsedMs] = useState(0)
  // Scene time at which narration finished (null while still narrating)
  const [narrationDoneAtMs, setNarrationDoneAtMs] = useState<number | null>(null)
  const [spokenSentence, setSpokenSentence] = useState(0)

  const audioRef = useRef<HTMLAudioElement>(null)
  const elapsedRef = useRef(0)
  elapsedRef.current = elapsedMs
  const speechTokenRef = useRef(0)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const sentenceRef = useRef(0)
  const completeCalledRef = useRef(completed)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const canSeekAll = allowSeek || completed || finished
  const scene = scenes[sceneIndex]
  const nextScene = scenes[sceneIndex + 1]
  const sentences = useMemo(() => splitSentences(scene.narration), [scene.narration])
  const sceneMs = sceneDurationMs(scene)

  const mode: NarrationMode =
    scene.audio && !audioFailed ? "audio" : speechSupported && !muted && !speechFailed ? "speech" : "timer"
  const modeRef = useRef(mode)
  modeRef.current = mode
  const narrationDone = narrationDoneAtMs !== null

  // Browser capabilities and saved preference
  useEffect(() => {
    setMuted(readMutedPreference())
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    setSpeechSupported(true)
    const loadVoices = () => setVoice(pickVoice(window.speechSynthesis.getVoices()))
    loadVoices()
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    if (completed) {
      completeCalledRef.current = true
      setMaxReached(lastIndex)
    }
  }, [completed, lastIndex])

  const stopSpeech = useCallback(() => {
    speechTokenRef.current += 1
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Scene clock: follows the audio while it plays, otherwise real time
  // (measured, not counted, because browsers throttle timers in background tabs)
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = now - last
      last = now
      const audio = audioRef.current
      if (modeRef.current === "audio" && audio && !audio.ended) {
        setElapsedMs(audio.currentTime * 1000)
      } else {
        setElapsedMs((ms) => ms + delta)
      }
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [playing])

  // Recorded narration
  useEffect(() => {
    const audio = audioRef.current
    if (mode !== "audio" || !audio) return
    if (playing && !narrationDone) {
      audio.play().catch(() => setAudioFailed(true))
    } else {
      audio.pause()
    }
  }, [mode, playing, sceneIndex, narrationDone])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted, sceneIndex])

  // Browser speech: speak the scene sentence by sentence (long utterances get cut off in some browsers)
  useEffect(() => {
    if (!playing || mode !== "speech" || narrationDone) return
    stopSpeech()
    const token = speechTokenRef.current
    const synth = window.speechSynthesis

    const speak = (index: number) => {
      if (token !== speechTokenRef.current) return
      if (index >= sentences.length) {
        setNarrationDoneAtMs(elapsedRef.current)
        return
      }
      sentenceRef.current = index
      setSpokenSentence(index)
      const utterance = new SpeechSynthesisUtterance(sentences[index])
      if (voice) utterance.voice = voice
      utterance.onend = () => speak(index + 1)
      utterance.onerror = (event) => {
        // "interrupted"/"canceled" happen when we stop speech ourselves
        if (token !== speechTokenRef.current || event.error === "interrupted" || event.error === "canceled") return
        setSpeechFailed(true)
      }
      utteranceRef.current = utterance
      synth.speak(utterance)
    }

    // Some browsers drop an utterance queued immediately after cancel()
    const start = setTimeout(() => speak(sentenceRef.current), 50)
    return () => {
      clearTimeout(start)
      stopSpeech()
    }
  }, [playing, mode, sceneIndex, sentences, voice, narrationDone, stopSpeech])

  const goToScene = useCallback(
    (index: number) => {
      stopSpeech()
      sentenceRef.current = 0
      setSpokenSentence(0)
      setNarrationDoneAtMs(null)
      setElapsedMs(0)
      setSceneIndex(index)
      setMaxReached((max) => Math.max(max, index))
      if (audioRef.current) audioRef.current.currentTime = 0
    },
    [stopSpeech]
  )

  // Jumping to a scene plays it, so its visuals build up with the narration
  const jumpToScene = (index: number) => {
    setFinished(false)
    goToScene(index)
    setPlaying(true)
  }

  // Advance when the current scene is done
  useEffect(() => {
    if (!playing) return
    const afterNarration = narrationDoneAtMs !== null && elapsedMs - narrationDoneAtMs >= MIN_SCENE_AFTER_NARRATION_MS
    // Watchdogs cover browsers that never report the end of narration
    const done =
      mode === "audio"
        ? afterNarration || elapsedMs >= sceneMs * 1.5 + 5000
        : mode === "speech"
          ? (afterNarration && elapsedMs >= sceneMs * MIN_SPEECH_FRACTION) || elapsedMs >= sceneMs * 2.5 + 5000
          : elapsedMs >= sceneMs
    if (!done) return

    if (sceneIndex < lastIndex) {
      goToScene(sceneIndex + 1)
      return
    }
    stopSpeech()
    setPlaying(false)
    setFinished(true)
    setMaxReached(lastIndex)
    if (!completeCalledRef.current) {
      completeCalledRef.current = true
      onCompleteRef.current()
    }
  }, [playing, mode, narrationDoneAtMs, elapsedMs, sceneMs, sceneIndex, lastIndex, goToScene, stopSpeech])

  const handlePlay = () => {
    if (finished) {
      setFinished(false)
      goToScene(0)
    }
    setStarted(true)
    setPlaying(true)
  }

  const handlePause = () => {
    stopSpeech()
    setPlaying(false)
  }

  const toggleMuted = () => {
    const next = !muted
    if (mode === "speech") stopSpeech()
    setMuted(next)
    writeMutedPreference(next)
  }

  // Progress
  const sceneProgress = narrationDone
    ? 1
    : mode === "audio" && scene.audio
      ? Math.min(1, elapsedMs / scene.audio.durationMs)
      : mode === "speech"
        ? Math.min(0.95, elapsedMs / Math.max(1, sceneMs - MIN_SCENE_AFTER_NARRATION_MS))
        : Math.min(1, elapsedMs / sceneMs)

  const totalMs = useMemo(() => scenes.reduce((sum, s) => sum + sceneDurationMs(s), 0), [scenes])
  const doneMs = useMemo(
    () => scenes.slice(0, sceneIndex).reduce((sum, s) => sum + sceneDurationMs(s), 0),
    [scenes, sceneIndex]
  )
  const overallProgress = finished ? 1 : Math.min(1, (doneMs + sceneProgress * sceneMs) / totalMs)

  // Current sentence: drives captions and illustration beats
  const sentenceIndex = useMemo(() => {
    if (finished || narrationDone) return sentences.length - 1
    if (mode === "audio" && scene.audio) {
      const starts = scene.audio.sentenceStartsMs
      let index = 0
      for (let i = 0; i < starts.length; i++) if (elapsedMs >= starts[i]) index = i
      return Math.min(index, sentences.length - 1)
    }
    if (mode === "speech") return spokenSentence
    const words = sentences.map(countWords)
    const total = words.reduce((a, b) => a + b, 0)
    let cumulative = 0
    for (let i = 0; i < words.length; i++) {
      cumulative += words[i]
      if (sceneProgress <= cumulative / total) return i
    }
    return sentences.length - 1
  }, [finished, narrationDone, mode, scene.audio, elapsedMs, sentences, spokenSentence, sceneProgress])

  const talking = playing && !narrationDone
  const showPresenter =
    started && !(scene.visual.type === "illustration" && illustrationsWithBot.has(scene.visual.scene))
  const audible = mode === "audio" ? !muted : mode === "speech"

  return (
    <div
      className="overflow-hidden rounded-lg border bg-card"
      onKeyDown={(e) => {
        if (e.key === " " && e.target === e.currentTarget) {
          e.preventDefault()
          if (playing) handlePause()
          else handlePlay()
        }
      }}
      tabIndex={0}
      role="region"
      aria-label="Training lesson player"
    >
      {scene.audio && (
        <audio
          ref={audioRef}
          src={scene.audio.url}
          preload="auto"
          onEnded={() => setNarrationDoneAtMs(elapsedRef.current)}
          onError={() => setAudioFailed(true)}
        />
      )}
      {/* Warm the next scene's recording so scene changes don't pause */}
      {nextScene?.audio && <link rel="preload" as="audio" href={nextScene.audio.url} />}

      {/* Stage */}
      <div className="relative flex min-h-[440px] flex-col bg-gradient-to-br from-muted/60 via-background to-muted/40 sm:aspect-video sm:min-h-0">
        <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground">
          <span className="font-medium">{scene.title}</span>
          <span>
            Scene {sceneIndex + 1} of {scenes.length}
          </span>
        </div>

        <div key={sceneIndex} className={cn("min-h-0 flex-1 overflow-auto", scene.visual.type === "illustration" ? "p-2 sm:p-3" : "p-4 sm:p-6")}>
          <LessonVisualView visual={scene.visual} progress={finished ? 1 : sceneProgress} beat={sentenceIndex} talking={talking} />
        </div>

        {showPresenter && (
          <div className={cn("pointer-events-none absolute right-3 h-16 sm:h-20", captionsOn ? "bottom-16" : "bottom-3")}>
            <TrainingBot talking={talking} mood={finished ? "happy" : "neutral"} className="h-full" />
          </div>
        )}

        {captionsOn && started && (
          <div className="min-h-[3.25rem] bg-black/80 px-4 py-2 text-center text-sm text-white sm:text-base" aria-live="polite">
            {sentences[sentenceIndex]}
          </div>
        )}

        {/* Start / finished overlays */}
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <TrainingBot waving className="h-24" />
            <Button size="lg" onClick={handlePlay} className="h-14 gap-2 rounded-full px-8 text-base">
              <Play className="h-5 w-5" />
              Play lesson
            </Button>
            <p className="text-sm text-muted-foreground">
              About {estimateLessonMinutes(lesson)} min · {scenes.length} scenes
              {scenes.some((s) => s.audio) || speechSupported ? " · narrated" : " · captions"}
            </p>
          </div>
        )}
        {finished && !playing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="text-lg font-semibold">Lesson complete</p>
            <Button variant="outline" onClick={handlePlay}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Watch again
            </Button>
          </div>
        )}
      </div>

      <Progress value={overallProgress * 100} className="h-1.5 rounded-none" aria-label="Lesson progress" />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-2">
        {playing ? (
          <Button variant="ghost" size="icon" onClick={handlePause} aria-label="Pause">
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={handlePlay} aria-label={finished ? "Replay" : "Play"}>
            {finished ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => jumpToScene(sceneIndex - 1)}
          disabled={sceneIndex === 0 || !started}
          aria-label="Previous scene"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => jumpToScene(sceneIndex + 1)}
          disabled={!started || sceneIndex >= lastIndex || (!canSeekAll && sceneIndex + 1 > maxReached)}
          aria-label="Next scene"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="mx-2 flex flex-1 items-center gap-1" role="tablist" aria-label="Scenes">
          {scenes.map((s, i) => {
            const reachable = canSeekAll || i <= maxReached
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === sceneIndex}
                aria-label={`Scene ${i + 1}: ${s.title}`}
                title={s.title}
                disabled={!reachable || !started}
                onClick={() => jumpToScene(i)}
                className={cn(
                  "h-2 flex-1 rounded-full transition-colors",
                  i === sceneIndex ? "bg-primary" : i <= maxReached ? "bg-primary/40" : "bg-muted",
                  reachable && started ? "cursor-pointer hover:bg-primary/70" : "cursor-not-allowed"
                )}
              />
            )
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMuted}
          disabled={mode !== "audio" && (!speechSupported || speechFailed)}
          aria-label={muted ? "Turn narration on" : "Turn narration off"}
          title={
            mode !== "audio" && (!speechSupported || speechFailed)
              ? "Narration isn't available in this browser. Captions only."
              : undefined
          }
        >
          {audible ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCaptionsOn((on) => !on)}
          aria-label={captionsOn ? "Hide captions" : "Show captions"}
        >
          {captionsOn ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
