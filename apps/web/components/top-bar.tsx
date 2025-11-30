"use client"

import { Bell, MessageSquare, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "@/components/breadcrumbs"

interface TopBarProps {
  onChatsyToggle?: () => void
  onCommandOpen?: () => void
}

export function TopBar({ onChatsyToggle, onCommandOpen }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6" />
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-56 cursor-pointer" onClick={onCommandOpen}>
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8 h-8 text-sm cursor-pointer" readOnly />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="sm" className="gap-1 h-8">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>New Person</DropdownMenuItem>
            <DropdownMenuItem>New Asset</DropdownMenuItem>
            <DropdownMenuItem>New Risk</DropdownMenuItem>
            <DropdownMenuItem>New Policy</DropdownMenuItem>
            <DropdownMenuItem>New Vendor</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground flex items-center justify-center">
            3
          </span>
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onChatsyToggle}>
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  )
}
