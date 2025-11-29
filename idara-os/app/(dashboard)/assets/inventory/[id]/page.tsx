import type React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Box, Calendar, HardDrive, Laptop, MapPin, Monitor, Phone, Tablet, User, Wrench } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { assets } from "@/lib/seed-data"

const assetTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  monitor: Monitor,
  phone: Phone,
  tablet: Tablet,
  accessory: Box,
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const asset = assets.find((a) => a.id === id)

  if (!asset) {
    notFound()
  }

  const Icon = assetTypeIcons[asset.type] || HardDrive
  const statusVariant: Record<string, "success" | "warning" | "info" | "danger"> = {
    assigned: "success",
    available: "info",
    maintenance: "warning",
    disposed: "danger",
  }

  const warrantyDate = new Date(asset.warrantyEnd)
  const isWarrantyExpired = warrantyDate < new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/assets/inventory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={asset.tag} description={asset.model} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center mb-4">
                <Icon className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">{asset.tag}</h2>
              <p className="text-sm text-muted-foreground">{asset.model}</p>
              <StatusBadge variant={statusVariant[asset.status]} className="mt-2">
                {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
              </StatusBadge>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{asset.owner || "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{asset.location}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className={isWarrantyExpired ? "text-red-600" : ""}>
                  Warranty: {warrantyDate.toLocaleDateString()}
                  {isWarrantyExpired && " (Expired)"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button className="flex-1 bg-transparent" variant="outline">
                {asset.owner ? "Unassign" : "Assign"}
              </Button>
              <Button className="flex-1">Edit</Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Asset Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Asset Tag</p>
                    <p className="font-medium font-mono">{asset.tag}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{asset.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-medium">{asset.model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{asset.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Warranty End Date</p>
                    <p className={`font-medium ${isWarrantyExpired ? "text-red-600" : ""}`}>
                      {warrantyDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Assignee</p>
                    <p className="font-medium">{asset.owner || "None"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    <User className="mr-2 h-4 w-4" />
                    {asset.owner ? "Reassign" : "Assign to Person"}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Wrench className="mr-2 h-4 w-4" />
                    Create Maintenance Ticket
                  </Button>
                  <Button variant="outline" size="sm">
                    <HardDrive className="mr-2 h-4 w-4" />
                    Print Asset Label
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Assignment History</CardTitle>
                  <CardDescription>Track of all assignments for this asset</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {asset.owner && (
                      <div className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                        <div>
                          <p className="text-sm">Assigned to {asset.owner}</p>
                          <p className="text-xs text-muted-foreground">Current assignment</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Asset added to inventory</p>
                        <p className="text-xs text-muted-foreground">Initial registration</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Maintenance Records</CardTitle>
                  <CardDescription>Service history and scheduled maintenance</CardDescription>
                </CardHeader>
                <CardContent>
                  {asset.status === "maintenance" ? (
                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                        Currently in maintenance
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                        This asset is currently being serviced.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No maintenance records found.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
