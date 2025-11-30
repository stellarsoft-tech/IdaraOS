"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Calendar, FileText, HardDrive, Mail, MapPin, Pencil, Trash2, Phone, User } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Protected } from "@/components/primitives/protected"
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

import { usePersonDetail, useUpdatePerson, useDeletePerson } from "@/lib/api/people"
import { formConfig, editFormSchema, getFormFields } from "@/lib/generated/people/person/form-config"

// Edit form fields
const editFields = getFormFields("edit")
import { personStatusVariants, type UpdatePerson } from "@/lib/generated/people/person/types"
import { assets } from "@/lib/seed-data"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateString: string): string {
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

export default function PersonDetailPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  
  const { data: person, isLoading, error } = usePersonDetail(slug)
  const updateMutation = useUpdatePerson()
  const deleteMutation = useDeletePerson()
  
  // Get assets for this person
  const personAssets = person ? assets.filter((a) => a.owner === person.name) : []
  
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
      <PageShell title="Loading...">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Skeleton className="h-20 w-20 rounded-full mb-4" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </PageShell>
    )
  }
  
  if (error || !person) {
    return (
      <PageShell title="Not Found">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Person not found</h2>
          <p className="text-muted-foreground mb-4">The person you are looking for does not exist.</p>
          <Button asChild>
            <Link href="/people/directory">Back to Directory</Link>
          </Button>
        </div>
      </PageShell>
    )
  }
  
  const statusConfig = personStatusVariants[person.status]
  
  return (
    <PageShell
      title={person.name}
      description={`${person.role} • ${person.team || "No team"}`}
      action={
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
      }
    >
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/people/directory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 mb-4">
                <AvatarImage src={person.avatar} alt={person.name} />
                <AvatarFallback className="text-2xl">{getInitials(person.name)}</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{person.name}</h2>
              <p className="text-sm text-muted-foreground">{person.role}</p>
              <Badge variant={statusConfig.variant} className="mt-2">
                {statusConfig.label}
              </Badge>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{person.email}</span>
              </div>
              {person.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{person.phone}</span>
                </div>
              )}
              {person.team && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{person.team} Team</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Started {formatDate(person.startDate)}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-medium mb-2">Quick Stats</p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{person.assignedAssets}</p>
                  <p className="text-xs text-muted-foreground">Assets</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Employee ID</p>
                    <p className="font-medium font-mono">EMP-{person.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{person.team || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{formatDate(person.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{person.location || "—"}</p>
                  </div>
                  {person.endDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">End Date</p>
                      <p className="font-medium">{formatDate(person.endDate)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {person.bio && (
                <Card>
                  <CardHeader>
                    <CardTitle>Bio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{person.bio}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Assigned Assets
                  </CardTitle>
                  <CardDescription>{personAssets.length} assets assigned</CardDescription>
                </CardHeader>
                <CardContent>
                  {personAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assets assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {personAssets.slice(0, 3).map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{asset.model}</p>
                            <p className="text-xs text-muted-foreground">{asset.tag}</p>
                          </div>
                          <Badge variant="outline">{asset.type}</Badge>
                        </div>
                      ))}
                      {personAssets.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{personAssets.length - 3} more assets
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assets" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Asset History</CardTitle>
                  <CardDescription>All assets currently and previously assigned</CardDescription>
                </CardHeader>
                <CardContent>
                  {personAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assets assigned</p>
                  ) : (
                    <div className="space-y-4">
                      {personAssets.map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <HardDrive className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{asset.model}</p>
                              <p className="text-xs text-muted-foreground">
                                {asset.tag} • {asset.type}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="default">Active</Badge>
                            <p className="text-xs text-muted-foreground mt-1">Warranty: {asset.warrantyEnd}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>Employee documents and records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Employment Contract</p>
                          <p className="text-xs text-muted-foreground">
                            Signed {formatDate(person.startDate)}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">View</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">NDA</p>
                          <p className="text-xs text-muted-foreground">
                            Signed {formatDate(person.startDate)}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">View</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Log</CardTitle>
                  <CardDescription>Recent activity for this employee</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <p className="text-sm">Profile viewed</p>
                        <p className="text-xs text-muted-foreground">Just now</p>
                      </div>
                    </div>
                    {personAssets.length > 0 && (
                      <div className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                        <div>
                          <p className="text-sm">{personAssets.length} asset(s) assigned</p>
                          <p className="text-xs text-muted-foreground">Recently</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Account created</p>
                        <p className="text-xs text-muted-foreground">{formatDate(person.startDate)}</p>
                      </div>
                    </div>
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
        description="Update employee information"
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
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {person.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee
              record and remove all associated data from the system.
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
    </PageShell>
  )
}

