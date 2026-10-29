"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface GrantCountdownProps {
  expiresAt: string
  /** Called once when the countdown reaches zero */
  onExpire?: () => void
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/**
 * Live time-left indicator for an active grant (amber in the last 5 minutes)
 */
export function GrantCountdown({ expiresAt, onExpire }: GrantCountdownProps) {
  const target = new Date(expiresAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  const remaining = target - now

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.()
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0])

  const ending = remaining > 0 && remaining <= 5 * 60_000
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm tabular-nums ${
        remaining <= 0 ? "text-muted-foreground" : ending ? "text-amber-600 dark:text-amber-400" : ""
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {remaining <= 0 ? "Ended" : `${formatRemaining(remaining)} left`}
    </span>
  )
}
