"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Building2, Key, Link2, Palette, ScrollText, Users, Pencil, Save, Loader2 } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { useOrganization, useUpdateOrganization } from "@/lib/api/organization"
import { toast } from "sonner"

const settingsGroups = [
  {
    title: "Access & Security",
    items: [
      { title: "Users & Access", description: "Manage users and permissions", icon: Users, href: "/settings/users" },
      { title: "Audit Log", description: "View system activity logs", icon: ScrollText, href: "/settings/audit-log" },
    ],
  },
  {
    title: "Customization",
    items: [
      {
        title: "Branding",
        description: "Colors, themes, and customization",
        icon: Palette,
        href: "/settings/branding",
      },
    ],
  },
  {
    title: "Integrations",
    items: [
      {
        title: "Integrations",
        description: "Connect third-party services",
        icon: Link2,
        href: "/settings/integrations",
      },
      { title: "API Keys", description: "Manage API access tokens", icon: Key, href: "/settings/api-keys" },
    ],
  },
]

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
]

const currencies = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
]

const dateFormats = [
  { value: "YYYY-MM-DD", label: "2024-12-31 (ISO)" },
  { value: "MM/DD/YYYY", label: "12/31/2024 (US)" },
  { value: "DD/MM/YYYY", label: "31/12/2024 (UK/EU)" },
  { value: "DD MMM YYYY", label: "31 Dec 2024" },
]

export default function SettingsPage() {
  const canAccess = useCanAccess("settings.organization")
  const { data: org, isLoading, error } = useOrganization()
  const updateOrg = useUpdateOrganization()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    timezone: "",
    currency: "",
    dateFormat: "",
  })

  // Sync form data when org data loads
  const startEditing = () => {
    if (org) {
      setFormData({
        name: org.name,
        domain: org.domain || "",
        timezone: org.timezone,
        currency: org.currency,
        dateFormat: org.dateFormat,
      })
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    try {
      await updateOrg.mutateAsync({
        name: formData.name,
        domain: formData.domain || null,
        timezone: formData.timezone,
        currency: formData.currency,
        dateFormat: formData.dateFormat,
      })
      toast.success("Organization settings updated")
      setIsEditing(false)
    } catch {
      toast.error("Failed to update organization settings")
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  return (
    <PageShell
      title="Settings"
      description="Manage your organization settings and preferences."
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <CardTitle>Organization Profile</CardTitle>
            </div>
            <Protected module="settings.organization" action="edit">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateOrg.isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateOrg.isPending}>
                    {updateOrg.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </Protected>
          </div>
          <CardDescription>Configure your organization&apos;s basic settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Failed to load organization settings</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter organization name"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="example.com"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your organization&apos;s primary domain for SSO and email verification
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date Format</Label>
                  <Select
                    value={formData.dateFormat}
                    onValueChange={(value) => setFormData({ ...formData, dateFormat: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {dateFormats.map((df) => (
                        <SelectItem key={df.value} value={df.value}>
                          {df.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{org?.name}</p>
                  <p className="text-sm text-muted-foreground">{org?.domain || "No domain configured"}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Timezone</p>
                  <p className="font-medium">
                    {timezones.find((tz) => tz.value === org?.timezone)?.label || org?.timezone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Currency</p>
                  <p className="font-medium">
                    {currencies.find((c) => c.value === org?.currency)?.label || org?.currency}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date Format</p>
                  <p className="font-medium">
                    {dateFormats.find((df) => df.value === org?.dateFormat)?.label || org?.dateFormat}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {settingsGroups.map((group) => (
        <div key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => (
              <Card key={item.href} className="hover:border-primary/50 transition-colors">
                <Link href={item.href}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <item.icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </PageShell>
  )
}
