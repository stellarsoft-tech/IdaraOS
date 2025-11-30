"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { ChatsyDrawer } from "@/components/chatsy-drawer"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// Dynamic imports to avoid hydration mismatch from Radix UI dynamic IDs
const AppSidebar = dynamic(
  () => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
  { ssr: false }
)

const TopBar = dynamic(
  () => import("@/components/top-bar").then((mod) => mod.TopBar),
  { ssr: false }
)

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => mod.CommandPalette),
  { ssr: false }
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [chatsyOpen, setChatsyOpen] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)

  return (
    <SidebarProvider className="h-full">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <div className="flex h-full flex-col">
          <TopBar onChatsyToggle={() => setChatsyOpen(!chatsyOpen)} onCommandOpen={() => setCommandOpen(true)} />
          <div className="flex min-h-0 flex-1">
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
            <ChatsyDrawer open={chatsyOpen} onClose={() => setChatsyOpen(false)} />
          </div>
        </div>
      </SidebarInset>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  )
}
