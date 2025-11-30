"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Building,
  Calendar,
  FileText,
  HardDrive,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Shield,
  Users,
  Workflow,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { routes } from "@/lib/navigation/routes"
import { usePermission } from "@/lib/rbac"

// Icon mapping for routes
const iconMap: Record<string, any> = {
  "/": LayoutDashboard,
  "/people": Users,
  "/people/directory": Users,
  "/people/onboarding": Users,
  "/people/roles": Users,
  "/people/time-off": Calendar,
  "/assets": HardDrive,
  "/assets/inventory": HardDrive,
  "/assets/assignments": HardDrive,
  "/assets/maintenance": HardDrive,
  "/security": Shield,
  "/security/risks": Shield,
  "/security/controls": Shield,
  "/security/audits": Shield,
  "/security/evidence": Shield,
  "/security/frameworks": Shield,
  "/security/frameworks/isms": Shield,
  "/docs": FileText,
  "/docs/policies": FileText,
  "/docs/attestations": FileText,
  "/workflows": Workflow,
  "/workflows/checklists": Workflow,
  "/vendors": Building,
  "/settings": Settings,
  "/settings/users": Settings,
  "/settings/integrations": Settings,
  "/settings/audit-log": Settings,
  "/finance": Building,
}

// Generate pages from routes
const pages = Object.values(routes).map((route) => ({
  title: route.label,
  icon: iconMap[route.path] || FileText,
  href: route.path,
  keywords: route.label.toLowerCase().split(" "),
}))

const actions = [
  { title: "Add New Person", icon: Plus, action: "new-person", shortcut: "P" },
  { title: "Add New Asset", icon: Plus, action: "new-asset", shortcut: "A" },
  { title: "Create New Risk", icon: Plus, action: "new-risk", shortcut: "R" },
  { title: "Create New Policy", icon: Plus, action: "new-policy", shortcut: "D" },
  { title: "Create Checklist", icon: Plus, action: "new-checklist", shortcut: "C" },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false)
      setSearch("")
      command()
    },
    [onOpenChange],
  )

  // Filter pages based on search including keywords
  const filteredPages = pages.filter((page) => {
    const searchLower = search.toLowerCase()
    return page.title.toLowerCase().includes(searchLower) || page.keywords.some((k) => k.includes(searchLower))
  })

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, actions, or people..." value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <Search className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No results found for "{search}"</p>
          </div>
        </CommandEmpty>

        {filteredPages.length > 0 && (
          <CommandGroup heading="Pages">
            {filteredPages.slice(0, 8).map((page) => (
              <CommandItem
                key={page.href}
                value={page.title + " " + page.keywords.join(" ")}
                onSelect={() => runCommand(() => router.push(page.href))}
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.action}
              value={action.title}
              onSelect={() =>
                runCommand(() => {
                  // In a real app, this would open a modal or navigate to a create page
                  console.log("Action:", action.action)
                })
              }
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.title}
              <CommandShortcut>⌘{action.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
