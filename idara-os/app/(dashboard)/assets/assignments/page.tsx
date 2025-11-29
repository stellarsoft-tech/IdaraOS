import { ArrowLeftRight, CheckCircle, User } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { assets, people } from "@/lib/seed-data"

export default function AssignmentsPage() {
  const assignedAssets = assets.filter((a) => a.status === "assigned" && a.owner)

  const assignmentsByPerson = people
    .map((person) => ({
      person,
      assets: assets.filter((a) => a.owner === person.name),
    }))
    .filter((p) => p.assets.length > 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" description="View and manage asset assignments to people.">
        <Button>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          New Assignment
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedAssets.length}</div>
            <p className="text-xs text-muted-foreground">of {assets.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">People with Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignmentsByPerson.length}</div>
            <p className="text-xs text-muted-foreground">of {people.length} employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. per Person</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(assignedAssets.length / assignmentsByPerson.length || 0).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">assets assigned</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignments by Person</CardTitle>
          <CardDescription>All current asset assignments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {assignmentsByPerson.map(({ person, assets: personAssets }) => (
            <div key={person.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {person.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.role} • {person.team}
                  </p>
                </div>
              </div>
              <div className="ml-11 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {personAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center gap-2 p-2 rounded-lg border">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">{asset.tag}</p>
                      <p className="text-xs text-muted-foreground">{asset.model}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {assignmentsByPerson.length === 0 && (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No assets are currently assigned.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
