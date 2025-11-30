import { UserCheck } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { people, policies } from "@/lib/seed-data"

const attestations = policies
  .filter((p) => p.status === "published")
  .map((policy) => ({
    policy,
    totalRequired: people.length,
    completed: Math.floor(Math.random() * people.length),
    pending: people.slice(0, Math.floor(Math.random() * 3)),
  }))

export default function AttestationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Attestations" description="Track policy acknowledgements and employee compliance.">
        <Button>
          <UserCheck className="mr-2 h-4 w-4" />
          Request Attestation
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Policies Requiring Attestation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attestations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Attestations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">8</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">87%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Attestations</CardTitle>
          <CardDescription>Track who has acknowledged each policy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {attestations.map(({ policy, totalRequired, completed, pending }) => {
            const percentage = Math.round((completed / totalRequired) * 100)
            return (
              <div key={policy.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{policy.title}</p>
                    <p className="text-xs text-muted-foreground">Version {policy.version}</p>
                  </div>
                  <StatusBadge variant={percentage === 100 ? "success" : "warning"}>
                    {completed}/{totalRequired} completed
                  </StatusBadge>
                </div>
                <Progress value={percentage} className="h-2" />
                {pending.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Pending:</span>
                    <div className="flex -space-x-2">
                      {pending.slice(0, 3).map((person) => (
                        <Avatar key={person.id} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-xs">
                            {person.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {pending.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{pending.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
