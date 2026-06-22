"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, FileText, Globe, Loader2, Save, Shield, User, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDocument, useDocuments, useCreateRollout } from "@/lib/api/docs"
import { useTeamsList, type Team } from "@/lib/api/teams"
import { useRoles, type Role } from "@/lib/api/rbac"
import { useUsersList } from "@/lib/api/users"
import type { RolloutTargetType, RolloutRequirement } from "@/lib/docs/types"

const targetTypeConfig: Record<RolloutTargetType, { label: string; description: string; icon: React.ElementType }> = {
  organization: {
    label: "Entire Organization",
    description: "Roll out to all users in the organization",
    icon: Globe,
  },
  team: {
    label: "Specific Team",
    description: "Roll out to members of a specific team",
    icon: Users,
  },
  role: {
    label: "Specific Role",
    description: "Roll out to users with a specific role",
    icon: Shield,
  },
  user: {
    label: "Specific User",
    description: "Roll out to a specific individual",
    icon: User,
  },
}

const requirementConfig: Record<RolloutRequirement, { label: string; description: string }> = {
  optional: {
    label: "Optional",
    description: "Users are encouraged to read but not required to acknowledge",
  },
  required: {
    label: "Required",
    description: "Users must acknowledge they have read the document",
  },
  required_with_signature: {
    label: "Required with Signature",
    description: "Users must sign to confirm understanding and agreement",
  },
}

interface NewRolloutFormProps {
  initialDocumentSlug?: string
  backHref?: string
}

