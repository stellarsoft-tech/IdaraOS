"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Building2, Key, Link2, Palette, ScrollText, Users, Pencil, Save, Loader2, Shield, Globe, Clock, DollarSign, Calendar, ExternalLink, Linkedin, Youtube, Twitter, type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Protected } from "@/components/primitives/protected"
import { useOrganization, useUpdateOrganization } from "@/lib/api/organization"
import { toast } from "sonner"

// Quick links with enhanced design
interface QuickLink {
  title: string
  description: string
  icon: LucideIcon
  href: string
  color: string
  module?: string
}

const quickLinks: QuickLink[] = [
  { title: "Users & Access", description: "Manage team members and invitations", icon: Users, href: "/settings/users", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", module: "settings.users" },
  { title: "Roles & Permissions", description: "Configure roles and access controls", icon: Shield, href: "/settings/roles", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", module: "settings.roles" },
  { title: "Integrations", description: "Connect third-party apps and services", icon: Link2, href: "/settings/integrations", color: "bg-green-500/10 text-green-600 dark:text-green-400", module: "settings.integrations" },
  { title: "Branding", description: "Customize logos, colors, and themes", icon: Palette, href: "/settings/branding", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400", module: "settings.branding" },
  { title: "Audit Log", description: "View system activity and changes", icon: ScrollText, href: "/settings/audit-log", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", module: "settings.auditlog" },
  { title: "API Keys", description: "Manage API tokens for integrations", icon: Key, href: "/settings/api-keys", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400", module: "settings.apikeys" },
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

// Helper function to normalize URLs - add https:// if missing
function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

export default function SettingsPage() {
  const { data: org, isLoading, error } = useOrganization()
  const updateOrg = useUpdateOrganization()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    appName: "",
    tagline: "",
    domain: "",
    linkedIn: "",
    twitter: "",
    youtube: "",
    timezone: "",
    currency: "",
    dateFormat: "",
  })
  const [appNameError, setAppNameError] = useState("")

  // Sync form data when org data loads
  const startEditing = () => {
    if (org) {
      // Strip protocol from domain if present (for display in input)
      const domainValue = org.domain?.replace(/^https?:\/\//, "").replace(/\/$/, "") || ""

      setFormData({
        name: org.name,
        appName: org.appName || "IdaraOS",
        tagline: org.tagline ?? "Company OS",
        domain: domainValue,
        linkedIn: org.linkedIn || "",
        twitter: org.twitter || "",
        youtube: org.youtube || "",
        timezone: org.timezone,
        currency: org.currency,
        dateFormat: org.dateFormat,
      })
      setAppNameError("")
      setIsEditing(true)
    }
  }

  const validateAppName = (value: string): boolean => {
    if (value.trim().length < 3) {
      setAppNameError("Application name must be at least 3 characters")
      return false
    }
    setAppNameError("")
    return true
  }

  const handleSave = async () => {
    if (!validateAppName(formData.appName)) return
    
    try {
      // Domain: strip protocol if present, store just the domain name
      let domainValue = formData.domain?.trim() || null
      if (domainValue) {
        domainValue = domainValue.replace(/^https?:\/\//, "").replace(/\/$/, "")
      }

      await updateOrg.mutateAsync({
        name: formData.name,
        appName: formData.appName.trim(),
        tagline: formData.tagline.trim() || null,
        domain: domainValue,
        linkedIn: normalizeUrl(formData.linkedIn) || null,
        twitter: normalizeUrl(formData.twitter) || null,
        youtube: normalizeUrl(formData.youtube) || null,
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
    setAppNameError("")
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden py-0">
        <div className="bg-muted/30 dark:bg-muted/20 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted dark:bg-muted/50 border flex items-center justify-center">
                <Building2 className="h-6 w-5 text-foreground/70" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none">Organization Profile</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure your organization&apos;s identity and preferences
                </p>
              </div>
            </div>
            <Protected module="settings.organization" action="edit">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={updateOrg.isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateOrg.isPending}>
                    {updateOrg.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
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
        </div>
        <CardContent className="p-5 pt-0">
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
            <div className="space-y-5">
              {/* Organization Identity */}
              <div className="flex items-start gap-4 pb-5 border-b">
                <div className="h-16 w-16 rounded-xl bg-muted/50 dark:bg-muted/30 flex items-center justify-center border shadow-sm shrink-0">
                  <Building2 className="h-8 w-8 text-foreground/60" />
                </div>
                <div className="flex-1 pt-0.5">
                  <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Organization Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter organization name"
                    className="mt-1.5 text-lg font-medium"
                  />
                </div>
              </div>

              {/* App Settings */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="appName" className="text-sm font-medium">
                    Application Name
                  </Label>
                  <Input
                    id="appName"
                    value={formData.appName}
                    onChange={(e) => {
                      setFormData({ ...formData, appName: e.target.value })
                      if (appNameError) validateAppName(e.target.value)
                    }}
                    placeholder="e.g., MyCompany OS"
                    className={appNameError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {appNameError ? (
                    <p className="text-xs text-destructive">{appNameError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Displayed in the header and login page
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline" className="text-sm font-medium">
                    Tagline / Subtitle
                  </Label>
                  <Input
                    id="tagline"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    placeholder="e.g., Company OS (leave empty to hide)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown below the app name. Leave empty to hide.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain" className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    Website
                  </Label>
                  <Input
                    id="domain"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="example.com"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="pt-2">
                <h4 className="text-sm font-medium mb-3">Social & Professional Links</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="linkedIn" className="text-sm text-muted-foreground flex items-center gap-2">
                      <Linkedin className="h-3.5 w-3.5" />
                      LinkedIn
                    </Label>
                    <Input
                      id="linkedIn"
                      value={formData.linkedIn}
                      onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                      placeholder="https://linkedin.com/company/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter" className="text-sm text-muted-foreground flex items-center gap-2">
                      <Twitter className="h-3.5 w-3.5" />
                      X / Twitter
                    </Label>
                    <Input
                      id="twitter"
                      value={formData.twitter}
                      onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                      placeholder="https://x.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtube" className="text-sm text-muted-foreground flex items-center gap-2">
                      <Youtube className="h-3.5 w-3.5" />
                      YouTube
                    </Label>
                    <Input
                      id="youtube"
                      value={formData.youtube}
                      onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                      placeholder="https://youtube.com/@..."
                    />
                  </div>
                </div>
              </div>

              {/* Regional Settings */}
              <div>
                <h4 className="text-sm font-medium mb-3">Regional Settings</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Timezone
                    </Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                    >
                      <SelectTrigger className="w-full">
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
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5" />
                      Currency
                    </Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger className="w-full">
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
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      Date Format
                    </Label>
                    <Select
                      value={formData.dateFormat}
                      onValueChange={(value) => setFormData({ ...formData, dateFormat: value })}
                    >
                      <SelectTrigger className="w-full">
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
            </div>
          ) : (
            <div className="space-y-5">
              {/* Organization Identity */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-xl bg-muted/50 dark:bg-muted/30 flex items-center justify-center border shadow-sm shrink-0">
                  <Building2 className="h-8 w-8 text-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg font-semibold">{org?.name}</h3>
                    <Badge variant="outline" className="text-xs font-normal">
                      {org?.appName || "IdaraOS"}
                    </Badge>
                  </div>
                  
                  {/* Links Section */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                    {org?.domain && (
                      <a 
                        href={normalizeUrl(org.domain) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 group"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span className="group-hover:underline">{org.domain}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {org?.linkedIn && (
                      <a 
                        href={normalizeUrl(org.linkedIn) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 group"
                      >
                        <Linkedin className="h-3.5 w-3.5" />
                        <span className="group-hover:underline">LinkedIn</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {org?.twitter && (
                      <a 
                        href={normalizeUrl(org.twitter) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 group"
                      >
                        <Twitter className="h-3.5 w-3.5" />
                        <span className="group-hover:underline">X / Twitter</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {org?.youtube && (
                      <a 
                        href={normalizeUrl(org.youtube) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 group"
                      >
                        <Youtube className="h-3.5 w-3.5" />
                        <span className="group-hover:underline">YouTube</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {!org?.domain && !org?.linkedIn && !org?.twitter && !org?.youtube && (
                      <span className="text-sm text-muted-foreground">No links configured</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Settings Grid */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/30 dark:bg-muted/20 border hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-md bg-background border flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timezone</p>
                    <p className="font-medium text-sm mt-0.5">
                      {timezones.find((tz) => tz.value === org?.timezone)?.label || org?.timezone}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/30 dark:bg-muted/20 border hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-md bg-background border flex items-center justify-center shrink-0">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currency</p>
                    <p className="font-medium text-sm mt-0.5">
                      {currencies.find((c) => c.value === org?.currency)?.label || org?.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/30 dark:bg-muted/20 border hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-md bg-background border flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Format</p>
                    <p className="font-medium text-sm mt-0.5">
                      {dateFormats.find((df) => df.value === org?.dateFormat)?.label || org?.dateFormat}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links - Card Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Access</h2>
          <p className="text-sm text-muted-foreground">Navigate to other settings</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex flex-col p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className={`h-10 w-10 rounded-lg ${item.color} flex items-center justify-center`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
              <div className="mt-3">
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
