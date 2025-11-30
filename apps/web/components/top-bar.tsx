"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Bell, MessageSquare, Moon, Plus, Search, Sun, Users, HardDrive, Shield, FileText, ShoppingCart, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"

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
import { Breadcrumbs } from "@/components/breadcrumbs"
import { useUser } from "@/lib/rbac"

// Quick create items with permission mapping
interface QuickCreateItem {
  label: string
  module: string // RBAC module that requires "create" permission
  url: string
  icon: LucideIcon
}

const quickCreateItems: QuickCreateItem[] = [
  { label: "New Person", module: "people.directory", url: "/people/directory?create=true", icon: Users },
  { label: "New Asset", module: "assets.inventory", url: "/assets/inventory?create=true", icon: HardDrive },
  { label: "New Risk", module: "security.risks", url: "/security/risks?create=true", icon: Shield },
  { label: "New Policy", module: "docs.policies", url: "/docs/policies?create=true", icon: FileText },
  { label: "New Vendor", module: "vendors.directory", url: "/vendors/directory?create=true", icon: ShoppingCart },
]

interface TopBarProps {
  onChatsyToggle?: () => void
  onCommandOpen?: () => void
}

export function TopBar({ onChatsyToggle, onCommandOpen }: TopBarProps) {
  const { theme, setTheme } = useTheme()
  const { hasPermission } = useUser()
  const router = useRouter()

  // Toggle theme between light and dark
  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light")
    } else {
      setTheme("dark")
    }
  }

  // Filter quick create items based on create permissions
  const availableCreateItems = useMemo(() => {
    return quickCreateItems.filter((item) => hasPermission(item.module, "create"))
  }, [hasPermission])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="h-6 w-px bg-border shrink-0 mr-1" aria-hidden="true" />
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

        {/* Only show New button if user can create at least one thing */}
        {availableCreateItems.length > 0 && (
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
              {availableCreateItems.map((item) => (
                <DropdownMenuItem 
                  key={item.module}
                  onClick={() => router.push(item.url)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground flex items-center justify-center">
            3
          </span>
        </Button>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
          <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onChatsyToggle}>
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  )
}
