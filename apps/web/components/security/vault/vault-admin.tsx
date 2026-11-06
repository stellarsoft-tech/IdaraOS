"use client"

import { useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePermission } from "@/lib/rbac/context"
import {
  useUpdateVaultPolicy,
  useVaultCompliance,
  useVaultPolicy,
  type VaultEnforcement,
  type VaultPolicyInput,
} from "@/lib/api/security-vault-admin"

interface PolicyForm {
  minLength: number
  requireUpper: boolean
  requireLower: boolean
  requireDigit: boolean
  requireSymbol: boolean
  noReuse: boolean
  maxAgeDays: number
  enforcement: VaultEnforcement
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  const color = value === 0 ? "" : tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : ""
  return (
    <div className="rounded-lg border p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function VaultAdmin() {
  const canEdit = usePermission("security.vault", "edit")
  const policyQuery = useVaultPolicy()
  const compliance = useVaultCompliance()
  const updatePolicy = useUpdateVaultPolicy()

  const [form, setForm] = useState<PolicyForm | null>(null)

  useEffect(() => {
    const p = policyQuery.data?.data
    if (p && !form) {
      setForm({
        minLength: p.minLength,
        requireUpper: p.requireUpper,
        requireLower: p.requireLower,
        requireDigit: p.requireDigit,
        requireSymbol: p.requireSymbol,
        noReuse: p.noReuse,
        maxAgeDays: p.maxAgeDays,
        enforcement: p.enforcement,
      })
    }
  }, [policyQuery.data, form])

  const save = async () => {
    if (!form) return
    try {
      await updatePolicy.mutateAsync(form as VaultPolicyInput)
      toast.success("Policy saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the policy")
    }
  }

  const summary = compliance.data?.data

  return (
    <PageShell
      title="Vault Administration"
      icon={ShieldCheck}
      description="Set the organisation's password policy and review the vault Security Audit."
    >
      {/* Policy editor */}
      <div className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Password policy</h2>
        {!form ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="minLength">Minimum length</Label>
                <Input
                  id="minLength"
                  type="number"
                  min={8}
                  max={128}
                  value={form.minLength}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => (f ? { ...f, minLength: Math.max(8, Math.min(128, Number(e.target.value) || f.minLength)) } : f))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxAgeDays">Maximum age (days, 0 = no limit)</Label>
                <Input
                  id="maxAgeDays"
                  type="number"
                  min={0}
                  max={3650}
                  value={form.maxAgeDays}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => (f ? { ...f, maxAgeDays: Math.max(0, Math.min(3650, Number(e.target.value) || 0)) } : f))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["requireUpper", "Require an uppercase letter"],
                  ["requireLower", "Require a lowercase letter"],
                  ["requireDigit", "Require a number"],
                  ["requireSymbol", "Require a symbol"],
                  ["noReuse", "No reuse — every credential must be unique"],
                ] as [keyof PolicyForm, string][]
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <span>{label}</span>
                  <Switch
                    checked={form[key] as boolean}
                    disabled={!canEdit}
                    onCheckedChange={(v) => setForm((f) => (f ? { ...f, [key]: v } : f))}
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <Label>Enforcement</Label>
                <Select
                  value={form.enforcement}
                  disabled={!canEdit}
                  onValueChange={(v) => setForm((f) => (f ? { ...f, enforcement: v as VaultEnforcement } : f))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off — don&apos;t check</SelectItem>
                    <SelectItem value="warn">Warn — allow but count violations</SelectItem>
                    <SelectItem value="block">Block — reject on save</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canEdit && (
                <Button onClick={save} disabled={updatePolicy.isPending}>
                  {updatePolicy.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Save policy
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Security Audit */}
      <div className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Security Audit</h2>
        {compliance.isLoading || !summary ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Weak passwords" value={summary.totals.weak} tone="bad" />
              <StatCard label="Reused passwords" value={summary.totals.reused} tone="bad" />
              <StatCard label={summary.maxAgeDays > 0 ? `Older than ${summary.maxAgeDays}d` : "Old passwords"} value={summary.totals.old} tone="warn" />
              <StatCard label="People with a vault" value={summary.totals.users} />
            </div>
            {summary.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one has saved any passwords in the vault yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Weak</TableHead>
                    <TableHead className="text-right">Reused</TableHead>
                    <TableHead className="text-right">Old</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rows.map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell>
                        <div className="font-medium">{r.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">
                        {r.weak > 0 ? <Badge variant="outline" className="border-red-400 text-red-600">{r.weak}</Badge> : "0"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.reused > 0 ? <Badge variant="outline" className="border-red-400 text-red-600">{r.reused}</Badge> : "0"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.old > 0 ? <Badge variant="outline" className="border-amber-400 text-amber-600">{r.old}</Badge> : "0"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>
    </PageShell>
  )
}
