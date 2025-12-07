"use client"

import { useMemo } from "react"
import Link from "next/link"
import { 
  HardDrive, 
  Box, 
  CheckCircle, 
  Wrench, 
  ArrowRightLeft,
  FolderTree,
  Archive,
  Settings,
  ArrowRight,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { useAssetsList, useCategoriesList, useMaintenanceList } from "@/lib/api/assets"

interface StatsCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  iconColor: string
  loading?: boolean
  href?: string
}

function StatsCard({ title, value, subtitle, icon, iconColor, loading, href }: StatsCardProps) {
  const iconBgColor = iconColor.replace("text-", "bg-").replace("/10", "/10")
  
  const content = (
    <Card className={`relative overflow-hidden ${href ? "hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg ${iconBgColor} flex items-center justify-center`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </>
        )}
      </CardContent>
      {/* Gradient accent */}
      <div
        className={`absolute top-0 right-0 w-24 h-24 opacity-10 ${iconBgColor}`}
        style={{
          background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
        }}
      />
    </Card>
  )
  
  if (href) {
    return <Link href={href}>{content}</Link>
  }
  
  return content
}

interface QuickLinkProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

function QuickLink({ title, description, href, icon }: QuickLinkProps) {
  return (
    <Card className="group hover:border-primary/30 hover:shadow-md transition-all duration-200 h-full">
      <Link href={href} className="block">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <span className="group-hover:text-primary transition-colors">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold truncate">{title}</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

export default function AssetsOverviewPage() {
  const canAccess = useCanAccess("assets.overview")
  
  // Fetch data
  const { data: assets = [], isLoading: assetsLoading } = useAssetsList()
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesList()
  const { data: maintenanceRecords = [], isLoading: maintenanceLoading } = useMaintenanceList()
  
  const isLoading = assetsLoading || categoriesLoading || maintenanceLoading
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = assets.length
    const available = assets.filter(a => a.status === "available").length
    const assigned = assets.filter(a => a.status === "assigned").length
    const maintenance = assets.filter(a => a.status === "maintenance").length
    const retired = assets.filter(a => a.status === "retired" || a.status === "disposed").length
    
    const pendingMaintenance = maintenanceRecords.filter(
      m => m.status === "scheduled" || m.status === "in_progress"
    ).length
    
    return { 
      total, 
      available, 
      assigned, 
      maintenance, 
      retired,
      categories: categories.length,
      pendingMaintenance,
    }
  }, [assets, categories, maintenanceRecords])
  
  // Assets by category
  const assetsByCategory = useMemo(() => {
    const byCategory = new Map<string, number>()
    
    for (const asset of assets) {
      const categoryName = asset.category?.name || "Uncategorized"
      byCategory.set(categoryName, (byCategory.get(categoryName) || 0) + 1)
    }
    
    return Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [assets])
  
  if (!canAccess) {
    return (
      <PageShell title="Assets">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view the assets module." 
        />
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Assets Overview"
      description="Manage your organization's hardware and equipment."
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Assets"
            value={stats.total}
            subtitle="in your inventory"
            icon={<HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            iconColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            loading={isLoading}
            href="/assets/inventory"
          />
          <StatsCard
            title="Available"
            value={stats.available}
            subtitle="ready for assignment"
            icon={<Box className="h-4 w-4 text-green-600 dark:text-green-400" />}
            iconColor="bg-green-500/10 text-green-600 dark:text-green-400"
            loading={isLoading}
            href="/assets/inventory?status=available"
          />
          <StatsCard
            title="Assigned"
            value={stats.assigned}
            subtitle="currently in use"
            icon={<CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
            iconColor="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            loading={isLoading}
            href="/assets/assignments"
          />
          <StatsCard
            title="Maintenance"
            value={stats.maintenance}
            subtitle="under repair"
            icon={<Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            iconColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            loading={isLoading}
            href="/assets/maintenance"
          />
        </div>
        
        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            title="Inventory"
            description="View and manage all assets"
            href="/assets/inventory"
            icon={<HardDrive className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Categories"
            description={`${stats.categories} categories configured`}
            href="/assets/categories"
            icon={<FolderTree className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Assignments"
            description="Track asset allocations"
            href="/assets/assignments"
            icon={<ArrowRightLeft className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Maintenance"
            description={`${stats.pendingMaintenance} pending tickets`}
            href="/assets/maintenance"
            icon={<Wrench className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Lifecycle"
            description="View asset history and audit trail"
            href="/assets/lifecycle"
            icon={<Archive className="h-5 w-5 text-primary" />}
          />
          <QuickLink
            title="Settings"
            description="Configure sync and preferences"
            href="/assets/settings"
            icon={<Settings className="h-5 w-5 text-primary" />}
          />
        </div>
        
        {/* Additional Stats Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Assets by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assets by Category</CardTitle>
              <CardDescription>Top categories by asset count</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              ) : assetsByCategory.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FolderTree className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No assets yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assetsByCategory.map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{category}</span>
                      <span className="text-sm text-muted-foreground">{count} assets</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Breakdown</CardTitle>
              <CardDescription>Assets by current status</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              ) : stats.total === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <HardDrive className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No assets yet</p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/assets/inventory">Add your first asset</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">Available</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{stats.available}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm">Assigned</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{stats.assigned}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-sm">Maintenance</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{stats.maintenance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-sm">Retired/Disposed</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{stats.retired}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
