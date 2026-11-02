"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Laptop, Link2 } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLinkDevice, type LinkedDevice } from "@/lib/api/security-elevation"

/**
 * Link a device to me by entering the code the IdaraOS Agent shows on it
 */
export default function LinkDevicePage() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get("code") ?? "")
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState<LinkedDevice | null>(null)
  const link = useLinkDevice()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const result = await link.mutateAsync(code)
      setLinked(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link the device")
    }
  }

  return (
    <PageShell
      title="Link a device"
      description="Sign in to the IdaraOS Agent on your laptop by entering the code it shows."
      icon={Link2}
    >
      <Protected module="security.my-elevation" action="create" showDenied>
        <div className="max-w-md">
          {linked ? (
            <div className="space-y-4 rounded-lg border border-green-300 p-6 dark:border-green-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold">{linked.hostname} is linked to you</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The agent on the device finishes signing in within a few seconds. You can now request approved apps for
                it, and IT can keep its software up to date.
              </p>
              <Button asChild>
                <Link href="/security/my-elevation">Go to My Admin Access</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-6">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Laptop className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Only enter a code shown by the IdaraOS Agent on <strong>your own</strong> work laptop. The device will
                  be linked to your account.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="KFJD-7QWX"
                  autoComplete="off"
                  autoFocus
                  className="font-mono text-lg uppercase tracking-widest"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={!code.trim() || link.isPending} className="w-full">
                {link.isPending ? "Linking..." : "Link device"}
              </Button>
            </form>
          )}
        </div>
      </Protected>
    </PageShell>
  )
}
