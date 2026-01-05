"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  Download,
  FileText, 
  FolderArchive,
  Info,
  KeyRound, 
  Loader2,
  Mail, 
  MapPin, 
  MoreHorizontal,
  Pencil, 
  Phone, 
  Plus,
  RefreshCw, 
  Trash2, 
  Upload,
  User,
  Briefcase,
  Shield,
  ExternalLink,
  Link2,
  HardDrive,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Box,
  CheckCircle,
} from "lucide-react"
import { toast } from "sonner"

import { FormDrawer } from "@/components/primitives/form-drawer"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Protected } from "@/components/primitives/protected"
import { FileUpload } from "@/components/primitives/file-upload"
import {
  useEntityFiles,
  useDeleteFile,
  downloadFile,
  type FileRecord,
} from "@/lib/api/files"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { usePersonDetail, useUpdatePerson, useDeletePerson } from "@/lib/api/people"
import { useAssetsList, useAssignmentsList } from "@/lib/api/assets"
import { useQuery } from "@tanstack/react-query"
import { useBreadcrumb } from "@/components/breadcrumb-context"

// Fetch Entra integration settings to check bidirectional sync
async function fetchEntraIntegrationSettings() {
  const res = await fetch("/api/settings/integrations?provider=entra")
  if (!res.ok) return null
  return res.json()
}
import { formConfig as baseFormConfig, editFormSchema, getFormFields } from "@/lib/generated/people/person/form-config"
import { personStatusVariants, type UpdatePerson } from "@/lib/generated/people/person/types"
import type { FormConfig, SyncIndicatorType } from "@/components/primitives/form-drawer"

// Edit form fields
const editFields = getFormFields("edit")

// Field mappings from People fields to Entra ID properties
// Used for sync indicators to show which Entra field each People field maps to
const ENTRA_FIELD_MAPPINGS: Record<string, string> = {
  name: "displayName",
  email: "mail",
  roleId: "jobTitle",
  teamId: "department",
  location: "officeLocation",
  phone: "mobilePhone",
  startDate: "employeeHireDate",
  hireDate: "employeeHireDate",
}

// Fields that are synced from Entra ID (must match actual property mapping)
const ENTRA_SYNCED_FIELDS = Object.keys(ENTRA_FIELD_MAPPINGS)

/**
 * Get form config with sync indicators based on person's sync state
 */
function getFormConfigWithSyncIndicators(
  isSynced: boolean,
  syncEnabled: boolean,
  isBidirectionalSyncEnabled: boolean
): FormConfig {
  // Deep copy to avoid mutating the original config
  const config: FormConfig = Object.fromEntries(
    Object.entries(baseFormConfig).map(([key, value]) => [key, { ...value }])
  ) as FormConfig
  
  if (isSynced && syncEnabled) {
    for (const fieldName of ENTRA_SYNCED_FIELDS) {
      if (config[fieldName]) {
        // Determine indicator type
        let indicator: SyncIndicatorType | undefined
        if (isBidirectionalSyncEnabled) {
          // Email never syncs back, always show as readonly from Entra
          indicator = fieldName === "email" ? "entra" : "bidirectional"
        } else {
          // All synced fields are read-only from Entra
          indicator = "entra"
        }
        config[fieldName] = {
          ...config[fieldName],
          syncIndicator: indicator,
          entraFieldName: ENTRA_FIELD_MAPPINGS[fieldName],
        }
      }
    }
  }
  
  return config
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getAssetIcon(categorySlug?: string | null): React.ReactNode {
  const iconClass = "h-3.5 w-3.5"
  const slug = categorySlug?.toLowerCase()
  
  if (slug?.includes("laptop")) return <Laptop className={iconClass} />
  if (slug?.includes("desktop") || slug?.includes("monitor")) return <Monitor className={iconClass} />
  if (slug?.includes("phone") || slug?.includes("mobile")) return <Smartphone className={iconClass} />
  if (slug?.includes("tablet") || slug?.includes("ipad")) return <Tablet className={iconClass} />
  return <Box className={iconClass} />
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return dateString
  }
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "Never"
  try {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

function timeAgo(dateString: string | null | undefined): string {
  if (!dateString) return "Never"
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 30) return `${diffDays}d ago`
    return formatDateTime(dateString)
  } catch {
    return dateString
  }
}