export function NewRolloutForm({
  initialDocumentSlug,
  backHref = "/docs/documents",
}: NewRolloutFormProps) {
  const router = useRouter()
  const createRollout = useCreateRollout()

  const [selectedDocument, setSelectedDocument] = React.useState(initialDocumentSlug ?? "")
  const [name, setName] = React.useState("")
  const [hasSetInitialName, setHasSetInitialName] = React.useState(false)
  const [targetType, setTargetType] = React.useState<RolloutTargetType>("organization")
  const [targetId, setTargetId] = React.useState("")
  const [requirement, setRequirement] = React.useState<RolloutRequirement>("required")
  const [dueDate, setDueDate] = React.useState("")
  const [sendNotification, setSendNotification] = React.useState(true)
  const [reminderFrequencyDays, setReminderFrequencyDays] = React.useState("7")

  const { data: documentsData, isLoading: documentsLoading } = useDocuments({ limit: 500 })
  const { data: docData, isLoading: docLoading } = useDocument(selectedDocument || undefined)
  const { data: teams = [] } = useTeamsList()
  const { data: roles = [] } = useRoles()
  const { data: users = [] } = useUsersList()

  const documents = documentsData?.data ?? []
  const doc = docData?.data

  const generateDefaultName = React.useCallback((docTitle?: string, docVersion?: string) => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, "0")
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const year = now.getFullYear()
    const dateStr = `${day}/${month}/${year}`

    if (docTitle) {
      const versionStr = docVersion ? ` v${docVersion}` : ""
      return `${docTitle}${versionStr} Rollout - ${dateStr}`
    }

    return `Rollout - ${dateStr}`
  }, [])

  React.useEffect(() => {
    setSelectedDocument(initialDocumentSlug ?? "")
    setHasSetInitialName(false)
  }, [initialDocumentSlug])

  React.useEffect(() => {
    if (doc && !hasSetInitialName) {
      setName(generateDefaultName(doc.title, doc.currentVersion))
      setHasSetInitialName(true)
    }
  }, [doc, hasSetInitialName, generateDefaultName])

  const handleDocumentChange = (value: string) => {
    setSelectedDocument(value)
    setName("")
    setHasSetInitialName(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!doc) {
      toast.error("Please select a document")
      return
    }

    if (targetType !== "organization" && !targetId) {
      toast.error(`Please select a ${targetType}`)
      return
    }

    try {
      const result = await createRollout.mutateAsync({
        documentId: doc.id,
        name: name || generateDefaultName(doc.title, doc.currentVersion),
        targetType,
        targetId: targetType === "organization" ? undefined : targetId,
        requirement,
        dueDate: dueDate || undefined,
        isActive: true,
        sendNotification,
        reminderFrequencyDays: reminderFrequencyDays ? parseInt(reminderFrequencyDays, 10) : undefined,
      })

      if (result.message) {
        toast.success(result.message)
      } else {
        toast.success("Rollout created successfully")
      }
      router.push(`/docs/documents/${doc.slug}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create rollout")
    }
  }

  const isLoadingDocument = !!selectedDocument && docLoading
  const pageBackHref = doc ? `/docs/documents/${doc.slug}` : backHref

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={pageBackHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Rollout</h1>
          <p className="text-sm text-muted-foreground">
            {doc ? `Configure rollout for "${doc.title}"` : "Select a document and configure its rollout"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Document</CardTitle>
              <CardDescription>
                Choose the document that should be rolled out for reading or acknowledgment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xl space-y-2">
                <Label>Document</Label>
                <Select
                  value={selectedDocument}
                  onValueChange={handleDocumentChange}
                  disabled={documentsLoading || !!initialDocumentSlug}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={documentsLoading ? "Loading documents..." : "Choose a document..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((document) => (
                      <SelectItem key={document.id} value={document.slug}>
                        {document.title} {document.currentVersion ? `v${document.currentVersion}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingDocument && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading selected document...
                  </p>
                )}
                {selectedDocument && !doc && !docLoading && (
                  <p className="text-xs text-destructive">Document not found. Choose another document.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Rollout Name</CardTitle>
              <CardDescription>
                Give this rollout a descriptive name for easy identification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="rolloutName">Name</Label>
                <Input
                  id="rolloutName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={doc ? generateDefaultName(doc.title, doc.currentVersion) : "Select a document first"}
                  className="max-w-md"
                  disabled={!doc}
                />
                <p className="text-xs text-muted-foreground">
                  Format: &quot;Document Name vX.X Rollout - dd/mm/yyyy&quot;
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
              <CardDescription>
                Select who needs to read and acknowledge this document.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={targetType}
                onValueChange={(value) => {
                  setTargetType(value as RolloutTargetType)
                  setTargetId("")
                }}
                className="space-y-3"
              >
                {Object.entries(targetTypeConfig).map(([value, config]) => {
                  const Icon = config.icon
                  return (
                    <label
                      key={value}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        targetType === value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={value} className="mt-1" />
                      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">{config.label}</p>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                    </label>
                  )
                })}
              </RadioGroup>

              {targetType === "team" && (
                <div className="space-y-2">
                  <Label>Select Team</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team: Team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {targetType === "role" && (
                <div className="space-y-2">
                  <Label>Select Role</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role: Role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {targetType === "user" && (
                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>
                Define how users should interact with this document.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={requirement}
                onValueChange={(value) => setRequirement(value as RolloutRequirement)}
                className="space-y-3"
              >
                {Object.entries(requirementConfig).map(([value, config]) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      requirement === value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value={value} className="mt-1" />
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty for no deadline.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how users are notified about this rollout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Send Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify users via email when this rollout is created.
                  </p>
                </div>
                <Switch
                  checked={sendNotification}
                  onCheckedChange={setSendNotification}
                />
              </div>

              {sendNotification && dueDate && (
                <div className="space-y-2">
                  <Label htmlFor="reminderDays">Reminder Frequency (days)</Label>
                  <Input
                    id="reminderDays"
                    type="number"
                    min="1"
                    value={reminderFrequencyDays}
                    onChange={(e) => setReminderFrequencyDays(e.target.value)}
                    placeholder="7"
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Send reminders this often until the due date.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-end gap-4 mt-6">
          <Button variant="outline" asChild>
            <Link href={pageBackHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={!doc || createRollout.isPending}>
            {createRollout.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Create Rollout
          </Button>
        </div>
      </form>

      {!documentsLoading && documents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No documents available</p>
            <p className="text-sm text-muted-foreground">
              Create a document before creating a rollout.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
