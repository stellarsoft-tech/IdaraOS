import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, FileText, HardDrive, Mail, MapPin } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { assets, people } from "@/lib/seed-data"

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const person = people.find((p) => p.slug === slug)

  if (!person) {
    notFound()
  }

  const personAssets = assets.filter((a) => a.owner === person.name)

  const statusVariant: Record<string, "success" | "warning" | "info" | "danger"> = {
    active: "success",
    onboarding: "info",
    offboarding: "warning",
    inactive: "danger",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/people/directory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={person.name} description={`${person.role} • ${person.team}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 mb-4">
                <AvatarFallback className="text-2xl">
                  {person.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{person.name}</h2>
              <p className="text-sm text-muted-foreground">{person.role}</p>
              <StatusBadge variant={statusVariant[person.status]} className="mt-2">
                {person.status.charAt(0).toUpperCase() + person.status.slice(1)}
              </StatusBadge>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{person.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{person.team} Team</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Started {new Date(person.startDate).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button className="flex-1 bg-transparent" variant="outline">
                Edit Profile
              </Button>
              <Button className="flex-1">Message</Button>
            </div>
          </CardContent>
        </Card>

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
                    <p className="font-medium">EMP-{person.id.padStart(4, "0")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{person.team}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{new Date(person.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Employment Type</p>
                    <p className="font-medium">Full-time</p>
                  </div>
                </CardContent>
              </Card>

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
                      {personAssets.map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{asset.model}</p>
                            <p className="text-xs text-muted-foreground">{asset.tag}</p>
                          </div>
                          <StatusBadge variant="success">Assigned</StatusBadge>
                        </div>
                      ))}
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
                            <StatusBadge variant="success">Active</StatusBadge>
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
                            Signed {new Date(person.startDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">NDA</p>
                          <p className="text-xs text-muted-foreground">
                            Signed {new Date(person.startDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
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
                        <p className="text-sm">Asset LAP-003 assigned</p>
                        <p className="text-xs text-muted-foreground">3 days ago</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Completed security awareness training</p>
                        <p className="text-xs text-muted-foreground">1 week ago</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Account created</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(person.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
