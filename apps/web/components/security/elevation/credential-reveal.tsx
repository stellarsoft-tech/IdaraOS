"use client"

import { useEffect, useState } from "react"
import { Copy, Eye, EyeOff, KeyRound, Loader2, LogIn } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ElevationApiError, useRevealCredential, type RevealedCredential } from "@/lib/api/security-elevation"

// Hide the password from the screen after this long
const AUTO_HIDE_MS = 60_000

interface CredentialRevealProps {
  grantId: string
  revealCount: number
  maxReveals: number
}

/**
 * Reveals the device's LAPS password for an active credentials grant.
 * The password lives only in component state and is cleared after a minute.
 */
export function CredentialReveal({ grantId, revealCount, maxReveals }: CredentialRevealProps) {
  const reveal = useRevealCredential()
  const [credential, setCredential] = useState<RevealedCredential | null>(null)
  const [visible, setVisible] = useState(false)
  const [reauthUrl, setReauthUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!credential) return
    const timer = setTimeout(() => {
      setCredential(null)
      setVisible(false)
    }, AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [credential])

  const remaining = Math.max(0, maxReveals - revealCount)

  const handleReveal = async () => {
    setReauthUrl(null)
    try {
      const result = await reveal.mutateAsync(grantId)
      setCredential(result.data)
      setVisible(false)
    } catch (error) {
      if (error instanceof ElevationApiError && error.code === "reauth_required" && error.reauthUrl) {
        setReauthUrl(error.reauthUrl)
        return
      }
      toast.error(error instanceof Error ? error.message : "Failed to reveal the password")
    }
  }

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  if (credential) {
    return (
      <div className="space-y-3 rounded-md border bg-muted/40 p-3">
        <div className="grid gap-2 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <span className="text-muted-foreground">Username</span>
          <code className="truncate font-mono">{credential.accountName}</code>
          <Button variant="ghost" size="sm" onClick={() => copy(credential.accountName, "Username")}>
            <Copy className="h-4 w-4" />
          </Button>

          <span className="text-muted-foreground">Password</span>
          <code className="truncate font-mono">{visible ? credential.password : "•".repeat(14)}</code>
          <div className="flex">
            <Button variant="ghost" size="sm" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"}>
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => copy(credential.password, "Password")} aria-label="Copy password">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Use these at the Windows admin prompt (UAC). The password is hidden from this page after a minute and
          changed automatically when your access ends.
        </p>
      </div>
    )
  }

  if (reauthUrl) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-900/10 sm:flex-row sm:items-center sm:justify-between">
        <span>For security, sign in with Microsoft again before revealing the password.</span>
        <Button asChild size="sm">
          <a href={reauthUrl}>
            <LogIn className="mr-2 h-4 w-4" />
            Sign in again
          </a>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={handleReveal} disabled={reveal.isPending || remaining === 0}>
        {reveal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
        Reveal admin password
      </Button>
      <span className="text-xs text-muted-foreground">
        {remaining === 0 ? "Reveal limit reached" : `${remaining} reveal${remaining === 1 ? "" : "s"} left`}
      </span>
    </div>
  )
}
