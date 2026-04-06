"use client"

import * as React from "react"
import { Database, FolderSync, HardDrive, Loader2, Save, Settings } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useDocsSettings, useUpdateDocsSettings } from "@/lib/api/docs"
import { useFileCategoriesList } from "@/lib/api/file-categories"

export default function DocsSettingsPage() {
  const { data: settingsData, isLoading: settingsLoading } = useDocsSettings()
  const updateSettings = useUpdateDocsSettings()
  const { data: categoriesData } = useFileCategoriesList({ moduleScope: "docs" })

  const settings = settingsData?.data
  const docsCategories = categoriesData ?? []

  const [form, setForm] = React.useState({
    contentStorageMode: "database" as "database" | "filing" | "hybrid",
    defaultFileCategoryId: null as string | null,
    defaultReviewFrequencyDays: 365,
    defaultRequirement: "optional" as string,
    enableEmailNotifications: true,
    reminderDaysBefore: 7,
    footerText: "",
    requireApprovalForPublish: false,
    enableVersionSnapshots: true,
  })

  React.useEffect(() => {
    if (settings) {
      const s = settings.settings as Record<string, unknown> | null
      setForm({
        contentStorageMode: settings.contentStorageMode || "database",
        defaultFileCategoryId: settings.defaultFileCategoryId,
        defaultReviewFrequencyDays: settings.defaultReviewFrequencyDays ?? 365,
        defaultRequirement: settings.defaultRequirement ?? "optional",
        enableEmailNotifications: settings.enableEmailNotifications,
        reminderDaysBefore: settings.reminderDaysBefore ?? 7,
        footerText: settings.footerText ?? "",
        requireApprovalForPublish: (s?.requireApprovalForPublish as boolean) ?? false,
        enableVersionSnapshots: (s?.enableVersionSnapshots as boolean) ?? true,
      })
    }
  }, [settings])

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        contentStorageMode: form.contentStorageMode,
        defaultFileCategoryId: form.defaultFileCategoryId,
        defaultReviewFrequencyDays: form.defaultReviewFrequencyDays,
        defaultRequirement: form.defaultRequirement,
        enableEmailNotifications: form.enableEmailNotifications,
        reminderDaysBefore: form.reminderDaysBefore,
        footerText: form.footerText || null,
        settings: {
          requireApprovalForPublish: form.requireApprovalForPublish,
          enableVersionSnapshots: form.enableVersionSnapshots,
        },
      })
      toast.success("Settings saved successfully")
    } catch {
      toast.error("Failed to save settings")
    }
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentation Settings"
        description="Configure default settings for the documentation module."
      >
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Content Storage */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Content Storage
            </CardTitle>
            <CardDescription>
              Choose where document content (MDX) is persisted. This applies to
              all new and existing documents unless overridden per-document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Storage Mode</Label>
              <Select
                value={form.contentStorageMode}
                onValueChange={(v) =>
                  setForm({ ...form, contentStorageMode: v as typeof form.contentStorageMode })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="database">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Database (default)
                    </div>
                  </SelectItem>
                  <SelectItem value="filing">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      Filing Module (external storage)
                    </div>
                  </SelectItem>
                  <SelectItem value="hybrid">
                    <div className="flex items-center gap-2">
                      <FolderSync className="h-4 w-4" />
                      Hybrid (database + filing sync)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.contentStorageMode === "database" &&
                  "Content is stored directly in the database. Simple, reliable, no external dependencies."}
                {form.contentStorageMode === "filing" &&
                  "Content is stored in your configured filing system (e.g., SharePoint, Azure Blob). IdaraOS manages metadata only."}
                {form.contentStorageMode === "hybrid" &&
                  "Content is stored in the database for fast access and synced to your filing system for external browsing/backup."}
              </p>
            </div>

            {(form.contentStorageMode === "filing" || form.contentStorageMode === "hybrid") && (
              <div className="space-y-2">
                <Label>File Category</Label>
                {docsCategories.length > 0 ? (
                  <Select
                    value={form.defaultFileCategoryId ?? ""}
                    onValueChange={(v) =>
                      setForm({ ...form, defaultFileCategoryId: v || null })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a file category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {docsCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No file categories configured for the docs module.{" "}
                    <Link href="/filing/categories" className="text-primary underline">
                      Create one in Filing &gt; Categories
                    </Link>{" "}
                    with module scope set to &quot;Docs&quot;.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  The file category determines which storage integration and folder documents are saved to.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Default Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Default Settings
            </CardTitle>
            <CardDescription>
              Configure default values for new documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reviewFrequency">Default Review Frequency (days)</Label>
              <Input
                id="reviewFrequency"
                type="number"
                value={form.defaultReviewFrequencyDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultReviewFrequencyDays: parseInt(e.target.value) || 365,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Documents will be flagged for review after this many days
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultRequirement">Default Rollout Requirement</Label>
              <Select
                value={form.defaultRequirement}
                onValueChange={(value) =>
                  setForm({ ...form, defaultRequirement: value })
                }
              >
                <SelectTrigger id="defaultRequirement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optional">Optional</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="required_with_signature">
                    Required with Signature
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Approval for Publishing</Label>
                  <p className="text-xs text-muted-foreground">
                    Documents must be approved before publishing
                  </p>
                </div>
                <Switch
                  checked={form.requireApprovalForPublish}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, requireApprovalForPublish: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Version Snapshots</Label>
                  <p className="text-xs text-muted-foreground">
                    Store content snapshots for each version
                  </p>
                </div>
                <Switch
                  checked={form.enableVersionSnapshots}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, enableVersionSnapshots: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>
              Configure how users are notified about documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send email notifications for document rollouts
                </p>
              </div>
              <Switch
                checked={form.enableEmailNotifications}
                onCheckedChange={(checked) =>
                  setForm({ ...form, enableEmailNotifications: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminderDays">Reminder Days Before Due</Label>
              <Input
                id="reminderDays"
                type="number"
                value={form.reminderDaysBefore}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reminderDaysBefore: parseInt(e.target.value) || 7,
                  })
                }
                disabled={!form.enableEmailNotifications}
              />
              <p className="text-xs text-muted-foreground">
                Send reminder this many days before the due date
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              Customize the appearance of documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="footerText">Document Footer Text</Label>
              <Textarea
                id="footerText"
                value={form.footerText}
                onChange={(e) =>
                  setForm({ ...form, footerText: e.target.value })
                }
                placeholder="e.g., Confidential - For internal use only. © 2024 Your Company."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This text will appear at the bottom of all documents
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
