"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { ChatsyDrawer } from "@/components/chatsy-drawer"
import { SidebarInset, SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarRail, SidebarMenu, SidebarMenuItem, SidebarGroup, SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { BreadcrumbProvider } from "@/components/breadcrumb-context"

// Sidebar skeleton for loading state
function SidebarSkeleton() {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {Array.from({ length: 6 }).map((_, i) => (
              <SidebarMenuItem key={`skeleton-menu-item-${i}`}>
                <div className="px-2 py-1.5">
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 py-1.5">
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-2 p-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

// TopBar skeleton for loading state
function TopBarSkeleton() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="h-6 w-px bg-border shrink-0 mr-1" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </header>
  )
}

// Dynamic imports to avoid hydration mismatch from Radix UI dynamic IDs
const AppSidebar = dynamic(
  () => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
  { 
    ssr: false,
    loading: () => <SidebarSkeleton />
  }
)

const TopBar = dynamic(
  () => import("@/components/top-bar").then((mod) => mod.TopBar),
  { 
    ssr: false,
    loading: () => <TopBarSkeleton />
  }
)

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => mod.CommandPalette),
  { ssr: false }
)

export default function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const [chatsyOpen, setChatsyOpen] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)

  return (
    <BreadcrumbProvider>
      <SidebarProvider className="h-full">
        <AppSidebar />
        <SidebarInset className="overflow-hidden h-full">
          <div className="flex h-full flex-col">
            <TopBar onChatsyToggle={() => setChatsyOpen(!chatsyOpen)} onCommandOpen={() => setCommandOpen(true)} />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">{children}</main>
              <ChatsyDrawer open={chatsyOpen} onClose={() => setChatsyOpen(false)} />
            </div>
          </div>
        </SidebarInset>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </SidebarProvider>
    </BreadcrumbProvider>
  )
}
