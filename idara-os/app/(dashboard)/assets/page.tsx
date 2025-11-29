import type React from "react"
import Link from "next/link"
import { ArrowRight, Box, CheckCircle, HardDrive, Laptop, Monitor, Phone, Settings, Tablet, Wrench } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { assets } from "@/lib/seed-data"

const assetTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  monitor: Monitor,
  phone: Phone,
  tablet: Tablet,
  accessory: Box,
}

export default function AssetsOverviewPage() {
  const assignedCount = assets.filter((a) => a.status === "assigned").length
  const availableCount = assets.filter((a) => a.status === "available").length
  const maintenanceCount = assets.filter((a) => a.status === "maintenance").length

  const assetsByType = assets.reduce(
    (acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Assets" description="Manage your organization's hardware and equipment.">
        <Button asChild>
          <Link href="/assets/inventory">
            <HardDrive className="mr-2 h-4 w-4" />
            Add Asset
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Assets" value={assets.length} icon={HardDrive} />
        <StatCard title="Assigned" value={assignedCount} icon={CheckCircle} />
        <StatCard title="Available" value={availableCount} icon={Box} />
        <StatCard title="In Maintenance" value={maintenanceCount} icon={Wrench} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/assets/inventory">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Inventory
              </CardTitle>
              <CardDescription>View and manage all assets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{assets.length}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/assets/assignments">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Assignments
              </CardTitle>
              <CardDescription>People and asset relationships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="success">{assignedCount} assigned</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/assets/maintenance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Maintenance
              </CardTitle>
              <CardDescription>Schedules and repair tickets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusBadge variant="warning">{maintenanceCount} in progress</StatusBadge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Assets by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(assetsByType).map(([type, count]) => {
              const Icon = assetTypeIcons[type] || Box
              return (
                <div key={type} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">{type}s</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
