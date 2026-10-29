"use client"

import { cn } from "@/lib/utils"

export type TrainingBotMood = "neutral" | "happy" | "alert"

interface TrainingBotProps {
  /** Animates the mouth while narration is playing */
  talking?: boolean
  mood?: TrainingBotMood
  /** Waves its right arm */
  waving?: boolean
  className?: string
}

const eyeColors: Record<TrainingBotMood, string> = {
  neutral: "#5eead4",
  happy: "#86efac",
  alert: "#fbbf24",
}

/**
 * "Byte", the animated security training presenter.
 * Pure SVG with SMIL animations (no CSS keyframes needed).
 */
export function TrainingBot({ talking = false, mood = "neutral", waving = false, className }: TrainingBotProps) {
  const eye = eyeColors[mood]
  return (
    <svg viewBox="0 0 120 140" className={cn("h-20 w-auto drop-shadow-md", className)} role="img" aria-label="Byte the security bot">
      <g>
        {/* Gentle idle bob */}
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -3; 0 0" dur="2.6s" repeatCount="indefinite" />

        {/* Antenna */}
        <line x1="60" y1="22" x2="60" y2="9" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="7" r="5" fill={mood === "alert" ? "#ef4444" : "#f59e0b"}>
          <animate attributeName="opacity" values="1;0.35;1" dur={mood === "alert" ? "0.6s" : "1.8s"} repeatCount="indefinite" />
        </circle>

        {/* Ears */}
        <rect x="12" y="44" width="10" height="20" rx="4" fill="#4f46e5" />
        <rect x="98" y="44" width="10" height="20" rx="4" fill="#4f46e5" />

        {/* Head and face screen */}
        <rect x="20" y="22" width="80" height="62" rx="18" fill="#6366f1" />
        <rect x="30" y="33" width="60" height="40" rx="11" fill="#0f172a" />

        {/* Eyes */}
        {mood === "happy" ? (
          <>
            <path d="M40 52 q7 -9 14 0" stroke={eye} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M66 52 q7 -9 14 0" stroke={eye} strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="47" cy="49" rx="6" ry="7" fill={eye}>
              <animate attributeName="ry" values="7;7;0.8;7" keyTimes="0;0.92;0.96;1" dur="4.2s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="73" cy="49" rx="6" ry="7" fill={eye}>
              <animate attributeName="ry" values="7;7;0.8;7" keyTimes="0;0.92;0.96;1" dur="4.2s" repeatCount="indefinite" />
            </ellipse>
          </>
        )}

        {/* Mouth */}
        {talking ? (
          <ellipse cx="60" cy="64" rx="8" ry="2" fill={eye}>
            <animate attributeName="ry" values="1.5;4.5;2;5;1.5;3.5;1.5" dur="0.9s" repeatCount="indefinite" />
          </ellipse>
        ) : mood === "alert" ? (
          <rect x="52" y="62" width="16" height="4" rx="2" fill={eye} />
        ) : (
          <path d="M51 61 q9 7 18 0" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" />
        )}

        {/* Body */}
        <rect x="50" y="83" width="20" height="6" rx="2" fill="#475569" />
        <rect x="34" y="88" width="52" height="36" rx="12" fill="#818cf8" />
        <circle cx="60" cy="104" r="7" fill="#e0e7ff" />
        <path d="M56 104 l3 3 l5 -6" stroke="#4f46e5" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Arms */}
        <rect x="22" y="92" width="12" height="24" rx="6" fill="#6366f1" />
        <g>
          {waving && (
            <animateTransform attributeName="transform" type="rotate" values="0 92 94; -35 92 94; 0 92 94" dur="0.9s" repeatCount="indefinite" />
          )}
          <rect x="86" y="92" width="12" height="24" rx="6" fill="#6366f1" transform={waving ? "rotate(-150 92 94)" : undefined} />
        </g>
      </g>
    </svg>
  )
}
