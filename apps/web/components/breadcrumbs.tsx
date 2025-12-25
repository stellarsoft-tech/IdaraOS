"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home } from "lucide-react"
import { useBreadcrumb } from "./breadcrumb-context"

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  people: "People & HR",
  directory: "Directory",
  roles: "Roles & Teams",
  onboarding: "Onboarding",
  offboarding: "Offboarding",
  "time-off": "Time Off",
  documents: "Documents",
  assets: "Assets",
  inventory: "Inventory",
  assignments: "Assignments",
  maintenance: "Maintenance",
  disposal: "Disposal",
  security: "Security",
  frameworks: "Frameworks (IMS)",
  isms: "ISMS",
  "soc-1": "SOC 1",
  "soc-2": "SOC 2",
  risks: "Risk Register",
  controls: "Controls Library",
  audits: "Audits",
  evidence: "Evidence Store",
  soa: "Statement of Applicability",
  objectives: "Objectives & Plan",
  finance: "Finance",
  expenses: "Expenses",
  invoices: "Invoices",
  accounts: "Chart of Accounts",
  docs: "Docs & Policies",
  policies: "Policy Library",
  procedures: "Procedures / SOPs",
  attestations: "Attestations",
  approvals: "Approvals",
  vendors: "Vendors & Procurement",
  contracts: "Contracts",
  assessments: "Assessments",
  workflows: "Workflows",
  templates: "Templates",
  instances: "Instances",
  board: "Board",
  tasks: "Tasks & Automations",
  checklists: "Checklists",
  settings: "Settings",
  users: "Users & Access",
  integrations: "Integrations",
  "audit-log": "Audit Log",
  branding: "Branding",
  designer: "Designer",
}

// Check if a segment looks like a UUID
function isUuid(segment: string): boolean {
  return /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i.test(segment)
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const { detailLabel, parentLabel } = useBreadcrumb()

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "dashboard")) {
    return (
      <nav aria-label="breadcrumb" className="flex items-center">
        <Link href="/dashboard" className="flex items-center text-foreground" aria-label="Dashboard">
          <Home className="h-4 w-4" />
        </Link>
      </nav>
    )
  }

  const breadcrumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const isLast = index === segments.length - 1
    const isSecondToLast = index === segments.length - 2
    
    // Use custom labels based on position
    let label: string
    if (isLast && detailLabel) {
      // Use detail label for the last segment
      label = detailLabel
    } else if (isSecondToLast && parentLabel && isUuid(segment)) {
      // Use parent label for UUID segments that are second to last
      label = parentLabel
    } else if (isUuid(segment)) {
      // For UUID segments without a custom label, show truncated version
      label = segment.substring(0, 8) + "..."
    } else {
      label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
    }

    return { href, label, isLast }
  })

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard"
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dashboard"
      >
        <Home className="h-4 w-4" />
      </Link>
      {breadcrumbs.map((crumb) => (
        <div key={crumb.href} className="flex items-center gap-2">
          <span className="text-muted-foreground/50 select-none">/</span>
          {crumb.isLast ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
