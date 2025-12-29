# Security Module Architecture

## Overview

The Security module provides a comprehensive compliance and security management system (GRC - Governance, Risk, and Compliance). It features a generic foundation layer that applies to all security frameworks, with framework-specific sub-modules for ISO 27001, SOC 2, and other certifications.

## Key Principles

1. **Generic Foundation**: Core entities (risks, controls, evidence) are framework-agnostic
2. **Framework-Specific Views**: SoA, dashboards, and gap analysis are tailored per framework
3. **Unified Control Mapping**: Organization implements controls once, maps to multiple frameworks
4. **Pre-loaded Reference Library**: Standard controls from ISO 27001 Annex A and SOC 2 TSC included
5. **Evidence-Based Compliance**: All assertions backed by documented evidence

## Architecture Diagram

```mermaid
graph TB
    subgraph SecurityModule [Security Module]
        Overview[Overview Dashboard]
        
        subgraph GenericFoundation [Generic Foundation Layer]
            Risks[Risk Register]
            Controls[Controls Library]
            Evidence[Evidence Store]
            Audits[Audits]
            Objectives[Objectives]
        end
        
        subgraph FrameworksHub [Frameworks Hub]
            FrameworkList[Framework List]
            
            subgraph ISO27001 [ISO 27001 Sub-Module]
                ISO_SoA[Statement of Applicability]
                ISO_Controls[Annex A Controls]
                ISO_ISMS[ISMS Dashboard]
                ISO_Gaps[Gap Analysis]
            end
            
            subgraph SOC2 [SOC 2 Sub-Module]
                SOC_TSC[Trust Service Criteria]
                SOC_Evidence[Evidence Matrix]
                SOC_Gaps[Gap Analysis]
            end
        end
    end
    
    Overview --> Risks
    Overview --> Controls
    Overview --> FrameworkList
    
    Controls -->|maps to| ISO_Controls
    Controls -->|maps to| SOC_TSC
    Evidence -->|linked to| Controls
    Risks -->|mitigated by| Controls
```

## Module Navigation Structure

```mermaid
graph LR
    Security[Security] --> Overview[Overview]
    Security --> RiskRegister[Risk Register]
    Security --> ControlsLib[Controls Library]
    Security --> EvidenceStore[Evidence Store]
    Security --> Audits[Audits]
    Security --> Objectives[Objectives]
    Security --> Frameworks[Frameworks]
    
    Frameworks --> ISO[ISO 27001]
    Frameworks --> SOC[SOC 2]
    
    ISO --> ISO_Dash[Dashboard]
    ISO --> ISO_SoA[SoA]
    ISO --> ISO_Controls[Annex A]
    ISO --> ISO_Gaps[Gap Analysis]
    
    SOC --> SOC_Dash[Dashboard]
    SOC --> SOC_TSC[Trust Criteria]
    SOC --> SOC_Matrix[Evidence Matrix]
    SOC --> SOC_Gaps[Gap Analysis]
```

## Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    organizations ||--o{ security_frameworks : has
    organizations ||--o{ security_controls : implements
    organizations ||--o{ security_risks : identifies
    organizations ||--o{ security_evidence : collects
    organizations ||--o{ security_audits : conducts
    
    security_frameworks ||--o{ security_standard_controls : defines
    security_frameworks ||--o{ security_soa_items : contains
    
    security_controls ||--o{ security_control_mappings : maps_to
    security_standard_controls ||--o{ security_control_mappings : referenced_by
    
    security_controls ||--o{ security_evidence_links : documented_by
    security_evidence ||--o{ security_evidence_links : documents
    
    security_risks ||--o{ security_risk_controls : mitigated_by
    security_controls ||--o{ security_risk_controls : mitigates
    
    security_audits ||--o{ security_audit_findings : produces
    security_controls ||--o{ security_audit_findings : evaluated_in
    
    security_frameworks {
        uuid id PK
        uuid org_id FK
        string code
        string name
        string version
        enum status
        timestamp certified_at
        timestamp expires_at
    }
    
    security_standard_controls {
        uuid id PK
        string framework_code
        string control_id
        string category
        string subcategory
        string title
        text description
        boolean is_required
    }
    
    security_controls {
        uuid id PK
        uuid org_id FK
        string control_id
        string title
        text description
        uuid owner_id FK
        enum status
        enum implementation_status
        date last_tested
        date next_review
    }
    
    security_control_mappings {
        uuid id PK
        uuid org_control_id FK
        uuid standard_control_id FK
        string coverage_level
        text notes
    }
    
    security_risks {
        uuid id PK
        uuid org_id FK
        string risk_id
        string title
        text description
        uuid owner_id FK
        enum likelihood
        enum impact
        enum level
        enum status
        enum treatment
    }
    
    security_evidence {
        uuid id PK
        uuid org_id FK
        string title
        text description
        enum type
        string file_url
        date collected_at
        date valid_until
        uuid collected_by FK
    }
    
    security_soa_items {
        uuid id PK
        uuid framework_id FK
        uuid standard_control_id FK
        uuid org_control_id FK
        enum applicability
        text justification
        enum implementation_status
    }
    
    security_audits {
        uuid id PK
        uuid org_id FK
        uuid framework_id FK
        string title
        enum type
        enum status
        date start_date
        date end_date
        text scope
    }
    
    security_audit_findings {
        uuid id PK
        uuid audit_id FK
        uuid control_id FK
        enum severity
        string title
        text description
        enum status
        date due_date
    }
```

### Control Mapping Flow

```mermaid
flowchart LR
    subgraph OrgControls [Organization Controls]
        CTL001[CTL-001: Access Control Policy]
        CTL002[CTL-002: Password Management]
        CTL003[CTL-003: Network Segmentation]
    end
    
    subgraph ISO27001 [ISO 27001 Annex A]
        A51[A.5.1: Policies]
        A515[A.5.15: Access Control]
        A517[A.5.17: Authentication]
        A822[A.8.22: Network Segregation]
    end
    
    subgraph SOC2 [SOC 2 TSC]
        CC61[CC6.1: Security Software]
        CC62[CC6.2: Authentication]
        CC622[CC6.6: External Threats]
    end
    
    CTL001 -->|maps to| A51
    CTL001 -->|maps to| A515
    CTL001 -->|maps to| CC61
    
    CTL002 -->|maps to| A517
    CTL002 -->|maps to| CC62
    
    CTL003 -->|maps to| A822
    CTL003 -->|maps to| CC622
```

### Risk Assessment Flow

```mermaid
flowchart TB
    subgraph RiskAssessment [Risk Assessment Process]
        Identify[Identify Risk]
        Assess[Assess Inherent Risk]
        Treat[Determine Treatment]
        Implement[Implement Controls]
        Residual[Assess Residual Risk]
        Monitor[Monitor and Review]
    end
    
    Identify --> Assess
    Assess --> Treat
    Treat --> Implement
    Implement --> Residual
    Residual --> Monitor
    Monitor -->|periodic review| Assess
    
    subgraph RiskMatrix [5x5 Risk Matrix]
        direction TB
        VH[Very High]
        H[High]
        M[Medium]
        L[Low]
        VL[Very Low]
    end
    
    Assess -.->|likelihood x impact| RiskMatrix
    Residual -.->|after controls| RiskMatrix
```

### Compliance Workflow

```mermaid
sequenceDiagram
    participant Admin as Security Admin
    participant System as IdaraOS
    participant Framework as Framework Module
    participant SoA as SoA Engine
    
    Admin->>System: Add Framework (ISO 27001)
    System->>Framework: Initialize Framework
    Framework->>SoA: Auto-create SoA items (93 controls)
    SoA-->>Admin: SoA ready for review
    
    loop For Each Control
        Admin->>SoA: Set Applicability
        alt Not Applicable
            Admin->>SoA: Provide Justification
        else Applicable
            Admin->>SoA: Set Implementation Status
            Admin->>SoA: Link Org Control
            Admin->>SoA: Attach Evidence
        end
    end
    
    Admin->>Framework: View Gap Analysis
    Framework-->>Admin: Show unimplemented controls
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `security_frameworks` | Registered compliance frameworks per org |
| `security_standard_controls` | Pre-loaded reference controls (93 ISO 27001, 61 SOC 2) |
| `security_standard_clauses` | ISO 27001 ISMS clauses (4-10) definitions |
| `security_controls` | Organization's implemented controls (unified, single source of truth) |
| `security_control_mappings` | Links org controls to standard framework controls (many-to-many) |
| `security_risks` | Risk register with likelihood/impact scoring |
| `security_risk_controls` | Junction: which controls mitigate which risks |
| `security_evidence` | Evidence artifacts (documents, screenshots, etc.) |
| `security_evidence_links` | Junction: evidence linked to controls |
| `security_soa_items` | Statement of Applicability items (status derived from org control) |
| `security_clause_compliance` | ISMS clause compliance tracking per org/framework |
| `security_audits` | Internal/external audit records |
| `security_audit_findings` | Findings and NCRs from audits |
| `security_objectives` | Security objectives and treatment plans |

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/security/frameworks` | List/create frameworks |
| GET/PATCH/DELETE | `/api/security/frameworks/[id]` | CRUD for framework |
| GET | `/api/security/standard-controls` | Get pre-loaded standard controls |
| GET | `/api/security/standard-clauses` | Get ISO 27001 ISMS clauses (4-10) |
| GET/POST | `/api/security/controls` | List/create org controls |
| GET/PATCH/DELETE | `/api/security/controls/[id]` | CRUD for org control |
| GET/POST/DELETE | `/api/security/controls/[id]/mappings` | Manage control-to-standard mappings |
| POST | `/api/security/controls/create-from-standard` | Batch create controls from standard controls |
| GET/POST | `/api/security/risks` | List/create risks |
| GET/PATCH/DELETE | `/api/security/risks/[id]` | CRUD for risk |
| GET/POST | `/api/security/evidence` | List/create evidence |
| GET/PATCH/DELETE | `/api/security/evidence/[id]` | CRUD for evidence |
| GET | `/api/security/soa/[frameworkId]` | Get SoA items (status derived from org control) |
| PATCH | `/api/security/soa/[frameworkId]/items/[itemId]` | Update SoA item |
| GET/POST | `/api/security/clauses` | List/create clause compliance records |
| GET/PATCH/DELETE | `/api/security/clauses/[id]` | CRUD for clause compliance |
| GET/POST | `/api/security/audits` | List/create audits |

## Core Features

### 1. Risk Register

```mermaid
graph LR
    subgraph RiskCategories [Risk Categories]
        Op[Operational]
        Comp[Compliance]
        Strat[Strategic]
        Fin[Financial]
        Rep[Reputational]
        Tech[Technical]
    end
    
    subgraph Treatment [Treatment Options]
        Avoid[Avoid]
        Transfer[Transfer]
        Mitigate[Mitigate]
        Accept[Accept]
    end
    
    RiskCategories --> Treatment
```

- **Risk Assessment**: 5x5 likelihood/impact matrix (Inherent and Residual)
- **Control Linking**: Associate controls that mitigate each risk

### 2. Controls Library (Single Source of Truth)

The Controls Library is the **single source of truth** for control implementation. Framework compliance status is derived from org control status.

```mermaid
flowchart TB
    subgraph ControlsLibrary [Controls Library - Single Source of Truth]
        OrgControl[Org Control CTL-001]
        OrgControl2[Org Control CTL-002]
    end
    
    subgraph Frameworks [Framework Standards]
        AnnexA[Annex A Controls - 93]
        SOC2[SOC 2 Criteria - 61]
    end
    
    subgraph Mapping [Control Mappings]
        Map1["A.5.15 -> CTL-001"]
        Map2["CC6.1 -> CTL-001"]
        Map3["A.8.2 -> CTL-002"]
    end
    
    OrgControl --> Map1
    OrgControl --> Map2
    OrgControl2 --> Map3
    
    Map1 --> AnnexA
    Map2 --> SOC2
    Map3 --> AnnexA
```

- **Unified Controls**: Org defines controls once, implementation-agnostic
- **Framework Mapping**: Map to multiple framework controls (ISO 27001, SOC 2)
- **Derived Status**: SoA implementation status is derived from linked org control
- **Create from Standards**: Easily create org controls from Annex A or SOC 2 criteria
- **Framework Coverage**: See which frameworks each control satisfies
- **Status Tracking**: Not Implemented → Partially Implemented → Implemented → Effective
- **Evidence Linking**: Attach evidence to demonstrate control effectiveness
- **Review Scheduling**: Set review frequency, track last tested date

#### Control Creation Workflow

```mermaid
sequenceDiagram
    participant User as Security Admin
    participant AnnexA as Annex A Controls
    participant API as Create API
    participant Library as Controls Library
    participant SoA as SoA Items
    
    User->>AnnexA: Click "Create Control" on A.5.15
    AnnexA->>API: POST /controls/create-from-standard
    API->>Library: Create CTL-001 (title, description from A.5.15)
    API->>Library: Create mapping CTL-001 -> A.5.15
    API->>SoA: Link SoA item to CTL-001
    API-->>User: Redirect to CTL-001 detail page
    
    Note over User,SoA: Status Flow
    User->>Library: Update CTL-001 to "Implemented"
    Library-->>SoA: SoA shows A.5.15 as "Implemented" (derived)
```

### 3. Evidence Store

- **Evidence Types**: Document, Screenshot, Log, Report, Attestation, Configuration
- **Validity Tracking**: Collection date and expiry
- **Control Links**: Associate evidence with one or more controls
- **External References**: Link to external systems (Jira, Confluence, etc.)

### 4. Framework Management

- **Pre-loaded Controls**: ISO 27001:2022 Annex A (93), SOC 2 TSC (~60)
- **Statement of Applicability**: Track applicability and justification per control
- **Gap Analysis**: Identify missing or partially implemented controls
- **Compliance Metrics**: % complete, by category, over time

### 5. Audit Management

- **Audit Types**: Internal, External, Surveillance, Certification, Recertification
- **Finding Tracking**: Severity (Observation, Minor, Major, Critical)
- **Remediation Workflow**: Track responsible person, due date, resolution
- **Integration**: Link findings to specific controls

## Framework-Specific Features

### ISO 27001:2022

```mermaid
pie title ISO 27001 Annex A Control Distribution
    "Organizational (A.5)" : 37
    "People (A.6)" : 8
    "Physical (A.7)" : 14
    "Technological (A.8)" : 34
```

- **93 Annex A Controls** across 4 themes
- **Statement of Applicability** with justification for exclusions
- **ISMS Dashboard** with certification status and metrics

### SOC 2 Type II

```mermaid
pie title SOC 2 Trust Service Principles
    "Security (CC1-CC9)" : 33
    "Availability (A1)" : 3
    "Processing Integrity (PI1)" : 5
    "Confidentiality (C1)" : 2
    "Privacy (P1-P8)" : 17
```

- **Trust Service Criteria** organized by principle
- **Evidence Matrix** for audit preparation
- **Audit Readiness** metrics per TSC

## Permissions

| Resource | Owner | Admin | Security | Auditor | User |
|----------|-------|-------|----------|---------|------|
| security.overview | View | View | View | View | View |
| security.risks | Full | Full | Full | View | - |
| security.controls | Full | Full | Full | View | - |
| security.evidence | Full | Full | Full | View | - |
| security.audits | Full | Full | Full | View | - |
| security.frameworks | Full | Full | Full | View | - |
| security.soa | Full | Full | Full | View | - |
| security.settings | Full | Full | Edit | - | - |

## Integration Points

```mermaid
graph TB
    Security[Security Module]
    
    Security <-->|owners| People[People Module]
    Security <-->|policies as evidence| Docs[Docs Module]
    Security <-->|remediation workflows| Workflows[Workflows Module]
    Security <-->|asset controls| Assets[Assets Module]
    
    subgraph Examples [Integration Examples]
        E1[Control owner from People Directory]
        E2[Policy document as evidence]
        E3[Audit finding creates workflow task]
        E4[Asset encryption linked to control]
    end
```

## File Structure

```
apps/web/
├── app/
│   ├── api/security/
│   │   ├── controls/route.ts
│   │   ├── controls/[id]/route.ts
│   │   ├── controls/[id]/mappings/route.ts
│   │   ├── controls/create-from-standard/route.ts  # Batch create from standards
│   │   ├── evidence/route.ts
│   │   ├── evidence/[id]/route.ts
│   │   ├── risks/route.ts
│   │   ├── risks/[id]/route.ts
│   │   ├── frameworks/route.ts
│   │   ├── frameworks/[id]/route.ts
│   │   ├── standard-controls/route.ts
│   │   ├── standard-clauses/route.ts               # ISO 27001 ISMS clauses
│   │   ├── clauses/route.ts                        # Clause compliance
│   │   ├── clauses/[id]/route.ts
│   │   ├── soa/[frameworkId]/route.ts              # Derives status from org control
│   │   ├── soa/[frameworkId]/items/[itemId]/route.ts
│   │   └── audits/route.ts
│   └── (dashboard)/security/
│       ├── page.tsx                    # Overview
│       ├── risks/page.tsx              # Risk Register
│       ├── controls/
│       │   ├── page.tsx                # Controls Library (with framework badges)
│       │   └── [id]/
│       │       ├── page.tsx            # Control detail
│       │       └── mappings/page.tsx   # Manage framework mappings
│       ├── evidence/page.tsx           # Evidence Store
│       ├── audits/page.tsx             # Audits
│       ├── objectives/page.tsx         # Objectives
│       └── frameworks/
│           ├── page.tsx                # Frameworks list
│           ├── iso-27001/
│           │   ├── page.tsx            # ISO 27001 Dashboard
│           │   ├── soa/page.tsx        # Statement of Applicability
│           │   ├── controls/page.tsx   # Annex A browser (with Create Control buttons)
│           │   ├── clauses/page.tsx    # ISMS Clauses (4-10) tracking
│           │   ├── evidence/page.tsx   # Evidence matrix
│           │   └── gaps/page.tsx       # Gap analysis
│           └── soc-2/
│               ├── page.tsx            # SOC 2 Dashboard
│               ├── criteria/page.tsx   # TSC browser (with Create Control buttons)
│               ├── soa/page.tsx        # Statement of Applicability
│               ├── evidence/page.tsx   # Evidence matrix
│               └── gaps/page.tsx       # Gap analysis
├── lib/
│   ├── api/security.ts                 # React Query hooks
│   └── db/schema/security.ts           # Database schema
└── scripts/
    └── seed-security-controls.ts       # Pre-load standard controls + ISMS clauses
```

## Usage Examples

### Adding ISO 27001 Framework

1. Navigate to Security → Frameworks
2. Click "Add Framework"
3. Select "ISO/IEC 27001:2022"
4. SoA items are auto-created for all 93 Annex A controls
5. Review and update applicability for each control

### Creating Controls from Annex A (Recommended Workflow)

1. Navigate to Security → Frameworks → ISO 27001 → Annex A Controls
2. Browse controls by category (Organizational, People, Physical, Technological)
3. For each applicable control, click the "+" button to create an org control
4. Or click "Create All Controls" to batch create all unmapped controls
5. The system auto-generates control IDs (CTL-001, CTL-002, etc.)
6. Each control is automatically mapped to its source Annex A control
7. Navigate to the control detail page to set owner, status, and add evidence

### Creating an Org Control Manually

1. Navigate to Security → Controls Library
2. Click "New Control"
3. Enter control details (ID, title, description)
4. Navigate to the control and click "Manage Mappings"
5. Map to framework standard controls (Annex A, SOC 2 criteria)
6. Link supporting evidence
7. Set review schedule

### Managing Control Mappings

1. Navigate to Security → Controls Library
2. Click on a control to view details
3. Go to "Framework Mappings" tab or click "Manage Mappings"
4. Add mappings by selecting framework and standard control
5. Set coverage level (Full or Partial)
6. One org control can map to multiple framework controls

### Framework Compliance from Controls (Derived Status)

1. In Controls Library, update a control's implementation status to "Implemented"
2. Navigate to ISO 27001 → Statement of Applicability
3. All Annex A controls mapped to that org control now show "Implemented"
4. Same applies to SOC 2 criteria linked to the same control

### Updating SoA for ISO 27001

1. Navigate to Security → Frameworks → ISO 27001 → Statement of Applicability
2. Click on a control to edit
3. Set applicability (Applicable / Not Applicable)
4. If N/A, provide justification (required)
5. Note: Implementation status is derived from linked org control

## Future Enhancements

- [ ] Additional frameworks (NIST CSF, GDPR, HIPAA)
- [ ] Automated evidence collection via integrations
- [ ] Risk heat maps and trend analysis
- [ ] Control testing automation
- [ ] Audit workflow integration
- [ ] Export to PDF/Excel for auditors
- [ ] AI-assisted gap analysis recommendations
- [ ] Control effectiveness scoring
- [ ] Compliance timeline and trend charts
- [ ] Cross-framework control mapping suggestions
