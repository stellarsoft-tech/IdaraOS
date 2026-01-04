"use client"

import { useMemo } from "react"
import type * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Building2,
  ChevronRight,
  FileText,
  HardDrive,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { useUser } from "@/lib/rbac"
import { useOrganization } from "@/lib/api/organization"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

// Navigation item with permission module mapping
interface NavFourthLevelItem {
  title: string
  url: string
}

interface NavThirdLevelItem {
  title: string
  url: string
  items?: NavFourthLevelItem[] // Fourth level items (e.g., ISO 27001 sub-pages)
}

interface NavSubItem {
  title: string
  url: string
  module?: string // RBAC module slug for permission check
  items?: NavThirdLevelItem[] // Third level items (e.g., framework sub-pages)
}

interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  badge?: number
  module?: string // Parent module for simple items
  items?: NavSubItem[]
}

const navigationData: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    // Dashboard is always visible
  },
  {
    title: "People & HR",
    url: "/people",
    icon: Users,
    items: [
      { title: "Overview", url: "/people", module: "people.overview" },
      { title: "Directory", url: "/people/directory", module: "people.directory" },
      { title: "Teams", url: "/people/teams", module: "people.teams" },
      { title: "Roles", url: "/people/roles", module: "people.roles" },
      { title: "Workflows", url: "/people/workflows", module: "people.workflows" },
      { title: "Audit Log", url: "/people/audit-log", module: "people.auditlog" },
      { title: "Settings", url: "/people/settings", module: "people.settings" },
    ],
  },
  {
    title: "Assets",
    url: "/assets",
    icon: HardDrive,
    items: [
      { title: "Overview", url: "/assets", module: "assets.overview" },
      { title: "Inventory", url: "/assets/inventory", module: "assets.inventory" },
      { title: "Categories", url: "/assets/categories", module: "assets.categories" },
      { title: "Assignments", url: "/assets/assignments", module: "assets.assignments" },
      { title: "Maintenance", url: "/assets/maintenance", module: "assets.maintenance" },
      { title: "Lifecycle", url: "/assets/lifecycle", module: "assets.lifecycle" },
      { title: "Audit Log", url: "/assets/audit-log", module: "assets.auditlog" },
      { title: "Settings", url: "/assets/settings", module: "assets.settings" },
    ],
  },
  {
    title: "Security",
    url: "/security",
    icon: Shield,
    items: [
      { title: "Overview", url: "/security", module: "security.overview" },
      { title: "Risk Register", url: "/security/risks", module: "security.risks" },
      { title: "Controls Library", url: "/security/controls", module: "security.controls" },
      { title: "Evidence Store", url: "/security/evidence", module: "security.evidence" },
      { title: "Audits", url: "/security/audits", module: "security.audits" },
      { title: "Objectives", url: "/security/objectives", module: "security.objectives" },
      { 
        title: "Frameworks", 
        url: "/security/frameworks", 
        module: "security.frameworks",
        items: [
          { title: "All Frameworks", url: "/security/frameworks" },
          { 
            title: "ISO 27001", 
            url: "/security/frameworks/iso-27001",
            items: [
              { title: "Dashboard", url: "/security/frameworks/iso-27001" },
              { title: "ISMS Clauses (4-10)", url: "/security/frameworks/iso-27001/clauses" },
              { title: "Statement of Applicability", url: "/security/frameworks/iso-27001/soa" },
              { title: "Annex A Controls", url: "/security/frameworks/iso-27001/controls" },
              { title: "Evidence Matrix", url: "/security/frameworks/iso-27001/evidence" },
              { title: "Gap Analysis", url: "/security/frameworks/iso-27001/gaps" },
            ],
          },
          { 
            title: "SOC 2", 
            url: "/security/frameworks/soc-2",
            items: [
              { title: "Dashboard", url: "/security/frameworks/soc-2" },
              { title: "Statement of Applicability", url: "/security/frameworks/soc-2/soa" },
              { title: "Trust Service Criteria", url: "/security/frameworks/soc-2/criteria" },
              { title: "Evidence Matrix", url: "/security/frameworks/soc-2/evidence" },
              { title: "Gap Analysis", url: "/security/frameworks/soc-2/gaps" },
            ],
          },
        ],
      },
      { title: "Audit Log", url: "/security/audit-log", module: "security.auditlog" },
    ],
  },
  {
    title: "Finance",
    url: "/finance",
    icon: Building2,
    items: [
      { title: "Overview", url: "/finance", module: "finance.overview" },
      { title: "Expenses", url: "/finance/expenses", module: "finance.expenses" },
      { title: "Invoices", url: "/finance/invoices", module: "finance.invoices" },
      { title: "Chart of Accounts", url: "/finance/accounts", module: "finance.accounts" },
    ],
  },
  {
    title: "Docs & Policies",
    url: "/docs",
    icon: FileText,
    items: [
      { title: "Overview", url: "/docs", module: "docs.overview" },
      { title: "Document Library", url: "/docs/documents", module: "docs.documents" },
      { title: "My Documents", url: "/docs/my-documents", module: "docs.overview" },
      { title: "Audit Log", url: "/docs/audit-log", module: "docs.auditlog" },
      { title: "Settings", url: "/docs/settings", module: "docs.settings" },
    ],
  },
  {
    title: "Vendors",
    url: "/vendors",
    icon: ShoppingCart,
    items: [
      { title: "Overview", url: "/vendors", module: "vendors.overview" },
      { title: "Directory", url: "/vendors/directory", module: "vendors.directory" },
      { title: "Contracts", url: "/vendors/contracts", module: "vendors.contracts" },
      { title: "Assessments", url: "/vendors/assessments", module: "vendors.assessments" },
    ],
  },
  {
    title: "Workflows",
    url: "/workflows",
    icon: Workflow,
    items: [
      { title: "Overview", url: "/workflows", module: "workflows.overview" },
      { title: "Templates", url: "/workflows/templates", module: "workflows.templates" },
      { title: "Active Workflows", url: "/workflows/instances", module: "workflows.instances" },
      { title: "Board View", url: "/workflows/board", module: "workflows.board" },
      { title: "My Tasks", url: "/workflows/tasks", module: "workflows.tasks" },
      { title: "Audit Log", url: "/workflows/audit-log", module: "workflows.auditlog" },
      { title: "Settings", url: "/workflows/settings", module: "workflows.settings" },
    ],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    items: [
      { title: "Organization", url: "/settings", module: "settings.organization" },
      { title: "Users & Access", url: "/settings/users", module: "settings.users" },
      { title: "Roles & Permissions", url: "/settings/roles", module: "settings.roles" },
      { title: "Integrations", url: "/settings/integrations", module: "settings.integrations" },
      { title: "Audit Log", url: "/settings/audit-log", module: "settings.auditlog" },
      { title: "Branding", url: "/settings/branding", module: "settings.branding" },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, isLoading, canAccess } = useUser()
  const { data: org } = useOrganization()
  
  // App name and tagline from organization settings, fallback to default
  const appName = org?.appName || "IdaraOS"
  const tagline = org?.tagline ?? "Company OS" // Default to "Company OS", empty string hides it

  const isActive = (url: string) => {
    if (url === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(url)
  }

  const isItemActive = (url: string) => pathname === url

  // Filter navigation based on permissions
  const filteredNavigation = useMemo(() => {
    return navigationData
      .map((item) => {
        // If item has no sub-items and no module, it's always visible (e.g., Dashboard)
        if (!item.items && !item.module) {
          return item
        }

        // If item has a single module (no sub-items), check that module
        if (item.module && !item.items) {
          return canAccess(item.module) ? item : null
        }

        // If item has sub-items, filter them by permission
        if (item.items) {
          const visibleItems = item.items.filter((subItem) => {
            // If no module specified, item is visible
            if (!subItem.module) return true
            // Otherwise check permission
            return canAccess(subItem.module)
          })

          // If no sub-items are visible, hide the entire section
          if (visibleItems.length === 0) return null

          // Return item with filtered sub-items
          return { ...item, items: visibleItems }
        }

        return item
      })
      .filter((item): item is NavItem => item !== null)
  }, [canAccess])

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{appName}</span>
                  {tagline && (
                    <span className="truncate text-xs text-muted-foreground">{tagline}</span>
                  )}
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {filteredNavigation.map((item) =>
              item.items ? (
                <Collapsible key={item.title} asChild defaultOpen={isActive(item.url)} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title} isActive={isActive(item.url)}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {item.badge && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </div>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          subItem.items ? (
                            // Third level: sub-item with nested items
                            <Collapsible key={subItem.title} asChild defaultOpen={pathname.startsWith(subItem.url)} className="group/nested">
                              <SidebarMenuSubItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton className="pr-2" isActive={pathname.startsWith(subItem.url) && !subItem.items.some(i => isItemActive(i.url))}>
                                    <span>{subItem.title}</span>
                                    <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/nested:rotate-90" />
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenuSub className="ml-2 border-l border-border/50 pl-2">
                                    {subItem.items.map((thirdItem) => (
                                      thirdItem.items ? (
                                        // Fourth level: third-item with nested items (e.g., ISO 27001 sub-pages)
                                        <Collapsible key={thirdItem.title} asChild defaultOpen={pathname.startsWith(thirdItem.url)} className="group/deep">
                                          <SidebarMenuSubItem>
                                            <CollapsibleTrigger asChild>
                                              <SidebarMenuSubButton className="pr-2 text-xs" isActive={pathname.startsWith(thirdItem.url) && !thirdItem.items.some(i => isItemActive(i.url))}>
                                                <span>{thirdItem.title}</span>
                                                <ChevronRight className="ml-auto size-3 shrink-0 transition-transform duration-200 group-data-[state=open]/deep:rotate-90" />
                                              </SidebarMenuSubButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                              <SidebarMenuSub className="ml-2 border-l border-border/30 pl-2">
                                                {thirdItem.items.map((fourthItem) => (
                                                  <SidebarMenuSubItem key={fourthItem.title}>
                                                    <SidebarMenuSubButton asChild isActive={isItemActive(fourthItem.url)} className="text-[11px] py-1">
                                                      <Link href={fourthItem.url}>
                                                        <span>{fourthItem.title}</span>
                                                      </Link>
                                                    </SidebarMenuSubButton>
                                                  </SidebarMenuSubItem>
                                                ))}
                                              </SidebarMenuSub>
                                            </CollapsibleContent>
                                          </SidebarMenuSubItem>
                                        </Collapsible>
                                      ) : (
                                        // Third level: regular item without nested children
                                        <SidebarMenuSubItem key={thirdItem.title}>
                                          <SidebarMenuSubButton asChild isActive={isItemActive(thirdItem.url)} className="text-xs">
                                            <Link href={thirdItem.url}>
                                              <span>{thirdItem.title}</span>
                                            </Link>
                                          </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                      )
                                    ))}
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </SidebarMenuSubItem>
                            </Collapsible>
                          ) : (
                            // Second level: regular sub-item
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={isItemActive(subItem.url)}>
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Chatsy" className="text-muted-foreground">
              <MessageSquare />
              <span>Chatsy Assistant</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {isLoading ? (
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : user ? (
          <NavUser user={{ name: user.name, email: user.email, avatar: user.avatar || null }} />
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
