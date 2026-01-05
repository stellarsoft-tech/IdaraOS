"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  ArrowRight,
  Files,
  FolderArchive,
  FolderTree,
  HardDrive,
  Loader2,
  Plus,
  Upload,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { useFileCategoriesList, MODULE_SCOPE_OPTIONS } from "@/lib/api/file-categories"
import { useStorageIntegrationsList } from "@/lib/api/storage-integrations"

export default function FilingOverviewPage() {
  const canAccess = useCanAccess("filing.overview")
  const canManageCategories = usePermission("filing.categories", "edit")
  
  const { data: categories = [], isLoading: categoriesLoading } = useFileCategoriesList({ activeOnly: true })
  const { data: storageIntegrations = [], isLoading: storageLoading } = useStorageIntegrationsList()
  
  if (!canAccess) {
    return (
      <PageShell title="Filing">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view the Filing module." 
        />
      </PageShell>
    )
  }
  
  const isLoading = categoriesLoading || storageLoading
  const connectedStorageCount = storageIntegrations.filter(s => s.status === "connected").length
  const categoriesByModule = MODULE_SCOPE_OPTIONS.map(module => ({
    ...module,
    categories: categories.filter(c => c.moduleScope === module.value),
  })).filter(m => m.categories.length > 0)
  
  // Calculate categories with and without storage
  const categoriesWithStorage = categories.filter(c => c.storageIntegrationId)
  const categoriesWithoutStorage = categories.filter(c => !c.storageIntegrationId)
  
  return (
    <PageShell 
      title="Filing" 
      description="Manage files and documents across all modules"
    >
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Integrations</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{connectedStorageCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {connectedStorageCount === 1 ? "Connected provider" : "Connected providers"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">File Categories</CardTitle>
              <FolderTree className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{categories.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {categoriesByModule.length} {categoriesByModule.length === 1 ? "module" : "modules"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Configured</CardTitle>
              <FolderArchive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{categoriesWithStorage.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Categories with storage
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Files</CardTitle>
              <Files className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Total files stored
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Configuration Status */}
        {categoriesWithoutStorage.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-800 dark:text-amber-200">
                Configuration Needed
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                {categoriesWithoutStorage.length} {categoriesWithoutStorage.length === 1 ? "category" : "categories"} need storage configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categoriesWithoutStorage.slice(0, 5).map(cat => (
                  <Badge key={cat.id} variant="outline" className="border-amber-300 dark:border-amber-700">
                    {cat.name}
                  </Badge>
                ))}
                {categoriesWithoutStorage.length > 5 && (
                  <Badge variant="outline" className="border-amber-300 dark:border-amber-700">
                    +{categoriesWithoutStorage.length - 5} more
                  </Badge>
                )}
              </div>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href="/filing/categories">
                    Configure Categories
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Files className="h-5 w-5" />
                Browse Files
              </CardTitle>
              <CardDescription>
                View and manage all files across modules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/filing/files">
                  View All Files
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Manage Categories
              </CardTitle>
              <CardDescription>
                Create and configure file categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/filing/categories">
                  Manage Categories
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Integrations
              </CardTitle>
              <CardDescription>
                Connect cloud storage providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings/integrations">
                  Configure Storage
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Categories by Module */}
        <Card>
          <CardHeader>
            <CardTitle>Categories by Module</CardTitle>
            <CardDescription>
              File categories organized by their module scope
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : categoriesByModule.length === 0 ? (
              <div className="text-center py-8">
                <FolderTree className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="font-medium">No Categories Yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create file categories to organize documents across modules
                </p>
                <Protected module="filing.categories" action="create">
                  <Button asChild>
                    <Link href="/filing/categories">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Category
                    </Link>
                  </Button>
                </Protected>
              </div>
            ) : (
              <div className="space-y-6">
                {categoriesByModule.map(module => (
                  <div key={module.value}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{module.label}</h3>
                      <Badge variant="secondary">{module.categories.length}</Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {module.categories.map(category => (
                        <div
                          key={category.id}
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{category.name}</p>
                              {category.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {category.description}
                                </p>
                              )}
                            </div>
                            {category.storageIntegration ? (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {category.storageIntegration.provider === "sharepoint" ? "SharePoint" : "Blob"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs shrink-0 border-amber-300 text-amber-600">
                                No Storage
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
