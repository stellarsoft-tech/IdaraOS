"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  AlertTriangle,
  Check, 
  ChevronRight, 
  Loader2, 
  RefreshCw, 
  Settings, 
  Users, 
  Link2,
  Link2Off,
  Info,
  Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkflowTemplatesList } from "@/lib/api/workflows"

// Types
interface PeopleSettings {
  syncMode: "linked" | "independent"
  peopleGroupPattern: string | null
  propertyMapping: Record<string, string> | null
  autoDeleteOnRemoval: boolean
  defaultStatus: string
  scimEnabled: boolean
  lastSyncAt: string | null
  syncedPeopleCount: string
  lastSyncError: string | null
  entraConnected: boolean
  coreScimEnabled: boolean
  syncPeopleEnabledInCore: boolean
  deletePeopleOnUserDeleteInCore: boolean
  // Workflow settings
  autoOnboardingWorkflow: boolean
  defaultOnboardingWorkflowTemplateId: string | null
  autoOffboardingWorkflow: boolean
  defaultOffboardingWorkflowTemplateId: string | null
}

// Custom hook for people settings
function usePeopleSettings() {
  const [data, setData] = useState<PeopleSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/people/settings")
      if (!response.ok) {
        throw new Error("Failed to fetch settings")
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const refetch = () => {
    setIsLoading(true)
    fetchSettings()
  }

  return { data, isLoading, error, refetch }
}

export default function PeopleSettingsPage() {
  const router = useRouter()
  const canAccess = useCanAccess("people.directory")
  const canEdit = usePermission("people.directory", "edit")
  
  const { data: settings, isLoading, refetch } = usePeopleSettings()
  
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isUpdatingLinked, setIsUpdatingLinked] = useState(false)
  
  // Form state
  const [syncMode, setSyncMode] = useState<"linked" | "independent">("linked")
  const [groupPattern, setGroupPattern] = useState("")
  const [autoDelete, setAutoDelete] = useState(false)
  const [scimEnabled, setScimEnabled] = useState(false)
  
  // Linked mode state (synced with core integrations)
  const [syncPeopleEnabled, setSyncPeopleEnabled] = useState(false)
  const [deletePeopleOnUserDelete, setDeletePeopleOnUserDelete] = useState(true)

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setSyncMode(settings.syncMode)
      setGroupPattern(settings.peopleGroupPattern || "")
      setAutoDelete(settings.autoDeleteOnRemoval)
      setScimEnabled(settings.scimEnabled)
      // Linked mode settings from core integrations
      setSyncPeopleEnabled(settings.syncPeopleEnabledInCore)
      setDeletePeopleOnUserDelete(settings.deletePeopleOnUserDeleteInCore ?? true)
    }
  }, [settings])
  
  // Update linked mode settings in core integrations
  const handleUpdateLinkedSetting = async (field: string, value: boolean) => {
    setIsUpdatingLinked(true)
    try {
      const response = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "entra",
          [field]: value,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update setting")
      }

      // Update local state
      if (field === "syncPeopleEnabled") {
        setSyncPeopleEnabled(value)
        toast.success(value ? "People sync enabled" : "People sync disabled")
      } else if (field === "deletePeopleOnUserDelete") {
        setDeletePeopleOnUserDelete(value)
        toast.success(value ? "People will be deleted with users" : "People will be kept when users are deleted")
      }
      
      refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update setting")
    } finally {
      setIsUpdatingLinked(false)
    }
  }

  const handleSave = async () => {
    if (syncMode === "independent" && !groupPattern.trim()) {
      toast.error("Please enter a group pattern for independent sync")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/people/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncMode,
          peopleGroupPattern: groupPattern.trim() || null,
          autoDeleteOnRemoval: autoDelete,
          scimEnabled,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save settings")
      }

      const result = await response.json()
      toast.success(result.message || "Settings saved successfully")
      refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      let response
      let result
      
      if (syncMode === "linked") {
        // In linked mode, trigger the main user sync which includes people
        response = await fetch("/api/settings/integrations/entra/sync", {
          method: "POST",
        })
        result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.error || "Sync failed")
        }
        
        const stats = result.stats
        const peopleInfo = stats?.peopleCreated > 0 || stats?.peopleDeleted > 0 
          ? ` • People: +${stats.peopleCreated || 0}/-${stats.peopleDeleted || 0}`
          : ""
        toast.success(`Sync completed! Users: +${stats?.usersCreated || 0}${peopleInfo}`)
      } else {
        // In independent mode, trigger people-specific sync
        response = await fetch("/api/people/settings/sync", {
          method: "POST",
        })
        result = await response.json()
        
        if (!response.ok) {
          if (result.redirectTo) {
            toast.info(result.error)
            router.push(result.redirectTo)
            return
          }
          throw new Error(result.error || "Sync failed")
        }
        
        toast.success(result.message || "Sync completed successfully")
      }
      
      refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed")
    } finally {
      setIsSyncing(false)
    }
  }

  if (!canAccess) {
    return <AccessDenied title="Access Denied" description="You don't have permission to access People Settings." />
  }

  if (isLoading) {
    return (
      <PageShell
        title="People Settings"
        description="Configure People & HR module settings"
      >
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    )
  }

  const isEntraConnected = settings?.entraConnected ?? false
  const isCoreScimEnabled = settings?.coreScimEnabled ?? false
  const hasUnsavedChanges = 
    syncMode !== settings?.syncMode ||
    groupPattern !== (settings?.peopleGroupPattern || "") ||
    autoDelete !== settings?.autoDeleteOnRemoval ||
    scimEnabled !== settings?.scimEnabled

  return (
    <PageShell
      title="People Settings"
      description="Configure People & HR module settings including Entra sync"
      action={
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleSave} 
            disabled={!canEdit || isSaving || !hasUnsavedChanges}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
          {isEntraConnected && (
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={isSyncing || hasUnsavedChanges || (syncMode === "independent" && !groupPattern.trim()) || (syncMode === "linked" && !syncPeopleEnabled)}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Entra Sync Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Entra ID Sync</CardTitle>
                <CardDescription>
                  Configure how People records are synced from Microsoft Entra ID
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEntraConnected ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Entra ID Not Connected</AlertTitle>
                <AlertDescription>
                  Configure Microsoft Entra ID in Settings {">"} Integrations first to enable sync features.
                  <Button
                    variant="link"
                    className="px-0 h-auto ml-2"
                    onClick={() => router.push("/settings/integrations")}
                  >
                    Go to Integrations
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Sync Mode Selection */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Sync Mode</Label>
                  <RadioGroup
                    value={syncMode}
                    onValueChange={(value) => setSyncMode(value as "linked" | "independent")}
                    disabled={!canEdit}
                  >
                    <div className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors ${syncMode === "linked" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                      <RadioGroupItem value="linked" id="linked" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="linked" className="font-medium cursor-pointer">
                            Linked to User Sync
                          </Label>
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          People records are created when users are synced from Entra ID. 
                          Uses the same groups configured in Settings {">"} Integrations.
                        </p>
                      </div>
                    </div>

                    <div className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors ${syncMode === "independent" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                      <RadioGroupItem value="independent" id="independent" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="independent" className="font-medium cursor-pointer">
                            Independent People Sync
                          </Label>
                          <Link2Off className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Sync People from different Entra groups. 
                          Useful when employees differ from system users.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Linked Mode Settings */}
                {syncMode === "linked" && (
                  <>
                    <Separator />
                    
                    <div className="space-y-4">
                      <Label className="text-base font-semibold">Linked Sync Options</Label>
                      
                      {/* Enable People Sync */}
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">Create People Records</div>
                          <div className="text-xs text-muted-foreground">
                            Automatically create People records when users are synced from Entra ID
                          </div>
                        </div>
                        <Switch 
                          checked={syncPeopleEnabled}
                          onCheckedChange={(value) => handleUpdateLinkedSetting("syncPeopleEnabled", value)}
                          disabled={!canEdit || isUpdatingLinked}
                        />
                      </div>

                      {syncPeopleEnabled && (
                        <>
                          {/* Delete People with Users */}
                          <div className="flex items-center justify-between p-4 rounded-lg border">
                            <div className="space-y-0.5">
                              <div className="font-medium text-sm">Delete People with Users</div>
                              <div className="text-xs text-muted-foreground">
                                When a user is deleted during sync, also delete their linked Person record
                              </div>
                            </div>
                            <Switch 
                              checked={deletePeopleOnUserDelete}
                              onCheckedChange={(value) => handleUpdateLinkedSetting("deletePeopleOnUserDelete", value)}
                              disabled={!canEdit || isUpdatingLinked}
                            />
                          </div>

                          {/* Property Mapping Info */}
                          <Card className="bg-muted/50">
                            <CardHeader className="pb-2 pt-4">
                              <CardTitle className="text-sm">Property Mapping</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="text-xs text-muted-foreground space-y-2">
                                <p>The following Entra ID properties are mapped to People fields:</p>
                                <ul className="space-y-1 ml-4 list-disc">
                                  <li><strong>displayName</strong> → Name</li>
                                  <li><strong>mail / userPrincipalName</strong> → Email</li>
                                  <li><strong>jobTitle</strong> → Role/Position</li>
                                  <li><strong>department</strong> → Team</li>
                                  <li><strong>officeLocation</strong> → Location</li>
                                  <li><strong>mobilePhone</strong> → Phone</li>
                                  <li><strong>employeeHireDate</strong> → Start Date</li>
                                </ul>
                              </div>
                            </CardContent>
                          </Card>

                          {!deletePeopleOnUserDelete && (
                            <Alert variant="default" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                                When users are removed, their People records will be kept. 
                                You may need to manually archive or delete orphaned People records.
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
                      )}

                      {!syncPeopleEnabled && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            Enable &quot;Create People Records&quot; to automatically sync People when users are synced.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </>
                )}

                {/* Independent Mode Settings */}
                {syncMode === "independent" && (
                  <>
                    <Separator />
                    
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Independent Mode</AlertTitle>
                      <AlertDescription>
                        When enabled, the &quot;Sync to People Directory&quot; option in Settings {">"} Integrations 
                        will be disabled. People sync will be managed here.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="groupPattern" className="font-medium">
                          Group Pattern <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="groupPattern"
                          placeholder="e.g., All-Employees or *-Employees-*"
                          value={groupPattern}
                          onChange={(e) => setGroupPattern(e.target.value)}
                          disabled={!canEdit}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use <code className="bg-muted px-1 rounded">*</code> as a wildcard anywhere in the pattern.
                        </p>
                        <div className="text-xs text-muted-foreground space-y-1 mt-2">
                          <p className="font-medium">Examples:</p>
                          <ul className="list-disc ml-4 space-y-0.5">
                            <li><code className="bg-muted px-1 rounded">All-Employees</code> → Matches exactly &quot;All-Employees&quot;</li>
                            <li><code className="bg-muted px-1 rounded">Employees-*</code> → Matches Employees-UK, Employees-US, etc.</li>
                            <li><code className="bg-muted px-1 rounded">*-Staff</code> → Matches HR-Staff, IT-Staff, etc.</li>
                            <li><code className="bg-muted px-1 rounded">Dept-*-Employees</code> → Matches Dept-HR-Employees, Dept-IT-Employees, etc.</li>
                          </ul>
                        </div>
                      </div>

                      {/* SCIM for People */}
                      {isCoreScimEnabled && (
                        <div className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">Enable SCIM for People</div>
                            <div className="text-xs text-muted-foreground">
                              Include People sync when SCIM provisioning runs
                            </div>
                          </div>
                          <Switch 
                            checked={scimEnabled}
                            onCheckedChange={setScimEnabled}
                            disabled={!canEdit}
                          />
                        </div>
                      )}

                      {/* Auto-delete */}
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">Auto-delete on Removal</div>
                          <div className="text-xs text-muted-foreground">
                            Delete People records when removed from synced groups
                          </div>
                        </div>
                        <Switch 
                          checked={autoDelete}
                          onCheckedChange={setAutoDelete}
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Sync Status */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Sync Status</h4>
                    {syncMode === "linked" ? (
                      <p className="text-sm text-muted-foreground">
                        {syncPeopleEnabled 
                          ? "Syncs with users from Entra ID groups" 
                          : "Enable 'Create People Records' to sync"
                        }
                      </p>
                    ) : settings?.lastSyncAt ? (
                      <p className="text-sm text-muted-foreground">
                        Last sync: {new Date(settings.lastSyncAt).toLocaleString()}
                        {settings.syncedPeopleCount && ` • ${settings.syncedPeopleCount} people synced`}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Never synced</p>
                    )}
                    {settings?.lastSyncError && (
                      <p className="text-sm text-red-500 mt-1">{settings.lastSyncError}</p>
                    )}
                    {hasUnsavedChanges && (
                      <p className="text-sm text-amber-500 mt-1">
                        Save your changes before syncing
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Workflow Settings */}
        <WorkflowSettingsCard 
          canEdit={canEdit} 
          settings={settings}
          onSave={refetch}
        />

        {/* General Settings (placeholder for future) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure general People & HR module behavior
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Additional settings coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

/**
 * Workflow Settings Card - Configure onboarding/offboarding workflow templates
 */
function WorkflowSettingsCard({ 
  canEdit, 
  settings,
  onSave,
}: { 
  canEdit: boolean
  settings: PeopleSettings | null
  onSave: () => void
}) {
  const { data: templates = [], isLoading: templatesLoading } = useWorkflowTemplatesList({
    moduleScope: "people",
    activeOnly: true,
  })
  
  // Filter templates by trigger type
  const onboardingTemplates = templates.filter(t => t.triggerType === "onboarding")
  const offboardingTemplates = templates.filter(t => t.triggerType === "offboarding")
  
  // State for selected templates
  // Use "__none__" as placeholder since Radix Select doesn't allow empty string values
  const [onboardingTemplateId, setOnboardingTemplateId] = useState<string>("__none__")
  const [offboardingTemplateId, setOffboardingTemplateId] = useState<string>("__none__")
  const [autoOnboarding, setAutoOnboarding] = useState(false)
  const [autoOffboarding, setAutoOffboarding] = useState(false)
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false)
  
  // Track initial values to detect changes
  const [initialOnboarding, setInitialOnboarding] = useState<string>("__none__")
  const [initialOffboarding, setInitialOffboarding] = useState<string>("__none__")
  const [initialAutoOnboarding, setInitialAutoOnboarding] = useState(false)
  const [initialAutoOffboarding, setInitialAutoOffboarding] = useState(false)
  
  // Initialize from settings when they load
  useEffect(() => {
    if (settings) {
      const onboardingId = settings.defaultOnboardingWorkflowTemplateId || "__none__"
      const offboardingId = settings.defaultOffboardingWorkflowTemplateId || "__none__"
      setOnboardingTemplateId(onboardingId)
      setOffboardingTemplateId(offboardingId)
      setAutoOnboarding(settings.autoOnboardingWorkflow || false)
      setAutoOffboarding(settings.autoOffboardingWorkflow || false)
      setInitialOnboarding(onboardingId)
      setInitialOffboarding(offboardingId)
      setInitialAutoOnboarding(settings.autoOnboardingWorkflow || false)
      setInitialAutoOffboarding(settings.autoOffboardingWorkflow || false)
    }
  }, [settings])
  
  // Check if there are unsaved changes
  const hasChanges = onboardingTemplateId !== initialOnboarding || 
                     offboardingTemplateId !== initialOffboarding ||
                     autoOnboarding !== initialAutoOnboarding ||
                     autoOffboarding !== initialAutoOffboarding
  
  const handleSaveWorkflowSettings = async () => {
    setIsSavingWorkflow(true)
    try {
      // Convert "__none__" back to null when saving
      const onboardingId = onboardingTemplateId === "__none__" ? null : onboardingTemplateId
      const offboardingId = offboardingTemplateId === "__none__" ? null : offboardingTemplateId
      
      const response = await fetch("/api/people/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoOnboardingWorkflow: autoOnboarding,
          defaultOnboardingWorkflowTemplateId: onboardingId,
          autoOffboardingWorkflow: autoOffboarding,
          defaultOffboardingWorkflowTemplateId: offboardingId,
        }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to save workflow settings")
      }
      
      toast.success("Workflow settings saved")
      setInitialOnboarding(onboardingTemplateId)
      setInitialOffboarding(offboardingTemplateId)
      setInitialAutoOnboarding(autoOnboarding)
      setInitialAutoOffboarding(autoOffboarding)
      onSave() // Refresh parent settings
    } catch {
      toast.error("Failed to save workflow settings")
    } finally {
      setIsSavingWorkflow(false)
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Workflow className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle>Workflow Automation</CardTitle>
            <CardDescription>
              Configure automatic workflows for onboarding and offboarding
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            When a person&apos;s status changes to &quot;Onboarding&quot; or &quot;Offboarding&quot;, 
            the selected workflow will automatically start for them.
          </AlertDescription>
        </Alert>
        
        {/* Onboarding Workflow */}
        <div className="space-y-3 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-onboarding" className="font-medium">
                Auto Onboarding Workflow
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically start workflow when status changes to &quot;Onboarding&quot;
              </p>
            </div>
            <Switch
              id="auto-onboarding"
              checked={autoOnboarding}
              onCheckedChange={setAutoOnboarding}
              disabled={!canEdit}
            />
          </div>
          
          {autoOnboarding && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="onboarding-workflow" className="text-sm">
                Select Template
              </Label>
              <Select
                value={onboardingTemplateId}
                onValueChange={setOnboardingTemplateId}
                disabled={!canEdit}
              >
                <SelectTrigger id="onboarding-workflow">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (disabled)</SelectItem>
                  {templatesLoading ? (
                    <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                  ) : onboardingTemplates.length === 0 ? (
                    <SelectItem value="__empty__" disabled>No onboarding templates available</SelectItem>
                  ) : (
                    onboardingTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.stepsCount > 0 && (
                          <span className="text-muted-foreground ml-2">
                            ({template.stepsCount} steps)
                          </span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        {/* Offboarding Workflow */}
        <div className="space-y-3 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-offboarding" className="font-medium">
                Auto Offboarding Workflow
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically start workflow when status changes to &quot;Offboarding&quot;
              </p>
            </div>
            <Switch
              id="auto-offboarding"
              checked={autoOffboarding}
              onCheckedChange={setAutoOffboarding}
              disabled={!canEdit}
            />
          </div>
          
          {autoOffboarding && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="offboarding-workflow" className="text-sm">
                Select Template
              </Label>
              <Select
                value={offboardingTemplateId}
                onValueChange={setOffboardingTemplateId}
                disabled={!canEdit}
              >
                <SelectTrigger id="offboarding-workflow">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (disabled)</SelectItem>
                  {templatesLoading ? (
                    <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                  ) : offboardingTemplates.length === 0 ? (
                    <SelectItem value="__empty__" disabled>No offboarding templates available</SelectItem>
                  ) : (
                    offboardingTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.stepsCount > 0 && (
                          <span className="text-muted-foreground ml-2">
                            ({template.stepsCount} steps)
                          </span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        {/* Create Template Link */}
        <div className="pt-2 border-t">
          <Button variant="link" className="px-0 h-auto" asChild>
            <Link href="/workflows/templates">
              Create new workflow template
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
      {canEdit && (
        <CardFooter className="border-t pt-4">
          <Button
            onClick={handleSaveWorkflowSettings}
            disabled={!hasChanges || isSavingWorkflow}
          >
            {isSavingWorkflow ? "Saving..." : "Save Workflow Settings"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

