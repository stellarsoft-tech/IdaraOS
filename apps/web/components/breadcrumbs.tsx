"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home } from "lucide-react"

const routeLabels: Record<string, string> = {
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
  tasks: "Tasks & Automations",
  checklists: "Checklists",
  settings: "Settings",
  users: "Users & Access",
  integrations: "Integrations",
  "audit-log": "Audit Log",
  branding: "Branding",
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return (
      <nav aria-label="breadcrumb" className="flex items-center">
        <Link href="/" className="flex items-center text-foreground" aria-label="Home">
          <Home className="h-4 w-4" />
        </Link>
      </nav>
    )
  }

  const breadcrumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
    const isLast = index === segments.length - 1

    return { href, label, isLast }
  })

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href="/"
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      {breadcrumbs.map((crumb) => (
        <div key={crumb.href} className="flex items-center gap-1">
          <span className="text-muted-foreground/60 select-none">/</span>
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
