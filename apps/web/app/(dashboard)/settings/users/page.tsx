import { MoreHorizontal, Plus, Shield, UserCog } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { people } from "@/lib/seed-data"

const roles = [
  { name: "Admin", description: "Full system access", users: 2 },
  { name: "Manager", description: "Department-level access", users: 2 },
  { name: "User", description: "Standard access", users: 2 },
]

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Users & Access" description="Manage user accounts and role-based access control.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {role.name}
              </CardTitle>
              <CardDescription className="text-xs">{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{role.users}</div>
              <p className="text-xs text-muted-foreground">users</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user accounts and their permissions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {people.map((person, index) => (
            <div key={person.id} className="flex items-center justify-between p-3 rounded-lg border">
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
                  <p className="text-sm text-muted-foreground">{person.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge variant={index < 2 ? "purple" : index < 4 ? "info" : "default"}>
                  {index < 2 ? "Admin" : index < 4 ? "Manager" : "User"}
                </StatusBadge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <UserCog className="mr-2 h-4 w-4" />
                      Edit Role
                    </DropdownMenuItem>
                    <DropdownMenuItem>Reset Password</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Deactivate</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
