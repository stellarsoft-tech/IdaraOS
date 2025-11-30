import { ChevronRight, Plus, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { people, roles, teams } from "@/lib/seed-data"

export default function RolesPage() {
  const teamData = teams.map((team) => ({
    name: team,
    members: people.filter((p) => p.team === team),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Teams"
        description="Manage your organizational structure, teams, and role definitions."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Team
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>Organizational teams and their members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamData.map((team) => (
              <div
                key={team.name}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.members.length} {team.members.length === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Catalog</CardTitle>
            <CardDescription>Defined roles in your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((role) => {
              const count = people.filter((p) => p.role === role).length
              return (
                <div
                  key={role}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-medium">{role}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} {count === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
