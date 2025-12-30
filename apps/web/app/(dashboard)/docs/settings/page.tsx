"use client"

import * as React from "react"
import { Loader2, Save, Settings } from "lucide-react"

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

export default function DocsSettingsPage() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [settings, setSettings] = React.useState({
    defaultReviewFrequencyDays: 365,
    defaultRequirement: "optional" as "optional" | "required" | "required_with_signature",
    enableEmailNotifications: true,
    reminderDaysBefore: 7,
    footerText: "",
    requireApprovalForPublish: false,
    enableVersionSnapshots: true,
  })
  
  const handleSave = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement settings save API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast.success("Settings saved successfully")
    } catch (error) {
      toast.error("Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentation Settings"
        description="Configure default settings for the documentation module."
      >
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </PageHeader>
      
      <div className="grid gap-6 md:grid-cols-2">
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
                value={settings.defaultReviewFrequencyDays}
                onChange={(e) =>
                  setSettings({ ...settings, defaultReviewFrequencyDays: parseInt(e.target.value) || 365 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Documents will be flagged for review after this many days
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="defaultRequirement">Default Rollout Requirement</Label>
              <Select
                value={settings.defaultRequirement}
                onValueChange={(value) =>
                  setSettings({ ...settings, defaultRequirement: value as typeof settings.defaultRequirement })
                }
              >
                <SelectTrigger id="defaultRequirement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optional">Optional</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="required_with_signature">Required with Signature</SelectItem>
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
                  checked={settings.requireApprovalForPublish}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, requireApprovalForPublish: checked })
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
                  checked={settings.enableVersionSnapshots}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableVersionSnapshots: checked })
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
                checked={settings.enableEmailNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enableEmailNotifications: checked })
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reminderDays">Reminder Days Before Due</Label>
              <Input
                id="reminderDays"
                type="number"
                value={settings.reminderDaysBefore}
                onChange={(e) =>
                  setSettings({ ...settings, reminderDaysBefore: parseInt(e.target.value) || 7 })
                }
                disabled={!settings.enableEmailNotifications}
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
                value={settings.footerText}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
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

