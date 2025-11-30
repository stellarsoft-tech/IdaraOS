"use client"

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { ChatsyDrawer } from "@/components/chatsy-drawer"
import { CommandPalette } from "@/components/command-palette"
import { TopBar } from "@/components/top-bar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

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
