"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  HardDrive, 
  Settings, 
  RefreshCw, 
  Loader2, 
  Check,
  ChevronRight,
  AlertCircle,
  Info,
  Laptop,
  Monitor,
  Phone,
  Tablet,
  Box,
} from "lucide-react"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { useCategoriesList } from "@/lib/api/assets"

// Types
interface AssetsSettingsData {
  id: string
  autoGenerateTags: boolean
  tagPrefix: string
  tagSequence: string
  defaultStatus: string
  syncSettings: {
    deviceFilters?: {
      osFilter?: string[]
      complianceFilter?: string[]
    }
    categoryMapping?: {
      mappings: Array<{ deviceType: string; categoryId: string }>
      defaultCategoryId?: string
    }
    syncBehavior?: {
      autoDeleteOnRemoval: boolean
      autoCreatePeople: boolean
      updateExistingOnly: boolean
    }
  }
  lastSyncAt: string | null
  syncedAssetCount: string
  lastSyncError: string | null
}

interface EntraConfig {
  status: string
  syncDevicesEnabled?: boolean
  syncedDeviceCount?: string
  lastDeviceSyncAt?: string
}

// Fetch functions
async function fetchAssetsSettings(): Promise<AssetsSettingsData | null> {
  const res = await fetch("/api/assets/settings")
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch settings")
  return res.json()
}

async function saveAssetsSettings(data: Partial<AssetsSettingsData>): Promise<AssetsSettingsData> {
  const res = await fetch("/api/assets/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to save settings")
  return res.json()
}

async function fetchEntraConfig(): Promise<EntraConfig | null> {
  const res = await fetch("/api/settings/integrations?provider=entra")
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json()
}

async function triggerDeviceSync(): Promise<{ success: boolean; message: string; syncedCount?: number }> {
  const res = await fetch("/api/assets/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Sync failed" }))
    throw new Error(error.error || "Sync failed")
  }
  return res.json()
}

// Device OS options
const osOptions = [
  { value: "Windows", label: "Windows" },
  { value: "macOS", label: "macOS" },
  { value: "iOS", label: "iOS" },
  { value: "Android", label: "Android" },
  { value: "Linux", label: "Linux" },
]

// Compliance state options
const complianceOptions = [
  { value: "compliant", label: "Compliant" },
  { value: "noncompliant", label: "Non-compliant" },
  { value: "unknown", label: "Unknown" },
]

