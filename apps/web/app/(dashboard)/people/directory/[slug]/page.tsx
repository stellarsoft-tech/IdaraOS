"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  FileText, 
  HardDrive, 
  Info,
  KeyRound, 
  Mail, 
  MapPin, 
  Pencil, 
  Phone, 
  RefreshCw, 
  Trash2, 
  User,
  Clock,
  Briefcase,
  Shield,
  ExternalLink,
  Link2,
  AlertTriangle
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
import { formConfig, editFormSchema, getFormFields } from "@/lib/generated/people/person/form-config"
import { personStatusVariants, type UpdatePerson } from "@/lib/generated/people/person/types"

// Edit form fields
const editFields = getFormFields("edit")

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
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
          <Button variant="ghost" size="icon" asChild>
            <Link href="/people/directory">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          
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
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Started {formatDate(person.startDate)}</span>
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
                <p className="text-2xl font-bold">{person.assignedAssets}</p>
                <p className="text-xs text-muted-foreground">Assets</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Tasks</p>
              </div>
            </div>
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
                    <p className="font-medium font-mono text-sm">{person.id.slice(0, 8).toUpperCase()}</p>
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
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{formatDate(person.startDate)}</p>
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
                          <p className="font-mono text-xs truncate">{person.entraId || "—"}</p>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documents</CardTitle>
                  <CardDescription>Employee documents and records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="font-medium">No Documents</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Document management will be available in a future update.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activity Log</CardTitle>
                  <CardDescription>Recent activity and changes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isSynced && person.lastSyncedAt && (
                      <div className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2" />
                        <div>
                          <p className="text-sm">Synced from Entra ID</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(person.lastSyncedAt)}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Record updated</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(person.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-gray-400 mt-2" />
                      <div>
                        <p className="text-sm">Record created</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(person.createdAt)}</p>
                      </div>
                    </div>
                    {person.startDate && (
                      <div className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                        <div>
                          <p className="text-sm">Employment started</p>
                          <p className="text-xs text-muted-foreground">{formatDate(person.startDate)}</p>
                        </div>
                      </div>
                    )}
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
        description={isSynced && person.syncEnabled
          ? "Some fields are managed by Entra ID sync"
          : "Update employee information"
        }
        schema={editFormSchema}
        config={formConfig}
        fields={editFields}
        mode="edit"
        defaultValues={{
          name: person.name,
          email: person.email,
          role: person.role,
          team: person.team || "",
          status: person.status,
          startDate: person.startDate,
          endDate: person.endDate || "",
          phone: person.phone || "",
          location: person.location || "",
          bio: person.bio || "",
        }}
        onSubmit={handleEdit}
        // Disable synced fields for people from Entra
        disabledFields={
          isSynced && person.syncEnabled
            ? ["name", "email", "role", "team", "startDate", "location", "phone"]
            : []
        }
        infoBanner={
          isSynced && person.syncEnabled ? (
            <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                This person is synced from Entra ID ({person.entraGroupName || "group"}). 
                Synced fields cannot be edited here.
              </AlertDescription>
            </Alert>
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
