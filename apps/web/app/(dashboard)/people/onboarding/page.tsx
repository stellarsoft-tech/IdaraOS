import { CheckCircle2, Circle, Clock, UserPlus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { people } from "@/lib/seed-data"

const onboardingTasks = [
  { id: 1, title: "Complete employment paperwork", completed: true },
  { id: 2, title: "Set up company accounts", completed: true },
  { id: 3, title: "Assign laptop and equipment", completed: true },
  { id: 4, title: "Schedule orientation meeting", completed: false },
  { id: 5, title: "Complete security training", completed: false },
  { id: 6, title: "Review employee handbook", completed: false },
  { id: 7, title: "Meet with team lead", completed: false },
  { id: 8, title: "Set up development environment", completed: false },
]

export default function OnboardingPage() {
  const onboardingPeople = people.filter((p) => p.status === "onboarding")
  const completedTasks = onboardingTasks.filter((t) => t.completed).length
  const progress = (completedTasks / onboardingTasks.length) * 100

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Manage onboarding checklists and tasks for new hires.">
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Start Onboarding
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {onboardingPeople.map((person) => (
            <Card key={person.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
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
                      <CardTitle className="text-base">{person.name}</CardTitle>
                      <CardDescription>
                        {person.role} • {person.team}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusBadge variant="info">In Progress</StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {completedTasks}/{onboardingTasks.length} tasks
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    {onboardingTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          task.completed ? "bg-green-50 dark:bg-green-900/10" : "bg-muted/50"
                        }`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={`text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {onboardingPeople.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No active onboarding</h3>
                <p className="text-sm text-muted-foreground">Start an onboarding process for a new hire.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Onboarding Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active</span>
                <span className="font-medium">{onboardingPeople.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completed this month</span>
                <span className="font-medium">2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg. completion time</span>
                <span className="font-medium">5 days</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start bg-transparent">
                Create checklist template
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                View completed onboardings
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                Export onboarding report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
