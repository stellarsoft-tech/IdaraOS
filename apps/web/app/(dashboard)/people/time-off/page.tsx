import { Calendar, Check, X } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const timeOffRequests = [
  { id: 1, person: "Sarah Chen", type: "Vacation", start: "2024-12-23", end: "2024-12-27", status: "pending", days: 5 },
  {
    id: 2,
    person: "Michael Brown",
    type: "Sick Leave",
    start: "2024-11-28",
    end: "2024-11-28",
    status: "approved",
    days: 1,
  },
  {
    id: 3,
    person: "Emily Davis",
    type: "Personal",
    start: "2024-12-02",
    end: "2024-12-02",
    status: "pending",
    days: 1,
  },
]

export default function TimeOffPage() {
  const pendingCount = timeOffRequests.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-6">
      <PageHeader title="Time Off" description="Manage leave requests and view the team calendar.">
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          Request Time Off
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>{pendingCount} pending approval</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeOffRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarFallback>
                        {request.person
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.person}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.type} • {request.days} {request.days === 1 ? "day" : "days"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.start).toLocaleDateString()} - {new Date(request.end).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status === "pending" ? (
                      <>
                        <Button size="icon" variant="outline" className="h-8 w-8 bg-transparent">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 bg-transparent">
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      <StatusBadge variant={request.status === "approved" ? "success" : "danger"}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </StatusBadge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balance</CardTitle>
              <CardDescription>Your remaining time off</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Vacation</span>
                <span className="font-medium">15 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Sick Leave</span>
                <span className="font-medium">10 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Personal</span>
                <span className="font-medium">3 days</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Holidays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Christmas Day</span>
                <span className="text-xs text-muted-foreground">Dec 25</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">New Year&apos;s Day</span>
                <span className="text-xs text-muted-foreground">Jan 1</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
