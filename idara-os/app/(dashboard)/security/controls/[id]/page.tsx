import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle, FileCheck, Shield, User } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { controls } from "@/lib/seed-data"

export default async function ControlDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const control = controls.find((c) => c.id === id)

  if (!control) {
    notFound()
  }

  const statusVariant: Record<string, "success" | "info" | "warning"> = {
    effective: "success",
    implemented: "info",
    designed: "warning",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/controls">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={control.id} description={control.title} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">{control.id}</h2>
              <p className="text-sm text-muted-foreground mt-1">{control.title}</p>
              <StatusBadge variant={statusVariant[control.status]} className="mt-2">
                {control.status.charAt(0).toUpperCase() + control.status.slice(1)}
              </StatusBadge>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Owner: {control.owner}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Framework: {control.framework}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <span>Evidence: {control.evidenceCount} items</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button className="flex-1 bg-transparent" variant="outline">
                Edit Control
              </Button>
              <Button className="flex-1">Add Evidence</Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="design">
            <TabsList>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="implementation">Implementation</TabsTrigger>
              <TabsTrigger value="effectiveness">Effectiveness</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
            </TabsList>

            <TabsContent value="design" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Control Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{control.description}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Design Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Control is designed</p>
                      <p className="text-sm text-muted-foreground">
                        The control has been formally documented and approved.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="implementation" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Implementation Status</CardTitle>
                  <CardDescription>Track implementation progress</CardDescription>
                </CardHeader>
                <CardContent>
                  {control.status === "designed" ? (
                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                        Implementation in progress
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                        This control is designed but not yet implemented.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Control is implemented</p>
                        <p className="text-sm text-muted-foreground">
                          The control has been deployed and is operational.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="effectiveness" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Effectiveness Review</CardTitle>
                  <CardDescription>Assess if the control is working as intended</CardDescription>
                </CardHeader>
                <CardContent>
                  {control.status === "effective" ? (
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Control is effective</p>
                        <p className="text-sm text-muted-foreground">
                          Testing has confirmed the control is working as designed.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">
                        Effectiveness testing pending. Schedule a test to verify the control is working.
                      </p>
                      <Button className="mt-3" size="sm">
                        Schedule Test
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Evidence ({control.evidenceCount})</CardTitle>
                  <CardDescription>Documentation supporting this control</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.from({ length: Math.min(control.evidenceCount, 5) }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileCheck className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Evidence-{String(i + 1).padStart(3, "0")}</p>
                          <p className="text-xs text-muted-foreground">Added Oct {10 + i}, 2024</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full bg-transparent">
                    Upload New Evidence
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
