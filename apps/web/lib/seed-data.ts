export interface Person {
  id: string
  slug: string
  name: string
  email: string
  role: string
  team: string
  startDate: string
  status: "active" | "inactive" | "onboarding" | "offboarding"
  assignedAssets: number
  avatar?: string
}

export interface Asset {
  id: string
  tag: string
  type: "laptop" | "monitor" | "phone" | "tablet" | "accessory"
  model: string
  owner: string
  status: "assigned" | "available" | "maintenance" | "disposed"
  warrantyEnd: string
  location: string
}

export interface Risk {
  id: string
  title: string
  description: string
  owner: string
  likelihood: "low" | "medium" | "high"
  impact: "low" | "medium" | "high"
  level: "low" | "medium" | "high" | "critical"
  status: "open" | "mitigated" | "accepted" | "closed"
  framework: string
}

export interface Control {
  id: string
  title: string
  description: string
  framework: string
  status: "designed" | "implemented" | "effective"
  evidenceCount: number
  owner: string
}

export interface Audit {
  id: string
  title: string
  type: "internal" | "external"
  status: "planned" | "in-progress" | "completed"
  startDate: string
  endDate: string
  findings: number
}

export interface Policy {
  id: string
  title: string
  version: string
  status: "draft" | "in-review" | "published"
  owner: string
  nextReview: string
  category: string
}

export interface Checklist {
  id: string
  title: string
  description: string
  steps: number
  category: string
}

export const people: Person[] = [
  {
    id: "1",
    slug: "hamza-abdullah",
    name: "Hamza Abdullah",
    email: "hamza@idaraos.com",
    role: "CEO",
    team: "Executive",
    startDate: "2020-01-15",
    status: "active",
    assignedAssets: 3,
  },
  {
    id: "2",
    slug: "sarah-chen",
    name: "Sarah Chen",
    email: "sarah@idaraos.com",
    role: "CTO",
    team: "Engineering",
    startDate: "2020-02-01",
    status: "active",
    assignedAssets: 4,
  },
  {
    id: "3",
    slug: "michael-brown",
    name: "Michael Brown",
    email: "michael@idaraos.com",
    role: "Security Lead",
    team: "Security",
    startDate: "2021-03-10",
    status: "active",
    assignedAssets: 2,
  },
  {
    id: "4",
    slug: "emily-davis",
    name: "Emily Davis",
    email: "emily@idaraos.com",
    role: "HR Manager",
    team: "People",
    startDate: "2021-06-15",
    status: "active",
    assignedAssets: 2,
  },
  {
    id: "5",
    slug: "james-wilson",
    name: "James Wilson",
    email: "james@idaraos.com",
    role: "Finance Director",
    team: "Finance",
    startDate: "2022-01-05",
    status: "active",
    assignedAssets: 2,
  },
  {
    id: "6",
    slug: "lisa-martinez",
    name: "Lisa Martinez",
    email: "lisa@idaraos.com",
    role: "Software Engineer",
    team: "Engineering",
    startDate: "2024-10-01",
    status: "onboarding",
    assignedAssets: 1,
  },
]