export default function AssetsSettingsPage() {
  const canAccess = useCanAccess("assets.settings")
  const canEdit = usePermission("assets.settings", "edit")
  const _router = useRouter()
  const queryClient = useQueryClient()
  
  // Local state
  const [tagPrefix, setTagPrefix] = useState("AST")
  const [autoGenerateTags, setAutoGenerateTags] = useState(true)
  const [selectedOsFilters, setSelectedOsFilters] = useState<string[]>([])
  const [selectedComplianceFilters, setSelectedComplianceFilters] = useState<string[]>([])
  const [categoryMappings, setCategoryMappings] = useState<Array<{ deviceType: string; categoryId: string }>>([])
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("__none__")
  const [autoDeleteOnRemoval, setAutoDeleteOnRemoval] = useState(false)
  const [autoCreatePeople, setAutoCreatePeople] = useState(false)
  const [updateExistingOnly, setUpdateExistingOnly] = useState(false)
  
  // Queries
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["assets-settings"],
    queryFn: fetchAssetsSettings,
  })
  
  const { data: entraConfig, isLoading: entraLoading } = useQuery({
    queryKey: ["entra-config"],
    queryFn: fetchEntraConfig,
  })
  
  const { data: categories = [] } = useCategoriesList()
  
  // Mutations
  const saveMutation = useMutation({
    mutationFn: saveAssetsSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets-settings"] })
      toast.success("Settings saved")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    },
  })
  
  const syncMutation = useMutation({
    mutationFn: triggerDeviceSync,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["assets-settings"] })
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      toast.success(result.message, {
        description: result.syncedCount !== undefined 
          ? `${result.syncedCount} devices synced`
          : undefined,
      })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Sync failed")
    },
  })
  
  // Populate form from settings
  useEffect(() => {
    if (settings) {
      setTagPrefix(settings.tagPrefix || "AST")
      setAutoGenerateTags(settings.autoGenerateTags)
      setSelectedOsFilters(settings.syncSettings?.deviceFilters?.osFilter || [])
      setSelectedComplianceFilters(settings.syncSettings?.deviceFilters?.complianceFilter || [])
      setCategoryMappings(settings.syncSettings?.categoryMapping?.mappings || [])
      setDefaultCategoryId(settings.syncSettings?.categoryMapping?.defaultCategoryId || "__none__")
      setAutoDeleteOnRemoval(settings.syncSettings?.syncBehavior?.autoDeleteOnRemoval || false)
      setAutoCreatePeople(settings.syncSettings?.syncBehavior?.autoCreatePeople || false)
      setUpdateExistingOnly(settings.syncSettings?.syncBehavior?.updateExistingOnly || false)
    }
  }, [settings])
  
  // Save handlers
  const handleSaveGeneral = () => {
    saveMutation.mutate({
      autoGenerateTags,
      tagPrefix,
    })
  }
  
  const handleSaveSyncSettings = () => {
    saveMutation.mutate({
      syncSettings: {
        deviceFilters: {
          osFilter: selectedOsFilters,
          complianceFilter: selectedComplianceFilters,
        },
        categoryMapping: {
          mappings: categoryMappings,
          defaultCategoryId: defaultCategoryId === "__none__" ? undefined : defaultCategoryId,
        },
        syncBehavior: {
          autoDeleteOnRemoval,
          autoCreatePeople,
          updateExistingOnly,
        },
      },
    })
  }
  
  const toggleOsFilter = (os: string) => {
    setSelectedOsFilters(prev => 
      prev.includes(os) 
        ? prev.filter(o => o !== os)
        : [...prev, os]
    )
  }
  
  const toggleComplianceFilter = (state: string) => {
    setSelectedComplianceFilters(prev =>
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    )
  }
  
  const updateCategoryMapping = (deviceType: string, categoryId: string) => {
    // Convert __default__ placeholder back to empty string for storage
    const actualCategoryId = categoryId === "__default__" ? "" : categoryId
    setCategoryMappings(prev => {
      const existing = prev.find(m => m.deviceType === deviceType)
      if (existing) {
        return prev.map(m => 
          m.deviceType === deviceType ? { ...m, categoryId: actualCategoryId } : m
        )
      }
      return [...prev, { deviceType, categoryId: actualCategoryId }]
    })
  }
  
  const getCategoryMapping = (deviceType: string) => {
    return categoryMappings.find(m => m.deviceType === deviceType)?.categoryId || "__default__"
  }
  
  const isLoading = settingsLoading || entraLoading
  const isEntraConnected = entraConfig?.status === "connected"
  const isDeviceSyncEnabled = entraConfig?.syncDevicesEnabled
  
  if (!canAccess) {
    return (
      <PageShell title="Settings">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view asset settings." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Asset Settings"
      description="Configure asset module settings and Intune device sync."
    >
      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Configure asset tag generation and default values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto-generate Asset Tags</div>
                <div className="text-sm text-muted-foreground">
                  Automatically generate asset tags when creating new assets
                </div>
              </div>
              <Switch
                checked={autoGenerateTags}
                onCheckedChange={setAutoGenerateTags}
                disabled={!canEdit}
              />
            </div>
            
            {autoGenerateTags && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="tagPrefix">Tag Prefix</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tagPrefix"
                    value={tagPrefix}
                    onChange={(e) => setTagPrefix(e.target.value.toUpperCase())}
                    placeholder="AST"
                    className="w-32"
                    disabled={!canEdit}
                  />
                  <span className="text-sm text-muted-foreground">
                    Preview: {tagPrefix}-{String(parseInt(settings?.tagSequence || "0") + 1).padStart(4, "0")}
                  </span>
                </div>
              </div>
            )}
            
            <Protected module="assets.settings" action="edit">
              <Button onClick={handleSaveGeneral} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save General Settings
              </Button>
            </Protected>
          </CardContent>
        </Card>
        
        {/* Device Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Microsoft Intune Device Sync
            </CardTitle>
            <CardDescription>
              Configure how devices are synced from Microsoft Intune.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : !isEntraConnected ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Entra ID Not Connected</AlertTitle>
                <AlertDescription>
                  Connect Microsoft Entra ID in Settings → Integrations to enable device sync.
                </AlertDescription>
              </Alert>
            ) : !isDeviceSyncEnabled ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Device Sync Disabled</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>Enable device sync in Settings → Integrations → Device Sync tab.</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/settings/integrations">Go to Integrations</a>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Sync Status */}
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">Device Sync Active</div>
                          <div className="text-sm text-muted-foreground">
                            {settings?.syncedAssetCount || "0"} devices synced
                            {settings?.lastSyncAt && ` • Last sync: ${new Date(settings.lastSyncAt).toLocaleString()}`}
                          </div>
                        </div>
                      </div>
                      <Protected module="assets.settings" action="edit">
                        <Button 
                          onClick={() => syncMutation.mutate()}
                          disabled={syncMutation.isPending}
                        >
                          {syncMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Sync Now
                        </Button>
                      </Protected>
                    </div>
                    {settings?.lastSyncError && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Last sync had errors</AlertTitle>
                        <AlertDescription>{settings.lastSyncError}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
                
                <Separator />
                
                {/* Device Filters */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Device Filters</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Only sync devices matching these criteria. Leave empty to sync all devices.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Operating System</Label>
                    <div className="flex flex-wrap gap-2">
                      {osOptions.map((os) => (
                        <div key={os.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`os-${os.value}`}
                            checked={selectedOsFilters.includes(os.value)}
                            onCheckedChange={() => toggleOsFilter(os.value)}
                            disabled={!canEdit}
                          />
                          <label
                            htmlFor={`os-${os.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {os.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedOsFilters.length === 0 && (
                      <p className="text-xs text-muted-foreground">All operating systems will be synced</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Compliance State</Label>
                    <div className="flex flex-wrap gap-2">
                      {complianceOptions.map((state) => (
                        <div key={state.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`compliance-${state.value}`}
                            checked={selectedComplianceFilters.includes(state.value)}
                            onCheckedChange={() => toggleComplianceFilter(state.value)}
                            disabled={!canEdit}
                          />
                          <label
                            htmlFor={`compliance-${state.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {state.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedComplianceFilters.length === 0 && (
                      <p className="text-xs text-muted-foreground">All compliance states will be synced</p>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                {/* Category Mapping */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Category Mapping</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Map device types from Intune to asset categories.
                    </p>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    {osOptions.map((os) => (
                      <div key={os.value} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-24">
                          {os.value === "Windows" && <Monitor className="h-4 w-4 text-muted-foreground" />}
                          {os.value === "macOS" && <Laptop className="h-4 w-4 text-muted-foreground" />}
                          {os.value === "iOS" && <Phone className="h-4 w-4 text-muted-foreground" />}
                          {os.value === "Android" && <Tablet className="h-4 w-4 text-muted-foreground" />}
                          {os.value === "Linux" && <Monitor className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-sm">{os.label}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={getCategoryMapping(os.value)}
                          onValueChange={(value) => updateCategoryMapping(os.value, value)}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">Use default</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 w-24">
                      <Box className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Default</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={defaultCategoryId}
                      onValueChange={setDefaultCategoryId}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select default category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (uncategorized)</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Separator />
                
                {/* Sync Behavior */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Sync Behavior</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure how device sync should behave.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Auto-delete on Removal</div>
                        <div className="text-sm text-muted-foreground">
                          Delete assets when devices are removed from Intune
                        </div>
                      </div>
                      <Switch
                        checked={autoDeleteOnRemoval}
                        onCheckedChange={setAutoDeleteOnRemoval}
                        disabled={!canEdit}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Auto-create People</div>
                        <div className="text-sm text-muted-foreground">
                          Create Person records for unknown device owners
                        </div>
                      </div>
                      <Switch
                        checked={autoCreatePeople}
                        onCheckedChange={setAutoCreatePeople}
                        disabled={!canEdit}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Update Existing Only</div>
                        <div className="text-sm text-muted-foreground">
                          Only update existing assets, don&apos;t create new ones
                        </div>
                      </div>
                      <Switch
                        checked={updateExistingOnly}
                        onCheckedChange={setUpdateExistingOnly}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </div>
                
                <Protected module="assets.settings" action="edit">
                  <Button onClick={handleSaveSyncSettings} disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Sync Settings
                  </Button>
                </Protected>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

