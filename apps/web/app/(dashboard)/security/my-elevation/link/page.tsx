"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Copy, Laptop, Link2, Terminal } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLinkDevice, type LinkedDevice } from "@/lib/api/security-elevation"

/**
 * Add a device: install the IdaraOS Agent on your laptop, then link it by entering the code it shows.
 */
export default function LinkDevicePage() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get("code") ?? "")
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState<LinkedDevice | null>(null)
  const [origin, setOrigin] = useState("")
  const link = useLinkDevice()

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const serverUrl = origin || "https://your-idaraos-url"
  const installCommand = [
    `$u = "${serverUrl}"`,
    `$d = Join-Path $env:TEMP "IdaraOS-Agent"`,
    `New-Item $d -ItemType Directory -Force | Out-Null`,
    `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`,
    `Invoke-WebRequest "$u/api/updater/v1/install/agent" -OutFile "$d\\IdaraOS-Agent.ps1" -UseBasicParsing`,
    `Invoke-WebRequest "$u/api/updater/v1/install/installer" -OutFile "$d\\Install-IdaraOSAgent.ps1" -UseBasicParsing`,
    `& "$d\\Install-IdaraOSAgent.ps1" -ServerUrl $u`,
  ].join("\n")

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(installCommand)
      toast.success("Command copied")
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

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
      title="Add a device"
      description="Install the IdaraOS Agent on your laptop, then link it by entering the code it shows."
      icon={Link2}
    >
      <Protected module="security.my-elevation" action="create" showDenied>
        {linked ? (
          <div className="max-w-md space-y-4 rounded-lg border border-green-300 p-6 dark:border-green-900">
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
          <div className="max-w-2xl space-y-6">
            {/* Step 1: install the agent */}
            <div className="space-y-3 rounded-lg border p-6">
              <div className="flex items-start gap-3">
                <Terminal className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <h2 className="font-semibold">1. Install the agent on your laptop</h2>
                  <p className="text-sm text-muted-foreground">
                    On the laptop, open <strong>Windows PowerShell as administrator</strong> (right-click &rarr; Run as
                    administrator), paste this, and press Enter. It downloads the agent and installs it, then shows a
                    code.
                  </p>
                </div>
              </div>
              <div className="relative">
                <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 pr-12 text-xs leading-relaxed">
                  <code className="font-mono">{installCommand}</code>
                </pre>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyCommand}
                  className="absolute right-2 top-2"
                  aria-label="Copy command"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Already installed by IT? Skip to step 2 - the agent shows a fresh code if you run{" "}
                <code className="font-mono">IdaraOS-Agent.ps1 -Pair</code> again.
              </p>
            </div>

            {/* Step 2: enter the code */}
            <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-lg border p-6">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Laptop className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  <strong>2. Link it to you.</strong> Enter the code the agent shows. Only link a code from{" "}
                  <strong>your own</strong> work laptop - the device is linked to your account.
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
          </div>
        )}
      </Protected>
    </PageShell>
  )
}
