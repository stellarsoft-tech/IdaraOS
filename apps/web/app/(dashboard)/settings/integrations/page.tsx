"use client"

import { useState, useEffect } from "react"
import { 
  AlertCircle, 
  AlertTriangle,
  Check, 
  ChevronRight, 
  Copy, 
  ExternalLink, 
  HardDrive,
  Key, 
  Loader2, 
  RefreshCw, 
  Settings, 
  Shield, 
  Users, 
  Zap 
} from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import {
  useEntraIntegration,
  useSaveEntraIntegration,
  useUpdateEntraIntegration,
  useDisconnectEntraIntegration,
  useRegenerateScimToken,
  useTriggerSync,
  IntegrationError,
} from "@/lib/api/integrations"

// Microsoft 365 Icon
function Microsoft365Icon({ className }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M48 0C21.49 0 0 21.49 0 48s21.49 48 48 48 48-21.49 48-48S74.51 0 48 0z" fill="#0078D4"/>
      <path d="M48 12c19.88 0 36 16.12 36 36s-16.12 36-36 36S12 67.88 12 48s16.12-36 36-36z" fill="#fff" fillOpacity="0.2"/>
      <path d="M32 36h32v4H32zM32 44h32v4H32zM32 52h24v4H32z" fill="#fff"/>
    </svg>
  )
}

