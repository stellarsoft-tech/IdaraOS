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

const pages = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/", keywords: ["home", "overview"] },
  { title: "People Directory", icon: Users, href: "/people/directory", keywords: ["employees", "staff"] },
  { title: "Onboarding", icon: Users, href: "/people/onboarding", keywords: ["new hire", "checklist"] },
  { title: "Roles & Teams", icon: Users, href: "/people/roles", keywords: ["departments", "org"] },
  { title: "Time Off", icon: Calendar, href: "/people/time-off", keywords: ["leave", "vacation", "pto"] },
  { title: "Asset Inventory", icon: HardDrive, href: "/assets/inventory", keywords: ["laptops", "equipment"] },
  { title: "Asset Assignments", icon: HardDrive, href: "/assets/assignments", keywords: ["assigned"] },
  { title: "Maintenance", icon: HardDrive, href: "/assets/maintenance", keywords: ["repair", "service"] },
  { title: "Security Overview", icon: Shield, href: "/security", keywords: ["compliance"] },
  { title: "ISMS Framework", icon: Shield, href: "/security/frameworks/isms", keywords: ["iso27001"] },
  { title: "Risk Register", icon: Shield, href: "/security/risks", keywords: ["threats", "vulnerabilities"] },
  { title: "Controls Library", icon: Shield, href: "/security/controls", keywords: ["safeguards"] },
  { title: "Audits", icon: Shield, href: "/security/audits", keywords: ["assessments"] },
  { title: "Evidence Store", icon: Shield, href: "/security/evidence", keywords: ["artifacts", "proof"] },
  { title: "Policy Library", icon: FileText, href: "/docs/policies", keywords: ["procedures", "documents"] },
  { title: "Attestations", icon: FileText, href: "/docs/attestations", keywords: ["acknowledgment"] },
  { title: "Checklists", icon: Workflow, href: "/workflows/checklists", keywords: ["tasks", "templates"] },
  { title: "Vendors", icon: Building, href: "/vendors", keywords: ["suppliers", "third-party"] },
  { title: "Settings", icon: Settings, href: "/settings", keywords: ["preferences", "config"] },
  { title: "Users & Access", icon: Settings, href: "/settings/users", keywords: ["permissions", "rbac"] },
  { title: "Integrations", icon: Settings, href: "/settings/integrations", keywords: ["apps", "connect"] },
  { title: "Audit Log", icon: Settings, href: "/settings/audit-log", keywords: ["history", "activity"] },
]

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
