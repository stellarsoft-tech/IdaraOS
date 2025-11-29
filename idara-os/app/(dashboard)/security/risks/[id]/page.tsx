import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, Calendar, Shield, User } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { controls, risks } from "@/lib/seed-data"

export default async function RiskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const risk = risks.find((r) => r.id === id)

  if (!risk) {
    notFound()
  }

  const levelVariant: Record<string, "success" | "warning" | "danger"> = {
    low: "success",
    medium: "warning",
    high: "danger",
    critical: "danger",
  }

  const relatedControls = controls
    .filter((c) => c.framework.includes("ISO 27001") && risk.framework === "ISMS")
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/risks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={risk.id} description={risk.title} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={`h-16 w-16 rounded-xl flex items-center justify-center mb-4 ${
                  risk.level === "high" || risk.level === "critical"
                    ? "bg-red-100 dark:bg-red-900/30"
                    : risk.level === "medium"
                      ? "bg-yellow-100 dark:bg-yellow-900/30"
                      : "bg-green-100 dark:bg-green-900/30"
                }`}
              >
                <AlertTriangle
                  className={`h-8 w-8 ${
                    risk.level === "high" || risk.level === "critical"
                      ? "text-red-600"
                      : risk.level === "medium"
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                />
              </div>
              <h2 className="text-xl font-semibold">{risk.id}</h2>
              <p className="text-sm text-muted-foreground mt-1">{risk.title}</p>
              <StatusBadge variant={levelVariant[risk.level]} className="mt-2">
                {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)} Risk
              </StatusBadge>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Owner: {risk.owner}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Framework: {risk.framework}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Status: {risk.status}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button className="flex-1 bg-transparent" variant="outline">
                Edit Risk
              </Button>
              <Button className="flex-1">Add Treatment</Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{risk.description}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground mb-1">Likelihood</p>
                    <StatusBadge variant={levelVariant[risk.likelihood]}>{risk.likelihood}</StatusBadge>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground mb-1">Impact</p>
                    <StatusBadge variant={levelVariant[risk.impact]}>{risk.impact}</StatusBadge>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                    <StatusBadge variant={levelVariant[risk.level]}>{risk.level}</StatusBadge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assessment" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Matrix</CardTitle>
                  <CardDescription>Visual representation of risk assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    <div />
                    <div className="text-center p-2 font-medium">Low</div>
                    <div className="text-center p-2 font-medium">Medium</div>
                    <div className="text-center p-2 font-medium">High</div>

                    <div className="p-2 font-medium">High</div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "low" && risk.impact === "high" ? "ring-2 ring-primary" : ""} bg-yellow-100 dark:bg-yellow-900/30`}
                    >
                      Medium
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "medium" && risk.impact === "high" ? "ring-2 ring-primary" : ""} bg-red-100 dark:bg-red-900/30`}
                    >
                      High
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "high" && risk.impact === "high" ? "ring-2 ring-primary" : ""} bg-red-200 dark:bg-red-900/50`}
                    >
                      Critical
                    </div>

                    <div className="p-2 font-medium">Medium</div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "low" && risk.impact === "medium" ? "ring-2 ring-primary" : ""} bg-green-100 dark:bg-green-900/30`}
                    >
                      Low
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "medium" && risk.impact === "medium" ? "ring-2 ring-primary" : ""} bg-yellow-100 dark:bg-yellow-900/30`}
                    >
                      Medium
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "high" && risk.impact === "medium" ? "ring-2 ring-primary" : ""} bg-red-100 dark:bg-red-900/30`}
                    >
                      High
                    </div>

                    <div className="p-2 font-medium">Low</div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "low" && risk.impact === "low" ? "ring-2 ring-primary" : ""} bg-green-50 dark:bg-green-900/20`}
                    >
                      Low
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "medium" && risk.impact === "low" ? "ring-2 ring-primary" : ""} bg-green-100 dark:bg-green-900/30`}
                    >
                      Low
                    </div>
                    <div
                      className={`p-2 rounded text-center ${risk.likelihood === "high" && risk.impact === "low" ? "ring-2 ring-primary" : ""} bg-yellow-100 dark:bg-yellow-900/30`}
                    >
                      Medium
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Likelihood (horizontal) × Impact (vertical)
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="controls" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Related Controls</CardTitle>
                  <CardDescription>Controls that mitigate this risk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {relatedControls.map((control) => (
                    <div key={control.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{control.id}</p>
                        <p className="text-sm text-muted-foreground">{control.title}</p>
                      </div>
                      <StatusBadge
                        variant={
                          control.status === "effective"
                            ? "success"
                            : control.status === "implemented"
                              ? "info"
                              : "warning"
                        }
                      >
                        {control.status}
                      </StatusBadge>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full bg-transparent">
                    Link More Controls
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk History</CardTitle>
                  <CardDescription>Timeline of changes to this risk</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Risk status updated to {risk.status}</p>
                        <p className="text-xs text-muted-foreground">2 weeks ago</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-yellow-500 mt-2" />
                      <div>
                        <p className="text-sm">Risk level assessed as {risk.level}</p>
                        <p className="text-xs text-muted-foreground">1 month ago</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <p className="text-sm">Risk created by {risk.owner}</p>
                        <p className="text-xs text-muted-foreground">3 months ago</p>
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