export default function IntegrationsPage() {
  const canAccess = useCanAccess("settings.integrations")
  const canEdit = usePermission("settings.integrations", "edit")
  
  // API hooks
  const { data: entraConfig, isLoading } = useEntraIntegration()
  const saveEntra = useSaveEntraIntegration()
  const updateEntra = useUpdateEntraIntegration()
  const disconnectEntra = useDisconnectEntraIntegration()
  const regenerateToken = useRegenerateScimToken()
  const triggerSync = useTriggerSync()
  
  const [showSecrets, setShowSecrets] = useState(false)
  const [scimToken, setScimToken] = useState<string | null>(null)
  const [groupPattern, setGroupPattern] = useState("")
  
  // Form state for configuration
  const [formData, setFormData] = useState({
    tenantId: "",
    clientId: "",
    clientSecret: "",
  })

  // Reset form when config loads
  useEffect(() => {
    if (entraConfig?.status === "connected") {
      setFormData({
        tenantId: entraConfig.tenantId || "",
        clientId: entraConfig.clientId || "",
        clientSecret: "",
      })
      setGroupPattern(entraConfig.scimGroupPrefix || "")
    }
  }, [entraConfig])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const handleSaveConfig = async () => {
    try {
      const result = await saveEntra.mutateAsync({
        provider: "entra",
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        ssoEnabled: true,
        scimEnabled: true,
      })
      
      // Store the SCIM token from the response
      if (result.scimToken) {
        setScimToken(result.scimToken)
      }
      
      toast.success("Microsoft 365 connected successfully")
    } catch (error) {
      // Show detailed validation error if available
      if (error instanceof IntegrationError && error.details) {
        toast.error(error.details, {
          description: error.field ? `Please check the ${error.field} field` : undefined,
          duration: 6000,
        })
      } else {
      toast.error(error instanceof Error ? error.message : "Failed to connect")
      }
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectEntra.mutateAsync()
      setFormData({ tenantId: "", clientId: "", clientSecret: "" })
      setScimToken(null)
      toast.success("Microsoft 365 disconnected")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect")
    }
  }

  const handleToggleSSO = async (enabled: boolean) => {
    try {
      await updateEntra.mutateAsync({
        provider: "entra",
        ssoEnabled: enabled,
      })
      toast.success(enabled ? "SSO enabled" : "SSO disabled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  const handleTogglePasswordAuth = async (disabled: boolean) => {
    try {
      await updateEntra.mutateAsync({
        provider: "entra",
        passwordAuthDisabled: disabled,
      })
      toast.success(disabled ? "Password authentication disabled" : "Password authentication enabled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  const handleToggleSCIM = async (enabled: boolean) => {
    try {
      await updateEntra.mutateAsync({
        provider: "entra",
        scimEnabled: enabled,
      })
      toast.success(enabled ? "SCIM enabled" : "SCIM disabled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  const handleUpdateScimGroupPrefix = async (prefix: string) => {
    try {
      await updateEntra.mutateAsync({
        provider: "entra",
        scimGroupPrefix: prefix,
      })
      toast.success("SCIM group prefix updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  const handleToggleBidirectionalSync = async (enabled: boolean) => {
    try {
      await updateEntra.mutateAsync({
        provider: "entra",
        scimBidirectionalSync: enabled,
      })
      toast.success(enabled ? "Bidirectional sync enabled" : "Bidirectional sync disabled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  const handleRegenerateToken = async () => {
    try {
      const result = await regenerateToken.mutateAsync()
      setScimToken(result.scimToken)
      toast.success("SCIM token regenerated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate token")
    }
  }

  const handleSync = async () => {
    try {
      const result = await triggerSync.mutateAsync()
      if (result.success) {
        const stats = result.stats
        let description = ""
        if (stats) {
          const parts = []
          parts.push(`Groups: ${stats.groupsSynced}/${stats.groupsFound}`)
          if (stats.groupsRemoved > 0) parts.push(`-${stats.groupsRemoved} stale`)
          parts.push(`Users: +${stats.usersCreated}`)
          if (stats.usersDeleted > 0) parts.push(`-${stats.usersDeleted} deleted`)
          if (stats.peopleCreated > 0 || stats.peopleDeleted > 0) {
            parts.push(`People: +${stats.peopleCreated}/-${stats.peopleDeleted}`)
          }
          parts.push(`Roles: +${stats.rolesAssigned}/-${stats.rolesRemoved}`)
          description = parts.join(" • ")
        }
        toast.success(result.message, { description: description || undefined })
      } else {
        toast.warning(result.message, {
          description: result.stats?.errors?.length 
            ? `${result.stats.errors.length} errors occurred during sync`
            : undefined,
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync")
    }
  }

  if (!canAccess) {
    return (
      <PageShell title="Integrations">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view integrations." 
        />
      </PageShell>
    )
  }

  const isConnected = entraConfig?.status === "connected"
  const displayToken = scimToken || (showSecrets ? "••••••••••••••••" : "••••••••••••••••")

  return (
    <PageShell 
      title="Integrations" 
      description="Connect identity providers and third-party services."
    >
      <div className="space-y-6">
        {/* Main Integration Card */}
        <Card className="overflow-hidden pt-0">
          <div className="bg-gradient-to-r from-[#0078D4]/10 to-[#0078D4]/5 dark:from-[#0078D4]/20 dark:to-[#0078D4]/10 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white dark:bg-[#0078D4] flex items-center justify-center shadow-sm border">
                  <Microsoft365Icon className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Microsoft 365</h2>
                    {isLoading ? (
                      <Skeleton className="h-5 w-20" />
                    ) : isConnected ? (
                      <StatusBadge variant="success">
                        <Check className="h-3 w-3 mr-1" />
                        Connected
                      </StatusBadge>
                    ) : (
                      <StatusBadge variant="default">Not Connected</StatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Identity, user provisioning, and device management
                  </p>
                </div>
              </div>
              {isConnected && (
                <Protected module="settings.integrations" action="edit">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDisconnect} 
                    disabled={disconnectEntra.isPending}
                  >
                    {disconnectEntra.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Disconnect
                  </Button>
                </Protected>
              )}
            </div>
          </div>

          <CardContent className="p-6 pt-0">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : isConnected ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="sso">Identity</TabsTrigger>
                  <TabsTrigger value="sync">User Provisioning</TabsTrigger>
                  <TabsTrigger value="devices">Device Management</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {/* Identity Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Identity (Entra ID)</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Synced Users</div>
                            <div className="text-lg font-semibold">{entraConfig?.syncedUserCount || 0}</div>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                            <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Groups</div>
                            <div className="text-lg font-semibold">{entraConfig?.syncedGroupCount || 0}</div>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                            <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">SSO</div>
                            <StatusBadge variant={entraConfig?.ssoEnabled ? "success" : "default"} className="text-xs px-1.5 py-0">
                              {entraConfig?.ssoEnabled ? "Enabled" : "Disabled"}
                            </StatusBadge>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">User Provisioning</div>
                            <StatusBadge variant={entraConfig?.scimEnabled ? "success" : "default"} className="text-xs px-1.5 py-0">
                              {entraConfig?.scimEnabled ? "Active" : "Inactive"}
                            </StatusBadge>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Device Management Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Device Management (Intune)</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                            <HardDrive className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Synced Devices</div>
                            <div className="text-lg font-semibold">{entraConfig?.syncedDeviceCount || 0}</div>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                            <RefreshCw className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Device Sync</div>
                            <StatusBadge variant={entraConfig?.syncDevicesEnabled ? "success" : "default"} className="text-xs px-1.5 py-0">
                              {entraConfig?.syncDevicesEnabled ? "Active" : "Inactive"}
                            </StatusBadge>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-3 sm:col-span-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
                            <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Last Device Sync</div>
                            <div className="text-sm font-medium">
                              {entraConfig?.lastDeviceSyncAt 
                                ? new Date(entraConfig.lastDeviceSyncAt).toLocaleString()
                                : "Never synced"}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Last Sync Info */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">User Sync Status</div>
                        <div className="text-xs text-muted-foreground">
                          {entraConfig?.lastSyncAt 
                            ? `Last synced: ${new Date(entraConfig.lastSyncAt).toLocaleString()}`
                            : "No sync performed yet"}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Quick Actions */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Button variant="outline" className="justify-between h-auto py-4" asChild>
                      <a 
                        href="https://entra.microsoft.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <div className="font-medium">Entra Admin Center</div>
                            <div className="text-xs text-muted-foreground">Identity & access</div>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </Button>
                    <Button variant="outline" className="justify-between h-auto py-4" asChild>
                      <a 
                        href="https://intune.microsoft.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <div className="flex items-center gap-3">
                          <HardDrive className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <div className="font-medium">Intune Admin Center</div>
                            <div className="text-xs text-muted-foreground">Device management</div>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </Button>
                    <Button variant="outline" className="justify-between h-auto py-4" asChild>
                      <a 
                        href="https://learn.microsoft.com/en-us/entra/identity/app-provisioning/use-scim-to-provision-users-and-groups" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <div className="flex items-center gap-3">
                          <ExternalLink className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <div className="font-medium">Documentation</div>
                            <div className="text-xs text-muted-foreground">Setup guides</div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="sso" className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      Powered by Entra ID
                    </Badge>
                  </div>
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Single Sign-On {entraConfig?.ssoEnabled ? "Active" : "Disabled"}</AlertTitle>
                    <AlertDescription>
                      {entraConfig?.ssoEnabled 
                        ? "Users in your Microsoft Entra ID tenant can sign in using their Microsoft account."
                        : "Enable SSO to allow users to sign in with their Microsoft account."}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <div className="font-medium">Enable SSO</div>
                        <div className="text-sm text-muted-foreground">
                          Allow users to sign in with Microsoft
                        </div>
                      </div>
                      <Switch 
                        checked={entraConfig?.ssoEnabled || false} 
                        onCheckedChange={handleToggleSSO}
                        disabled={!canEdit || updateEntra.isPending}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <div className="font-medium">Disable Password Authentication</div>
                        <div className="text-sm text-muted-foreground">
                          Only allow sign-in via Microsoft Entra ID (SSO only)
                        </div>
                      </div>
                      <Switch 
                        checked={entraConfig?.passwordAuthDisabled || false} 
                        onCheckedChange={handleTogglePasswordAuth}
                        disabled={!canEdit || updateEntra.isPending || !entraConfig?.ssoEnabled}
                      />
                    </div>

                    {entraConfig?.passwordAuthDisabled && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Password Login Disabled</AlertTitle>
                        <AlertDescription>
                          Users can only sign in using Microsoft Entra ID. Make sure all users have 
                          Microsoft accounts before enabling this.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Card>
                      <CardHeader className="pt-0">
                        <CardTitle className="text-base">Configuration Details</CardTitle>
                        <CardDescription>
                          These values are configured in your Microsoft Entra ID application
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Tenant ID</Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                              {entraConfig?.tenantId || "Not configured"}
                            </code>
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => copyToClipboard(entraConfig?.tenantId || "", "Tenant ID")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Client ID</Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                              {entraConfig?.clientId || "Not configured"}
                            </code>
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => copyToClipboard(entraConfig?.clientId || "", "Client ID")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Redirect URI</Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                              {typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback/azure-ad` : ""}
                            </code>
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => copyToClipboard(`${window.location.origin}/api/auth/callback/azure-ad`, "Redirect URI")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="sync" className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      Powered by Entra ID
                    </Badge>
                    <Protected module="settings.integrations" action="edit">
                      <Button 
                        onClick={handleSync}
                        disabled={triggerSync.isPending || !entraConfig?.scimEnabled}
                      >
                        {triggerSync.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Sync Users Now
                      </Button>
                    </Protected>
                  </div>
                  <Alert>
                    <RefreshCw className="h-4 w-4" />
                    <AlertTitle>User Provisioning {entraConfig?.scimEnabled ? "Active" : "Disabled"}</AlertTitle>
                    <AlertDescription>
                      {entraConfig?.scimEnabled
                        ? "Users and groups are automatically synced from Microsoft Entra ID."
                        : "Enable provisioning to automatically sync users and groups from Microsoft Entra ID."}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <div className="font-medium">Enable User Sync</div>
                        <div className="text-sm text-muted-foreground">
                          Automatically sync users from Entra ID groups
                        </div>
                      </div>
                      <Switch 
                        checked={entraConfig?.scimEnabled || false} 
                        onCheckedChange={handleToggleSCIM}
                        disabled={!canEdit || updateEntra.isPending}
                      />
                    </div>

                    {/* User Sync Settings */}
                    <Card>
                      <CardHeader className="pt-0">
                        <CardTitle className="text-base">User Sync Settings</CardTitle>
                        <CardDescription>
                          Configure how Entra ID groups sync users and map to application roles
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="groupPattern" className="text-muted-foreground text-xs uppercase tracking-wide">
                            Group Pattern
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="groupPattern"
                              placeholder="e.g., IdaraOS-* or *-Users-*"
                              value={groupPattern}
                              onChange={(e) => setGroupPattern(e.target.value)}
                              disabled={!canEdit || updateEntra.isPending}
                              className="flex-1"
                            />
                            <Button 
                              variant="outline"
                              onClick={() => handleUpdateScimGroupPrefix(groupPattern)}
                              disabled={!canEdit || updateEntra.isPending || groupPattern === (entraConfig?.scimGroupPrefix || "")}
                            >
                              {updateEntra.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Save
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Groups matching this pattern will sync users to the application. Use <code className="bg-muted px-1 rounded">*</code> as a wildcard.
                          </p>
                          <div className="text-xs text-muted-foreground space-y-1 mt-2">
                            <p className="font-medium">Examples:</p>
                            <ul className="list-disc ml-4 space-y-0.5">
                              <li><code className="bg-muted px-1 rounded">IdaraOS-*</code> → Matches IdaraOS-Admin, IdaraOS-Users, etc.</li>
                              <li><code className="bg-muted px-1 rounded">*-AppAccess</code> → Matches Admin-AppAccess, HR-AppAccess, etc.</li>
                              <li><code className="bg-muted px-1 rounded">App-*-Users</code> → Matches App-Admin-Users, App-HR-Users, etc.</li>
                            </ul>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">Bidirectional Sync</div>
                            <div className="text-xs text-muted-foreground">
                              Allow changes in the application to sync back to Entra ID
                            </div>
                          </div>
                          <Switch 
                            checked={entraConfig?.scimBidirectionalSync || false} 
                            onCheckedChange={handleToggleBidirectionalSync}
                            disabled={!canEdit || updateEntra.isPending}
                          />
                        </div>
                        
                        {/* Sync Direction Explanation */}
                        <Card className="bg-muted/50">
                          <CardHeader className="pb-3 pt-0">
                            <CardTitle className="text-sm">Sync Directions</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-4">
                            {/* Entra ID → Application */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <div className="font-medium text-sm">Entra ID → Application</div>
                                <Badge variant="outline" className="text-xs">Always Active</Badge>
                              </div>
                              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                                <li>Users created/updated in Entra ID are synced to the application</li>
                                <li>Group memberships sync to application roles (based on group pattern)</li>
                                <li>User status changes (active/inactive) sync to the application</li>
                                <li>User name changes sync to the application</li>
                              </ul>
                            </div>

                            <Separator />

                            {/* Application → Entra ID */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <RefreshCw className={`h-4 w-4 ${entraConfig?.scimBidirectionalSync ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                                <div className="font-medium text-sm">Application → Entra ID</div>
                                <Badge variant={entraConfig?.scimBidirectionalSync ? "default" : "outline"} className="text-xs">
                                  {entraConfig?.scimBidirectionalSync ? "Enabled" : "Disabled"}
                                </Badge>
                              </div>
                              {entraConfig?.scimBidirectionalSync ? (
                                <div className="space-y-3">
                                  <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                                    <li><strong>Name changes:</strong> Updates displayName, givenName, and surname in Entra ID</li>
                                    <li><strong>Role/Job Title:</strong> Updates jobTitle in Entra ID</li>
                                    <li><strong>Team/Department:</strong> Updates department in Entra ID</li>
                                    <li><strong>Location:</strong> Updates officeLocation in Entra ID</li>
                                    <li><strong>Phone:</strong> Updates mobilePhone in Entra ID</li>
                                    <li><strong>Status changes:</strong> Updates accountEnabled (active/inactive) in Entra ID</li>
                                    <li><strong>Note:</strong> Email changes do not sync to Entra ID</li>
                                  </ul>
                                  <div className="ml-6 p-2 rounded bg-muted/50 border">
                                    <p className="text-xs font-medium mb-1">Required App Registration Permissions:</p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc ml-4">
                                      <li><code className="bg-muted px-1 rounded">User.ReadWrite.All</code> - Required to update user properties</li>
                                      <li><code className="bg-muted px-1 rounded">Directory.ReadWrite.All</code> - Required for directory operations</li>
                                      <li><code className="bg-muted px-1 rounded">AuditLog.Read.All</code> - Optional, for sign-in activity</li>
                                    </ul>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground ml-6">
                                  When disabled, synced users are read-only in the application. 
                                  All changes must be made in Microsoft Entra ID and will sync to the application automatically.
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        
                        {!entraConfig?.scimBidirectionalSync && (
                          <Alert variant="default" className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                              When disabled, synced users cannot be edited or deleted in the Users settings. 
                              This ensures Entra ID remains the source of truth for user data and roles.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    {/* SCIM Endpoint Configuration */}
                    <Card>
                      <CardHeader className="pt-0">
                        <CardTitle className="text-base">SCIM Endpoint</CardTitle>
                        <CardDescription>
                          Use these values to configure SCIM provisioning in Microsoft Entra ID (optional)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                            Tenant URL (SCIM Endpoint)
                          </Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate">
                              {entraConfig?.scimEndpoint || "Not configured"}
                            </code>
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => copyToClipboard(entraConfig?.scimEndpoint || "", "SCIM Endpoint")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                            Secret Token
                          </Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                              {showSecrets && scimToken ? scimToken : displayToken}
                            </code>
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => setShowSecrets(!showSecrets)}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => copyToClipboard(scimToken || "", "SCIM Token")}
                              disabled={!scimToken}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          {!scimToken && entraConfig?.hasScimToken && (
                            <p className="text-xs text-muted-foreground">
                              Token is stored securely. Regenerate to get a new one.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Alert variant="default" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <AlertTitle className="text-amber-800 dark:text-amber-200">Security Notice</AlertTitle>
                      <AlertDescription className="text-amber-700 dark:text-amber-300">
                        Keep your SCIM token secure. It provides access to create and modify users in your organization.
                        Rotate the token immediately if you suspect it has been compromised.
                      </AlertDescription>
                    </Alert>

                    <Protected module="settings.integrations" action="edit">
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={handleRegenerateToken}
                        disabled={regenerateToken.isPending}
                      >
                        {regenerateToken.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate Token
                      </Button>
                    </Protected>
                  </div>
                </TabsContent>

                <TabsContent value="devices" className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      Powered by Intune
                    </Badge>
                  </div>
                  <Alert>
                    <HardDrive className="h-4 w-4" />
                    <AlertTitle>Device Management {entraConfig?.syncDevicesEnabled ? "Active" : "Disabled"}</AlertTitle>
                    <AlertDescription>
                      Sync managed devices from Microsoft Intune to your asset inventory.
                      Configure detailed sync settings in Assets → Settings.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium">Enable Device Sync</div>
                          <div className="text-sm text-muted-foreground">
                            Sync managed devices from Intune to Assets
                          </div>
                        </div>
                      </div>
                      <Switch 
                        checked={entraConfig?.syncDevicesEnabled || false} 
                        onCheckedChange={async (enabled) => {
                          try {
                            await updateEntra.mutateAsync({
                              provider: "entra",
                              syncDevicesEnabled: enabled,
                            })
                            toast.success(enabled ? "Device sync enabled" : "Device sync disabled")
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to update")
                          }
                        }}
                        disabled={!canEdit || updateEntra.isPending}
                      />
                    </div>

                    {entraConfig?.syncDevicesEnabled && (
                      <>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Device Sync Status</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <div className="text-sm text-muted-foreground">Synced Devices</div>
                                <div className="text-2xl font-bold">{entraConfig?.syncedDeviceCount || 0}</div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground">Last Device Sync</div>
                                <div className="text-sm font-medium">
                                  {entraConfig?.lastDeviceSyncAt 
                                    ? new Date(entraConfig.lastDeviceSyncAt).toLocaleString()
                                    : "Never synced"}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Required API Permissions</CardTitle>
                            <CardDescription>
                              Add these permissions to your Entra app registration for device sync
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                DeviceManagementManagedDevices.Read.All
                              </Badge>
                              <span className="text-xs text-muted-foreground">Read managed devices</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                DeviceManagementServiceConfig.Read.All
                              </Badge>
                              <span className="text-xs text-muted-foreground">Read Intune config</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Sync Field Documentation */}
                        <Card className="bg-muted/50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Field Sync Behavior</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <div className="font-medium text-sm">Intune → Assets (Read-Only)</div>
                              </div>
                              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                                <li>Device Name</li>
                                <li>Serial Number</li>
                                <li>Manufacturer & Model</li>
                                <li>Compliance State</li>
                                <li>Enrollment Type & Date</li>
                                <li>Assigned User</li>
                              </ul>
                            </div>
                            <Separator />
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Settings className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <div className="font-medium text-sm">Locally Managed (Editable)</div>
                              </div>
                              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                                <li>Category</li>
                                <li>Location</li>
                                <li>Purchase Cost</li>
                                <li>Warranty End Date</li>
                                <li>Notes & Custom Fields</li>
                              </ul>
                            </div>
                          </CardContent>
                        </Card>

                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                          <div>
                            <div className="font-medium text-sm">Configure Sync Behavior</div>
                            <div className="text-xs text-muted-foreground">
                              Set up device filters, category mapping, and sync options
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href="/assets/settings">
                              Go to Assets Settings
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              // Not Connected State - Setup Flow
              <div className="space-y-6">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Connect Microsoft 365</AlertTitle>
                  <AlertDescription>
                    Enable Single Sign-On, user provisioning, and device management for your organization.
                    Connect once to access identity (Entra ID) and device management (Intune) services.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Setup Instructions */}
                  <Card>
                    <CardHeader className="pt-0">
                      <CardTitle className="text-base">Setup Instructions</CardTitle>
                      <CardDescription>
                        Follow these steps in the Microsoft Entra admin center
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ol className="space-y-4 text-sm">
                        <li className="flex gap-3">
                          <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">1</Badge>
                          <div>
                            <p className="font-medium">Register an application</p>
                            <p className="text-muted-foreground">Go to Entra ID → App registrations → New registration</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">2</Badge>
                          <div>
                            <p className="font-medium">Configure authentication</p>
                            <p className="text-muted-foreground">Add the redirect URI shown below</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">3</Badge>
                          <div>
                            <p className="font-medium">Create a client secret</p>
                            <p className="text-muted-foreground">Certificates & secrets → New client secret</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">4</Badge>
                          <div>
                            <p className="font-medium">Copy the credentials</p>
                            <p className="text-muted-foreground">Enter the Tenant ID, Client ID, and Secret below</p>
                          </div>
                        </li>
                      </ol>
                      
                      <Separator className="my-4" />
                      
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                          Redirect URI (copy this)
                        </Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono truncate">
                            {typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback/azure-ad` : ""}
                          </code>
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => copyToClipboard(`${window.location.origin}/api/auth/callback/azure-ad`, "Redirect URI")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Form */}
                  <Card>
                    <CardHeader className="pt-0">
                      <CardTitle className="text-base">Enter Your Credentials</CardTitle>
                      <CardDescription>
                        From your Microsoft Entra ID app registration
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="tenantId">Tenant ID</Label>
                        <Input
                          id="tenantId"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={formData.tenantId}
                          onChange={(e) => setFormData(prev => ({ ...prev, tenantId: e.target.value }))}
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clientId">Client ID (Application ID)</Label>
                        <Input
                          id="clientId"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={formData.clientId}
                          onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clientSecret">Client Secret</Label>
                        <Input
                          id="clientSecret"
                          type="password"
                          placeholder="Enter client secret"
                          value={formData.clientSecret}
                          onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
                          disabled={!canEdit}
                        />
                      </div>
                      
                      <Protected module="settings.integrations" action="edit">
                        <Button 
                          className="w-full" 
                          onClick={handleSaveConfig}
                          disabled={saveEntra.isPending || !formData.tenantId || !formData.clientId || !formData.clientSecret}
                        >
                          {saveEntra.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Connect Microsoft 365
                        </Button>
                      </Protected>
                    </CardContent>
                  </Card>
                </div>

                {/* Benefits Section */}
                <Card>
                  <CardHeader className="pt-0">
                    <CardTitle className="text-base">What you get with Microsoft 365 integration</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Single Sign-On</div>
                          <div className="text-xs text-muted-foreground">
                            Users sign in with their Microsoft account
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Auto Provisioning</div>
                          <div className="text-xs text-muted-foreground">
                            Users are automatically created & deactivated
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                          <RefreshCw className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Group Sync</div>
                          <div className="text-xs text-muted-foreground">
                            AD groups map to roles in the system
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Other Integrations Placeholder */}
        <Card>
          <CardHeader className="pt-0">
            <CardTitle>Other Integrations</CardTitle>
            <CardDescription>
              Additional integrations coming soon
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "Google Workspace", description: "SSO with Google accounts", status: "coming_soon" },
                { name: "Okta", description: "Enterprise identity management", status: "coming_soon" },
                { name: "Slack", description: "Notifications and workflows", status: "coming_soon" },
              ].map((integration) => (
                <div 
                  key={integration.name} 
                  className="p-4 rounded-lg border border-dashed flex items-start justify-between opacity-60"
                >
                  <div>
                    <div className="font-medium text-sm">{integration.name}</div>
                    <div className="text-xs text-muted-foreground">{integration.description}</div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Coming Soon
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