export const assets: Asset[] = [
  {
    id: "1",
    tag: "LAP-001",
    type: "laptop",
    model: 'MacBook Pro 16"',
    owner: "Hamza Abdullah",
    status: "assigned",
    warrantyEnd: "2026-01-15",
    location: "HQ",
  },
  {
    id: "2",
    tag: "LAP-002",
    type: "laptop",
    model: 'MacBook Pro 14"',
    owner: "Sarah Chen",
    status: "assigned",
    warrantyEnd: "2025-06-20",
    location: "HQ",
  },
  {
    id: "3",
    tag: "LAP-003",
    type: "laptop",
    model: "ThinkPad X1 Carbon",
    owner: "Michael Brown",
    status: "assigned",
    warrantyEnd: "2025-09-10",
    location: "HQ",
  },
  {
    id: "4",
    tag: "MON-001",
    type: "monitor",
    model: 'Dell UltraSharp 27"',
    owner: "Hamza Abdullah",
    status: "assigned",
    warrantyEnd: "2025-03-01",
    location: "HQ",
  },
  {
    id: "5",
    tag: "MON-002",
    type: "monitor",
    model: 'LG 32" 4K',
    owner: "Sarah Chen",
    status: "assigned",
    warrantyEnd: "2025-08-15",
    location: "HQ",
  },
  {
    id: "6",
    tag: "PHN-001",
    type: "phone",
    model: "iPhone 15 Pro",
    owner: "Hamza Abdullah",
    status: "assigned",
    warrantyEnd: "2025-10-01",
    location: "HQ",
  },
  {
    id: "7",
    tag: "LAP-004",
    type: "laptop",
    model: 'MacBook Air 13"',
    owner: "",
    status: "available",
    warrantyEnd: "2026-02-28",
    location: "Storage",
  },
  {
    id: "8",
    tag: "TAB-001",
    type: "tablet",
    model: 'iPad Pro 12.9"',
    owner: "Emily Davis",
    status: "assigned",
    warrantyEnd: "2025-12-10",
    location: "HQ",
  },
  {
    id: "9",
    tag: "LAP-005",
    type: "laptop",
    model: "Dell XPS 15",
    owner: "",
    status: "maintenance",
    warrantyEnd: "2024-11-30",
    location: "IT Dept",
  },
  {
    id: "10",
    tag: "ACC-001",
    type: "accessory",
    model: "Apple Magic Keyboard",
    owner: "James Wilson",
    status: "assigned",
    warrantyEnd: "2025-05-20",
    location: "HQ",
  },
]

export const risks: Risk[] = [
  {
    id: "RSK-001",
    title: "Unauthorized data access",
    description: "Risk of unauthorized access to sensitive customer data",
    owner: "Michael Brown",
    likelihood: "medium",
    impact: "high",
    level: "high",
    status: "open",
    framework: "ISMS",
  },
  {
    id: "RSK-002",
    title: "Phishing attacks",
    description: "Employees falling victim to phishing emails",
    owner: "Michael Brown",
    likelihood: "high",
    impact: "medium",
    level: "high",
    status: "mitigated",
    framework: "ISMS",
  },
  {
    id: "RSK-003",
    title: "System downtime",
    description: "Critical systems becoming unavailable",
    owner: "Sarah Chen",
    likelihood: "low",
    impact: "high",
    level: "medium",
    status: "open",
    framework: "ISMS",
  },
  {
    id: "RSK-004",
    title: "Data backup failure",
    description: "Failure of backup systems leading to data loss",
    owner: "Sarah Chen",
    likelihood: "low",
    impact: "high",
    level: "medium",
    status: "mitigated",
    framework: "ISMS",
  },
  {
    id: "RSK-005",
    title: "Third-party vendor breach",
    description: "Security breach through vendor access",
    owner: "Michael Brown",
    likelihood: "medium",
    impact: "high",
    level: "high",
    status: "open",
    framework: "ISMS",
  },
  {
    id: "RSK-006",
    title: "Compliance violation",
    description: "Failure to meet regulatory requirements",
    owner: "James Wilson",
    likelihood: "low",
    impact: "high",
    level: "medium",
    status: "accepted",
    framework: "SOC 2",
  },
]

