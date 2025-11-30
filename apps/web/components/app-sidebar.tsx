"use client"

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
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
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

const navigationData = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "People & HR",
    url: "/people",
    icon: Users,
    items: [
      { title: "Overview", url: "/people" },
      { title: "Directory", url: "/people/directory" },
      { title: "Roles & Teams", url: "/people/roles" },
      { title: "Onboarding", url: "/people/onboarding" },
      { title: "Offboarding", url: "/people/offboarding" },
      { title: "Time Off", url: "/people/time-off" },
      { title: "Documents", url: "/people/documents" },
    ],
  },
  {
    title: "Assets",
    url: "/assets",
    icon: HardDrive,
    items: [
      { title: "Overview", url: "/assets" },
      { title: "Inventory", url: "/assets/inventory" },
      { title: "Assignments", url: "/assets/assignments" },
      { title: "Maintenance", url: "/assets/maintenance" },
      { title: "Disposal", url: "/assets/disposal" },
    ],
  },
  {
    title: "Security",
    url: "/security",
    icon: Shield,
    badge: 3,
    items: [
      { title: "Overview", url: "/security" },
      { title: "Frameworks (IMS)", url: "/security/frameworks" },
      { title: "Risk Register", url: "/security/risks" },
      { title: "Controls Library", url: "/security/controls" },
      { title: "Audits", url: "/security/audits" },
      { title: "Evidence Store", url: "/security/evidence" },
      { title: "SoA", url: "/security/soa" },
      { title: "Objectives & Plan", url: "/security/objectives" },
    ],
  },
  {
    title: "Finance",
    url: "/finance",
    icon: Building2,
    items: [
      { title: "Overview", url: "/finance" },
      { title: "Expenses", url: "/finance/expenses" },
      { title: "Invoices", url: "/finance/invoices" },
      { title: "Chart of Accounts", url: "/finance/accounts" },
    ],
  },
  {
    title: "Docs & Policies",
    url: "/docs",
    icon: FileText,
    badge: 2,
    items: [
      { title: "Overview", url: "/docs" },
      { title: "Policy Library", url: "/docs/policies" },
      { title: "Procedures / SOPs", url: "/docs/procedures" },
      { title: "Attestations", url: "/docs/attestations" },
      { title: "Approvals", url: "/docs/approvals" },
    ],
  },
  {
    title: "Vendors",
    url: "/vendors",
    icon: ShoppingCart,
    items: [
      { title: "Overview", url: "/vendors" },
      { title: "Directory", url: "/vendors/directory" },
      { title: "Contracts", url: "/vendors/contracts" },
      { title: "Assessments", url: "/vendors/assessments" },
    ],
  },
  {
    title: "Workflows",
    url: "/workflows",
    icon: Workflow,
    items: [
      { title: "Overview", url: "/workflows" },
      { title: "Tasks & Automations", url: "/workflows/tasks" },
      { title: "Checklists", url: "/workflows/checklists" },
    ],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    items: [
      { title: "Organization", url: "/settings" },
      { title: "Users & Access", url: "/settings/users" },
      { title: "Integrations", url: "/settings/integrations" },
      { title: "Audit Log", url: "/settings/audit-log" },
      { title: "Branding", url: "/settings/branding" },
    ],
  },
]

const user = {
  name: "Hamza Abdullah",
  email: "hamza@idaraos.com",
  avatar: "/diverse-avatars.png",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/"
    return pathname.startsWith(url)
  }

  const isItemActive = (url: string) => pathname === url

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">IdaraOS</span>
                  <span className="truncate text-xs text-muted-foreground">Company OS</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigationData.map((item) =>
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
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={isItemActive(subItem.url)}>
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
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
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
