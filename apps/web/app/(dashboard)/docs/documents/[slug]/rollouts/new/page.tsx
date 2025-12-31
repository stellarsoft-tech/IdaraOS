"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Calendar, Globe, Loader2, Save, Shield, User, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
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
import { useDocument, useCreateRollout } from "@/lib/api/docs"
import { useTeamsList, Team } from "@/lib/api/teams"
import { useRoles, Role } from "@/lib/api/rbac"
import { usePeopleList, Person } from "@/lib/api/people"
import type { RolloutTargetType, RolloutRequirement } from "@/lib/docs/types"
import { toast } from "sonner"

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

export default function NewRolloutPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const { data: docData, isLoading: docLoading } = useDocument(slug)
  const createRollout = useCreateRollout()
  
  // Load target options
  const { data: teams = [] } = useTeamsList()
  const { data: roles = [] } = useRoles()
  const { data: people = [] } = usePeopleList()
  
  const doc = docData?.data
  
  // Generate default name with current date in dd/mm/yy format
  const defaultRolloutName = React.useMemo(() => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, "0")
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const year = String(now.getFullYear()).slice(-2)
    return `Rollout - ${day}/${month}/${year}`
  }, [])
  
  // Form state
  const [name, setName] = React.useState<string>(defaultRolloutName)
  const [targetType, setTargetType] = React.useState<RolloutTargetType>("organization")
  const [targetId, setTargetId] = React.useState<string>("")
  const [requirement, setRequirement] = React.useState<RolloutRequirement>("required")
  const [dueDate, setDueDate] = React.useState<string>("")
  const [sendNotification, setSendNotification] = React.useState(true)
  const [reminderFrequencyDays, setReminderFrequencyDays] = React.useState<string>("7")
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!doc) return
    
    // Validate target selection for non-org rollouts
    if (targetType !== "organization" && !targetId) {
      toast.error(`Please select a ${targetType}`)
      return
    }
    
    try {
      await createRollout.mutateAsync({
        documentId: doc.id,
        name: name || defaultRolloutName,
        targetType,
        targetId: targetType === "organization" ? undefined : targetId,
        requirement,
        dueDate: dueDate || undefined,
        isActive: true,
        sendNotification,
        reminderFrequencyDays: reminderFrequencyDays ? parseInt(reminderFrequencyDays) : undefined,
      })
      
      toast.success("Rollout created successfully")
      router.push(`/docs/documents/${slug}`)
    } catch (error) {
      toast.error("Failed to create rollout")
    }
  }
  
  if (docLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Document not found</p>
        <Button asChild>
          <Link href="/docs/documents">Back to Documents</Link>
        </Button>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/docs/documents/${slug}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Rollout</h1>
          <p className="text-sm text-muted-foreground">{`Configure rollout for "${doc.title}"`}</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Rollout Name */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Rollout Name</CardTitle>
              <CardDescription>
                Give this rollout a descriptive name for easy identification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="rolloutName">Name</Label>
                <Input
                  id="rolloutName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={defaultRolloutName}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to &quot;Rollout - dd/mm/yy&quot; if left empty
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Target Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
              <CardDescription>
                Select who needs to read and acknowledge this document
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
              
              {/* Target Selector */}
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
                      {people.map((person: Person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name} ({person.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>
                Define how users should interact with this document
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
              
              {/* Due Date */}
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
                  Leave empty for no deadline
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Notifications */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how users are notified about this rollout
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Send Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify users via email when this rollout is created
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
                    Send reminders this often until the due date
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button variant="outline" asChild>
            <Link href={`/docs/documents/${slug}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={createRollout.isPending}>
            {createRollout.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            Create Rollout
          </Button>
        </div>
      </form>
    </div>
  )
}

