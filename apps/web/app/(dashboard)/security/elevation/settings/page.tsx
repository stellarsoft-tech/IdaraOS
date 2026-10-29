"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Settings } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useElevationSettings,
  useUpdateElevationSettings,
  type ElevationSettingsUpdate,
} from "@/lib/api/security-elevation"
import { usePermission } from "@/lib/rbac/context"
import { formatMinutes } from "@/lib/security/elevation"

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240, 480]

interface FormState {
  durationOptions: number[]
  maxMinutes: number
  requireReason: boolean
  credentialModeEnabled: boolean
  requireRecentAuth: boolean
  recentAuthMinutes: number
  maxRevealsPerGrant: number
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

export default function ElevationSettingsPage() {
  const { data, isLoading } = useElevationSettings()
  const update = useUpdateElevationSettings()
  const canEdit = usePermission("security.elevation-settings", "edit")
  const settings = data?.data

  const [form, setForm] = useState<FormState | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")

  useEffect(() => {
    if (settings) {
      setForm({
        durationOptions: settings.durationOptions,
        maxMinutes: settings.maxMinutes,
        requireReason: settings.requireReason,
        credentialModeEnabled: settings.credentialModeEnabled,
        requireRecentAuth: settings.requireRecentAuth,
        recentAuthMinutes: settings.recentAuthMinutes,
        maxRevealsPerGrant: settings.maxRevealsPerGrant,
      })
    }
  }, [settings])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const toggleDuration = (minutes: number, checked: boolean) => {
    if (!form) return
    const next = checked
      ? [...form.durationOptions, minutes]
      : form.durationOptions.filter((m) => m !== minutes)
    set("durationOptions", [...new Set(next)].sort((a, b) => a - b))
  }

  const save = async (patch: ElevationSettingsUpdate, message = "Settings saved") => {
    try {
      await update.mutateAsync(patch)
      toast.success(message)
      setWebhookUrl("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    }
  }

  return (
    <PageShell
      title="Admin Access Settings"
      description="Control how long admin access can last and how it's given."
      icon={Settings}
      backButton={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/security/elevation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Approvals
          </Link>
        </Button>
      }
    >
      {isLoading || !form ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="max-w-2xl space-y-8">
          <section className="space-y-4 rounded-lg border p-5">
            <h2 className="font-semibold">Durations</h2>
            <div className="space-y-2">
              <Label>Options requesters can pick</Label>
              <div className="flex flex-wrap gap-4">
                {DURATION_PRESETS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.durationOptions.includes(m)}
                      onCheckedChange={(v) => toggleDuration(m, v === true)}
                      disabled={!canEdit || m > form.maxMinutes}
                    />
                    {formatMinutes(m)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-minutes">Maximum duration (minutes)</Label>
              <Input
                id="max-minutes"
                type="number"
                min={5}
                max={1440}
                value={form.maxMinutes}
                onChange={(e) => set("maxMinutes", Number(e.target.value))}
                disabled={!canEdit}
                className="w-40"
              />
            </div>
            <SwitchRow
              id="require-reason"
              label="Require a reason"
              description="Requesters must explain why they need admin access."
              checked={form.requireReason}
              onCheckedChange={(v) => set("requireReason", v)}
              disabled={!canEdit}
            />
          </section>

          <section className="space-y-4 rounded-lg border p-5">
            <h2 className="font-semibold">Credential mode (LAPS)</h2>
            <SwitchRow
              id="credential-mode"
              label="Allow revealing the LAPS password"
              description="Approvers with the credentials permission can give the requester the device's local admin password."
              checked={form.credentialModeEnabled}
              onCheckedChange={(v) => set("credentialModeEnabled", v)}
              disabled={!canEdit}
            />
            <SwitchRow
              id="recent-auth"
              label="Require a fresh Microsoft sign-in to reveal"
              description="The requester signs in again if their last sign-in is older than the window below."
              checked={form.requireRecentAuth}
              onCheckedChange={(v) => set("requireRecentAuth", v)}
              disabled={!canEdit}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recent-auth-minutes">Sign-in window (minutes)</Label>
                <Input
                  id="recent-auth-minutes"
                  type="number"
                  min={1}
                  max={120}
                  value={form.recentAuthMinutes}
                  onChange={(e) => set("recentAuthMinutes", Number(e.target.value))}
                  disabled={!canEdit || !form.requireRecentAuth}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-reveals">Reveals allowed per grant</Label>
                <Input
                  id="max-reveals"
                  type="number"
                  min={1}
                  max={20}
                  value={form.maxRevealsPerGrant}
                  onChange={(e) => set("maxRevealsPerGrant", Number(e.target.value))}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </section>

          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => save(form)} disabled={update.isPending}>
                {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save settings
              </Button>
            </div>
          )}

          <section className="space-y-4 rounded-lg border p-5">
            <div className="space-y-1">
              <h2 className="font-semibold">Teams notifications</h2>
              <p className="text-sm text-muted-foreground">
                Post new requests to a Teams channel. In Teams, add the Workflows template &quot;Post to a channel
                when a webhook request is received&quot; and paste its URL here.
              </p>
            </div>
            <p className="text-sm">
              Status: {settings?.teamsWebhookConfigured ? "Configured" : "Not configured"}
            </p>
            {canEdit && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="url"
                  placeholder={settings?.teamsWebhookConfigured ? "Paste a new URL to replace it" : "https://…"}
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => save({ teamsWebhookUrl: webhookUrl.trim() }, "Webhook saved")}
                  disabled={!webhookUrl.trim() || update.isPending}
                >
                  Save webhook
                </Button>
                {settings?.teamsWebhookConfigured && (
                  <Button
                    variant="ghost"
                    onClick={() => save({ teamsWebhookUrl: null }, "Webhook removed")}
                    disabled={update.isPending}
                  >
                    Remove
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  )
}