export default function PersonDetailPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  
  const { data: person, isLoading, error } = usePersonDetail(slug)
  const updateMutation = useUpdatePerson()
  const deleteMutation = useDeletePerson()
  const { setDetailLabel } = useBreadcrumb()
  
  // Fetch assets assigned to this person
  const { data: assignedAssets = [] } = useAssetsList(
    person?.id ? { assignedToId: person.id } : undefined
  )
  
  // Fetch assignment history for this person
  const { data: assignmentHistory = [] } = useAssignmentsList(
    person?.id ? { personId: person.id, includeReturned: true } : undefined
  )
  
  // Set breadcrumb label to person's name
  useEffect(() => {
    if (person?.name) {
      setDetailLabel(person.name)
    }
    return () => setDetailLabel(null)
  }, [person?.name, setDetailLabel])
  
  // Fetch Entra integration settings to check if bidirectional sync is enabled
  const { data: entraSettings } = useQuery({
    queryKey: ["entra-integration-settings"],
    queryFn: fetchEntraIntegrationSettings,
    staleTime: 60000, // Cache for 1 minute
  })
  
  const isBidirectionalSyncEnabled = entraSettings?.scimBidirectionalSync ?? false
  
  const handleEdit = async (values: UpdatePerson) => {
    if (!person) return
    try {
      await updateMutation.mutateAsync({ id: person.id, data: values })
      toast.success("Profile updated successfully")
      setEditOpen(false)
    } catch {
      toast.error("Failed to update profile")
    }
  }
  
  const handleDelete = async () => {
    if (!person) return
    try {
      await deleteMutation.mutateAsync(person.id)
      toast.success(`${person.name} has been removed`)
      router.push("/people/directory")
    } catch {
      toast.error("Failed to delete person")
    }
  }
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Skeleton className="h-24 w-24 rounded-full mb-4" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !person) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/people/directory">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Person Not Found</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Person not found</h2>
          <p className="text-muted-foreground mb-4">The person you are looking for does not exist.</p>
          <Button asChild>
            <Link href="/people/directory">Back to Directory</Link>
          </Button>
        </div>
      </div>
    )
  }
  
  const statusConfig = personStatusVariants[person.status]
  const isSynced = person.source === "sync"
  const hasEntraLink = person.hasEntraLink || !!person.entraId
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <Link href="/people/directory">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Directory</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{person.name}</h1>
            <p className="text-muted-foreground">{person.role} • {person.team || "No team"}</p>
          </div>
          
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {isSynced && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="gap-1 text-xs bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-0">
                      <RefreshCw className="h-3 w-3" />
                      Synced
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Last synced: {formatDateTime(person.lastSyncedAt)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {person.hasLinkedUser && (
              <Badge variant="outline" className="gap-1 text-xs">
                <KeyRound className="h-3 w-3" />
                User
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Protected module="people.directory" action="edit">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Protected>
          <Protected module="people.directory" action="delete">
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </Protected>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4 ring-4 ring-background shadow-lg">
                <AvatarImage src={person.avatar} alt={person.name} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">{getInitials(person.name)}</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{person.name}</h2>
              <p className="text-sm text-muted-foreground">{person.role}</p>
              
              {/* Status and Integration Badges */}
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                <Badge variant={statusConfig.variant}>
                  {statusConfig.label}
                </Badge>
                {isSynced && (
                  <Badge className="gap-1 text-xs bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-0">
                    <RefreshCw className="h-3 w-3" />
                    Sync
                  </Badge>
                )}
                {person.hasLinkedUser && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <KeyRound className="h-3 w-3" />
                    User
                  </Badge>
                )}
                {hasEntraLink && (
                  <Badge className="gap-1 text-xs bg-[#0078D4]/10 text-[#0078D4] dark:bg-[#0078D4]/20 dark:text-[#4DA6FF] border-0">
                    <Building2 className="h-3 w-3" />
                    Entra
                  </Badge>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${person.email}`} className="truncate hover:text-primary hover:underline">
                  {person.email}
                </a>
              </div>
              {person.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${person.phone}`} className="hover:text-primary hover:underline">
                    {person.phone}
                  </a>
                </div>
              )}
              {person.team && (
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{person.team}</span>
                </div>
              )}
              {person.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{person.location}</span>
                </div>
              )}
              {person.manager && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Link 
                    href={`/people/directory/${person.manager.slug}`}
                    className="hover:text-primary hover:underline"
                  >
                    {person.manager.name}
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Started {formatDate(person.hireDate || person.startDate)}</span>
              </div>
              {person.endDate && (
                <div className="flex items-center gap-3 text-sm text-amber-600 dark:text-amber-400">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Ends {formatDate(person.endDate)}</span>
                </div>
              )}
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{assignedAssets.length}</p>
                <p className="text-xs text-muted-foreground">Assets</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Tasks</p>
              </div>
            </div>
            
            {/* Assigned Devices/Assets */}
            {assignedAssets.length > 0 && (
              <>
                <Separator className="my-6" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <HardDrive className="h-4 w-4" />
                    <span>Devices & Assets</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedAssets.slice(0, 5).map((asset) => (
                      <TooltipProvider key={asset.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link 
                              href={`/assets/inventory/${asset.id}`}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted border text-xs transition-colors"
                            >
                              {getAssetIcon(asset.category?.slug)}
                              <span className="font-medium">{asset.assetTag}</span>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium">{asset.name}</p>
                              {asset.manufacturer && asset.model && (
                                <p className="text-xs text-muted-foreground">{asset.manufacturer} {asset.model}</p>
                              )}
                              {asset.source === "intune_sync" && (
                                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                  <RefreshCw className="h-3 w-3" />
                                  <span>Synced from Intune</span>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                    {assignedAssets.length > 5 && (
                      <Link
                        href={`/assets/inventory?assignedToId=${person.id}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs transition-colors"
                      >
                        +{assignedAssets.length - 5} more
                      </Link>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              {/* Employment Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Person ID</p>
                    <p className="font-medium text-sm">{person.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Department / Team</p>
                    <p className="font-medium">{person.team || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role / Position</p>
                    <p className="font-medium">{person.role}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{person.location || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Manager</p>
                    <p className="font-medium">
                      {person.manager ? (
                        <Link 
                          href={`/people/directory/${person.manager.slug}`}
                          className="hover:text-primary hover:underline"
                        >
                          {person.manager.name}
                        </Link>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hire Date</p>
                    <p className="font-medium">{person.hireDate ? formatDate(person.hireDate) : "—"}</p>
                  </div>
                  {person.endDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">End Date</p>
                      <p className="font-medium">{formatDate(person.endDate)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Data Source</p>
                    <p className="font-medium flex items-center gap-2">
                      {isSynced ? (
                        <>
                          <RefreshCw className="h-3 w-3 text-emerald-500" />
                          Synced from Entra
                        </>
                      ) : (
                        "Manual Entry"
                      )}
                    </p>
                  </div>
                  {isSynced && person.entraGroupName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Entra Group</p>
                      <p className="font-medium">{person.entraGroupName}</p>
                    </div>
                  )}
                  {hasEntraLink && person.entraCreatedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Created in Entra</p>
                      <p className="font-medium">{formatDateTime(person.entraCreatedAt)}</p>
                    </div>
                  )}
                  {hasEntraLink && person.lastSignInAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Sign-In</p>
                      <p className="font-medium">{timeAgo(person.lastSignInAt)}</p>
                    </div>
                  )}
                  {hasEntraLink && person.lastPasswordChangeAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Password Changed</p>
                      <p className="font-medium">{timeAgo(person.lastPasswordChangeAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Record Created</p>
                    <p className="font-medium">{formatDate(person.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{timeAgo(person.updatedAt)}</p>
                  </div>
                  {isSynced && person.lastSyncedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Synced</p>
                      <p className="font-medium">{formatDateTime(person.lastSyncedAt)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bio */}
              {person.bio && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Bio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{person.bio}</p>
                  </CardContent>
                </Card>
              )}

              {/* Linked User Account */}
              {person.linkedUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      Linked User Account
                    </CardTitle>
                    <CardDescription>
                      This person has a system user account for accessing IdaraOS
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{getInitials(person.linkedUser.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{person.linkedUser.name}</p>
                          <p className="text-xs text-muted-foreground">{person.linkedUser.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={person.linkedUser.status === "active" ? "default" : "secondary"}>
                          {person.linkedUser.status}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/settings/users">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Assigned Assets */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Assigned Assets
                  </CardTitle>
                  <CardDescription>
                    Devices and equipment assigned to this person
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assignedAssets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Box className="mx-auto h-8 w-8 mb-2" />
                      <p>No assets assigned</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assignedAssets.map((asset) => (
                        <Link
                          key={asset.id}
                          href={`/assets/inventory/${asset.id}`}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              {getAssetIcon(asset.category?.slug)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{asset.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {asset.assetTag}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {asset.manufacturer && asset.model 
                                  ? `${asset.manufacturer} ${asset.model}`
                                  : asset.category?.name || "Uncategorized"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {asset.source === "intune_sync" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="gap-1 text-xs bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-0">
                                      <RefreshCw className="h-3 w-3" />
                                      Intune
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Managed by Microsoft Intune
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {asset.assignedAt && (
                              <span className="text-xs text-muted-foreground">
                                Since {formatDate(asset.assignedAt)}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="mt-4 space-y-4">
              {/* Entra ID / Microsoft Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Microsoft Entra ID
                  </CardTitle>
                  <CardDescription>
                    Sync status and identity management integration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasEntraLink ? (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <RefreshCw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="font-medium text-emerald-700 dark:text-emerald-300">Synced from Entra ID</p>
                          <p className="text-sm text-emerald-600 dark:text-emerald-400">
                            This record is synchronized with Microsoft Entra ID
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Entra ID</p>
                          <p className="text-xs truncate">{person.entraId || "—"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Source Group</p>
                          <p className="font-medium text-sm">{person.entraGroupName || "—"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Last Synced</p>
                          <p className="font-medium text-sm">{formatDateTime(person.lastSyncedAt)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sync Enabled</p>
                          <Badge variant={person.syncEnabled ? "default" : "secondary"}>
                            {person.syncEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        {person.entraCreatedAt && (
                          <div>
                            <p className="text-sm text-muted-foreground">Created in Entra</p>
                            <p className="font-medium text-sm">{formatDateTime(person.entraCreatedAt)}</p>
                          </div>
                        )}
                        {person.lastSignInAt && (
                          <div>
                            <p className="text-sm text-muted-foreground">Last Sign-In</p>
                            <p className="font-medium text-sm">{timeAgo(person.lastSignInAt)}</p>
                          </div>
                        )}
                        {person.lastPasswordChangeAt && (
                          <div>
                            <p className="text-sm text-muted-foreground">Password Changed</p>
                            <p className="font-medium text-sm">{timeAgo(person.lastPasswordChangeAt)}</p>
                          </div>
                        )}
                      </div>

                      {person.syncEnabled && (
                        <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <AlertDescription className="text-blue-700 dark:text-blue-300">
                            Changes to this record may be overwritten during the next sync. 
                            To preserve manual changes, disable sync in People Settings.
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Link2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="font-medium">Not Synced</p>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        This person was created manually and is not linked to Microsoft Entra ID.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Linked User (if any) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    System Access
                  </CardTitle>
                  <CardDescription>
                    User account for IdaraOS access
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {person.linkedUser ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{getInitials(person.linkedUser.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{person.linkedUser.name}</p>
                            <p className="text-xs text-muted-foreground">{person.linkedUser.email}</p>
                          </div>
                        </div>
                        <Badge variant={person.linkedUser.status === "active" ? "default" : "secondary"}>
                          {person.linkedUser.status}
                        </Badge>
                      </div>
                      {person.linkedUser.hasEntraLink && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>User account is linked to Entra ID for SSO</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <User className="h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="font-medium">No User Account</p>
                      <p className="text-sm text-muted-foreground max-w-xs mb-4">
                        This person does not have a user account to access IdaraOS.
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/settings/users">
                          Create User Account
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <PersonFilesTab personId={person.id} personName={person.name} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activity Log</CardTitle>
                  <CardDescription>Recent activity and changes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Combine and sort all events */}
                    {(() => {
                      // Build event list
                      const events: Array<{
                        id: string
                        type: "sync" | "update" | "create" | "start" | "asset_assigned" | "asset_returned"
                        date: Date
                        label: string
                        sublabel?: string
                        icon: string
                      }> = []
                      
                      // Sync events
                      if (isSynced && person.lastSyncedAt) {
                        events.push({
                          id: "sync",
                          type: "sync",
                          date: new Date(person.lastSyncedAt),
                          label: "Synced from Entra ID",
                          icon: "emerald",
                        })
                      }
                      
                      // Record events
                      events.push({
                        id: "update",
                        type: "update",
                        date: new Date(person.updatedAt),
                        label: "Record updated",
                        icon: "blue",
                      })
                      
                      events.push({
                        id: "create",
                        type: "create",
                        date: new Date(person.createdAt),
                        label: "Record created",
                        icon: "gray",
                      })
                      
                      if (person.startDate) {
                        events.push({
                          id: "start",
                          type: "start",
                          date: new Date(person.startDate),
                          label: "Employment started",
                          icon: "green",
                        })
                      }
                      
                      // Asset assignments
                      assignmentHistory.forEach((assignment) => {
                        events.push({
                          id: `assigned-${assignment.id}`,
                          type: "asset_assigned",
                          date: new Date(assignment.assignedAt),
                          label: `Device assigned: ${assignment.asset.assetTag}`,
                          sublabel: assignment.asset.name,
                          icon: "cyan",
                        })
                        
                        if (assignment.returnedAt) {
                          events.push({
                            id: `returned-${assignment.id}`,
                            type: "asset_returned",
                            date: new Date(assignment.returnedAt),
                            label: `Device returned: ${assignment.asset.assetTag}`,
                            sublabel: assignment.asset.name,
                            icon: "orange",
                          })
                        }
                      })
                      
                      // Sort by date descending
                      events.sort((a, b) => b.date.getTime() - a.date.getTime())
                      
                      // Icon colors
                      const iconColors: Record<string, string> = {
                        emerald: "bg-emerald-500",
                        blue: "bg-blue-500",
                        gray: "bg-gray-400",
                        green: "bg-green-500",
                        cyan: "bg-cyan-500",
                        orange: "bg-orange-500",
                      }
                      
                      return events.slice(0, 20).map((event) => (
                        <div key={event.id} className="flex gap-3">
                          <div className={`h-2 w-2 rounded-full ${iconColors[event.icon]} mt-2`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm">{event.label}</p>
                              {(event.type === "asset_assigned" || event.type === "asset_returned") && (
                                <HardDrive className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            {event.sublabel && (
                              <p className="text-xs text-muted-foreground">{event.sublabel}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(event.date.toISOString())}
                            </p>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Drawer */}
      <FormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Edit ${person.name}`}
        description={
          isSynced && person.syncEnabled
            ? isBidirectionalSyncEnabled
              ? "Changes will be synced back to Entra ID (except email)"
              : "Some fields are managed by Entra ID sync"
            : "Update employee information"
        }
        schema={editFormSchema}
        config={getFormConfigWithSyncIndicators(isSynced, person.syncEnabled || false, isBidirectionalSyncEnabled)}
        fields={editFields}
        mode="edit"
        defaultValues={{
          name: person.name,
          email: person.email,
          roleId: person.roleId || "",
          teamId: person.teamId || "",
          status: person.status,
          startDate: person.startDate,
          hireDate: person.hireDate || "",
          endDate: person.endDate || "",
          phone: person.phone || "",
          location: person.location || "",
          bio: person.bio || "",
        }}
        onSubmit={handleEdit}
        // Disable synced fields ONLY if sync is enabled AND bidirectional sync is disabled
        // Email is always disabled for synced users (email changes don't sync to Entra)
        // roleId and teamId are local references, but their derived text values sync
        disabledFields={
          isSynced && person.syncEnabled
            ? isBidirectionalSyncEnabled
              ? ["email"] // Only email is disabled when bidirectional sync is enabled
              : ["name", "email", "roleId", "teamId", "startDate", "hireDate", "location", "phone"] // All synced fields disabled
            : []
        }
        infoBanner={
          isSynced && person.syncEnabled ? (
            isBidirectionalSyncEnabled ? (
              <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                <RefreshCw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription className="text-emerald-700 dark:text-emerald-300 text-sm">
                  Bidirectional sync is enabled. Fields marked with a sync icon will sync back to Entra ID.
                  Email cannot be changed here as it&apos;s always managed in Entra ID.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                  This person is synced from Entra ID ({person.entraGroupName || "group"}). 
                  Fields marked with a lock icon are managed by Entra ID and cannot be edited here.
                </AlertDescription>
              </Alert>
            )
          ) : undefined
        }
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {person.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee
              record and remove all associated data from the system.
              {isSynced && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ This person was synced from Entra ID. They may be recreated during the next sync 
                  unless removed from the source group.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================================
// Person Files Tab Component
// ============================================================================

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface PersonFilesTabProps {
  personId: string
  personName: string
}

function PersonFilesTab({ personId, personName }: PersonFilesTabProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileRecord | null>(null)
  
  const { data: filesData, isLoading } = useEntityFiles("person", personId)
  const deleteMutation = useDeleteFile()
  
  const files = filesData?.data ?? []
  
  const handleDownload = async (file: FileRecord) => {
    try {
      await downloadFile(file.id, file.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download file")
    }
  }
  
  const handleViewInStorage = (file: FileRecord) => {
    if (file.webUrl) {
      window.open(file.webUrl, "_blank", "noopener,noreferrer")
    } else {
      toast.error("Storage URL not available for this file")
    }
  }
  
  const getStorageProviderLabel = (provider?: string): string => {
    switch (provider) {
      case "sharepoint": return "SharePoint"
      case "azure_blob": return "Azure Blob"
      case "local": return "Local Storage"
      default: return "Storage"
    }
  }
  
  const handleDelete = async () => {
    if (!deletingFile) return
    try {
      await deleteMutation.mutateAsync(deletingFile.id)
      toast.success("File deleted successfully")
      setDeletingFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file")
    }
  }
  
  const handleUploadComplete = () => {
    setShowUploadDialog(false)
    toast.success("Files uploaded successfully")
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Files</CardTitle>
              <CardDescription>Documents and records for {personName}</CardDescription>
            </div>
            <Protected module="filing.files" action="create">
              <Button onClick={() => setShowUploadDialog(true)} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </Protected>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderArchive className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No Files</p>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                Upload documents such as CVs, contracts, and certifications.
              </p>
              <Protected module="filing.files" action="create">
                <Button onClick={() => setShowUploadDialog(true)} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload First File
                </Button>
              </Protected>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {file.category && (
                        <Badge variant="outline" className="text-xs">
                          {file.category.name}
                        </Badge>
                      )}
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(file)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      {file.webUrl && (
                        <DropdownMenuItem onClick={() => handleViewInStorage(file)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View in {getStorageProviderLabel(file.storageProvider)}
                        </DropdownMenuItem>
                      )}
                      <Protected module="filing.files" action="delete">
                        <DropdownMenuItem
                          onClick={() => setDeletingFile(file)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </Protected>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              
              <div className="pt-2 text-center">
                <Button variant="link" size="sm" asChild>
                  <Link href={`/people/filing?entityId=${personId}`}>
                    View All Files →
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Upload documents for {personName}
            </DialogDescription>
          </DialogHeader>
          <FileUpload
            moduleScope="people"
            entityType="person"
            entityId={personId}
            multiple
            maxFiles={5}
            onUpload={handleUploadComplete}
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <Dialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingFile?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFile(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