export const controls: Control[] = [
  {
    id: "CTL-001",
    title: "Access Control Policy",
    description: "Define and enforce access control policies",
    framework: "ISO 27001 A.9",
    status: "effective",
    evidenceCount: 5,
    owner: "Michael Brown",
  },
  {
    id: "CTL-002",
    title: "Encryption at Rest",
    description: "Encrypt all data at rest using AES-256",
    framework: "ISO 27001 A.10",
    status: "effective",
    evidenceCount: 3,
    owner: "Sarah Chen",
  },
  {
    id: "CTL-003",
    title: "Security Awareness Training",
    description: "Annual security awareness training for all employees",
    framework: "ISO 27001 A.7",
    status: "implemented",
    evidenceCount: 8,
    owner: "Emily Davis",
  },
  {
    id: "CTL-004",
    title: "Incident Response Plan",
    description: "Documented incident response procedures",
    framework: "ISO 27001 A.16",
    status: "effective",
    evidenceCount: 4,
    owner: "Michael Brown",
  },
  {
    id: "CTL-005",
    title: "Vulnerability Management",
    description: "Regular vulnerability scanning and patching",
    framework: "ISO 27001 A.12",
    status: "implemented",
    evidenceCount: 12,
    owner: "Sarah Chen",
  },
  {
    id: "CTL-006",
    title: "Change Management",
    description: "Formal change management process",
    framework: "ISO 27001 A.12",
    status: "designed",
    evidenceCount: 2,
    owner: "Sarah Chen",
  },
  {
    id: "CTL-007",
    title: "Business Continuity Plan",
    description: "Documented BCP with regular testing",
    framework: "ISO 27001 A.17",
    status: "implemented",
    evidenceCount: 3,
    owner: "Hamza Abdullah",
  },
  {
    id: "CTL-008",
    title: "Supplier Security Assessment",
    description: "Security assessment for all critical vendors",
    framework: "ISO 27001 A.15",
    status: "effective",
    evidenceCount: 6,
    owner: "Michael Brown",
  },
  {
    id: "CTL-009",
    title: "Physical Security",
    description: "Physical access controls to facilities",
    framework: "ISO 27001 A.11",
    status: "effective",
    evidenceCount: 4,
    owner: "Emily Davis",
  },
  {
    id: "CTL-010",
    title: "Logging and Monitoring",
    description: "Centralized logging and security monitoring",
    framework: "ISO 27001 A.12",
    status: "implemented",
    evidenceCount: 7,
    owner: "Michael Brown",
  },
]

export const audits: Audit[] = [
  {
    id: "AUD-001",
    title: "ISO 27001 Certification Audit",
    type: "external",
    status: "completed",
    startDate: "2024-06-01",
    endDate: "2024-06-15",
    findings: 3,
  },
  {
    id: "AUD-002",
    title: "SOC 2 Type II Audit",
    type: "external",
    status: "in-progress",
    startDate: "2024-10-01",
    endDate: "2024-12-15",
    findings: 0,
  },
  {
    id: "AUD-003",
    title: "Q4 Internal Security Review",
    type: "internal",
    status: "planned",
    startDate: "2024-12-01",
    endDate: "2024-12-20",
    findings: 0,
  },
]

export const policies: Policy[] = [
  {
    id: "POL-001",
    title: "Information Security Policy",
    version: "3.0",
    status: "published",
    owner: "Michael Brown",
    nextReview: "2025-06-01",
    category: "Security",
  },
  {
    id: "POL-002",
    title: "Acceptable Use Policy",
    version: "2.1",
    status: "published",
    owner: "Emily Davis",
    nextReview: "2025-03-15",
    category: "HR",
  },
  {
    id: "POL-003",
    title: "Data Classification Policy",
    version: "1.2",
    status: "in-review",
    owner: "Michael Brown",
    nextReview: "2025-01-01",
    category: "Security",
  },
  {
    id: "POL-004",
    title: "Remote Work Policy",
    version: "2.0",
    status: "published",
    owner: "Emily Davis",
    nextReview: "2025-04-01",
    category: "HR",
  },
  {
    id: "POL-005",
    title: "Vendor Management Policy",
    version: "1.0",
    status: "draft",
    owner: "James Wilson",
    nextReview: "2025-02-01",
    category: "Procurement",
  },
  {
    id: "POL-006",
    title: "Incident Response Policy",
    version: "2.5",
    status: "published",
    owner: "Michael Brown",
    nextReview: "2025-05-01",
    category: "Security",
  },
]

export const checklists: Checklist[] = [
  {
    id: "CHK-001",
    title: "Employee Onboarding",
    description: "Complete onboarding checklist for new hires",
    steps: 12,
    category: "HR",
  },
  {
    id: "CHK-002",
    title: "Employee Offboarding",
    description: "Secure offboarding process for departing employees",
    steps: 10,
    category: "HR",
  },
  {
    id: "CHK-003",
    title: "Quarterly Access Review",
    description: "Review and validate user access permissions",
    steps: 8,
    category: "Security",
  },
]

export const teams = ["Executive", "Engineering", "Security", "People", "Finance", "Operations"]
export const roles = [
  "CEO",
  "CTO",
  "Security Lead",
  "HR Manager",
  "Finance Director",
  "Software Engineer",
  "Product Manager",
  "Designer",
]
