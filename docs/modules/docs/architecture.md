# Documentation Module Architecture

## Overview

The Documentation module provides a comprehensive system for managing organizational documentation including policies, procedures, guidelines, and training materials. It supports:

- **Document Management**: Create, edit, version, and publish documents
- **MDX Rendering**: Rich Markdown/MDX content with custom components
- **Mermaid Diagrams**: Flowcharts, sequence diagrams with pan/zoom/fullscreen
- **Rollout Management**: Target documents to teams, roles, or the entire organization
- **Acknowledgment Tracking**: Track read status, acknowledgments, and signatures
- **RBAC Integration**: Fine-grained permissions for document management

## Architecture Overview

```mermaid
flowchart TB
    subgraph storage [Storage Layer]
        MDXFiles[MDX Files<br/>content/docs/*.mdx]
        DB[(PostgreSQL)]
    end
    
    subgraph api [API Layer]
        DocsAPI["/api/docs/documents"]
        RolloutsAPI["/api/docs/rollouts"]
        AcksAPI["/api/docs/acknowledgments"]
        MyDocsAPI["/api/docs/my-documents"]
    end
    
    subgraph ui [UI Layer]
        AdminView[Admin Views]
        UserView[User Views]
    end
    
    MDXFiles --> DocsAPI
    DB --> DocsAPI
    DB --> RolloutsAPI
    DB --> AcksAPI
    DB --> MyDocsAPI
    
    DocsAPI --> AdminView
    RolloutsAPI --> AdminView
    AcksAPI --> AdminView
    MyDocsAPI --> UserView
    DocsAPI --> UserView
```

## Database Entity Relationship Diagram

```mermaid
erDiagram
    core_organizations ||--o{ docs_documents : has
    core_organizations ||--o| docs_settings : has
    docs_documents ||--o{ docs_document_versions : has
    docs_documents ||--o{ docs_document_rollouts : has
    docs_documents ||--o{ docs_document_acknowledgments : has
    docs_document_rollouts ||--o{ docs_document_acknowledgments : creates
    people_persons ||--o{ docs_documents : owns
    core_users ||--o{ docs_document_acknowledgments : acknowledges
    people_teams }o--o{ docs_document_rollouts : targets
    rbac_roles }o--o{ docs_document_rollouts : targets
    
    docs_documents {
        uuid id PK
        uuid org_id FK
        text slug UK
        text title
        text description
        text category
        jsonb tags
        text status
        text current_version
        uuid owner_id FK
        boolean show_header
        boolean show_footer
        jsonb metadata
        timestamp created_at
        timestamp updated_at
        timestamp published_at
    }
    
    docs_document_versions {
        uuid id PK
        uuid document_id FK
        text version
        text change_description
        text change_summary
        uuid approved_by_id FK
        timestamp approved_at
        text content_snapshot
        timestamp created_at
    }
    
    docs_document_rollouts {
        uuid id PK
        uuid document_id FK
        text target_type
        uuid target_id
        text requirement
        date due_date
        boolean is_active
        boolean send_notification
        integer reminder_frequency_days
        timestamp created_at
    }
    
    docs_document_acknowledgments {
        uuid id PK
        uuid document_id FK
        uuid rollout_id FK
        uuid user_id FK
        uuid person_id FK
        text status
        text version_acknowledged
        timestamp viewed_at
        timestamp acknowledged_at
        timestamp signed_at
        jsonb signature_data
    }
    
    docs_settings {
        uuid id PK
        uuid org_id FK "unique"
        integer default_review_frequency_days
        text default_requirement
        boolean enable_email_notifications
        text footer_text
        jsonb settings
    }
```

## Document Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: Create
    Draft --> Draft: Edit Content
    Draft --> InReview: Submit for Review
    InReview --> Draft: Request Changes
    InReview --> Published: Approve
    Published --> Archived: Archive
    Published --> Draft: Create New Version
    Archived --> Published: Restore
    Archived --> [*]: Delete
```

## Document Creation Sequence

```mermaid
sequenceDiagram
    participant Admin
    participant UI as React UI
    participant API as Next.js API
    participant DB as PostgreSQL
    participant FS as File System
    
    Admin->>UI: Create New Document
    UI->>API: POST /api/docs/documents
    API->>DB: Insert document metadata
    API->>FS: Write MDX file to content/docs/
    DB-->>API: Return document record
    FS-->>API: Confirm file written
    API-->>UI: Return created document
    UI-->>Admin: Show document editor
    
    Admin->>UI: Edit Content
    UI->>API: PUT /api/docs/documents/[id]
    API->>FS: Update MDX file
    API->>DB: Update metadata
    API-->>UI: Return updated document
    
    Admin->>UI: Publish Document
    UI->>API: PUT /api/docs/documents/[id]
    API->>DB: Update status to published
    API->>DB: Create version record
    API-->>UI: Return published document
    UI-->>Admin: Show success
```

## Rollout and Acknowledgment Flow

```mermaid
sequenceDiagram
    participant Admin
    participant API as Next.js API
    participant DB as PostgreSQL
    participant User
    
    Admin->>API: POST /api/docs/rollouts
    Note right of API: Create rollout with target
    API->>DB: Insert rollout record
    API->>DB: Query target users
    API->>DB: Create acknowledgment records
    API-->>Admin: Rollout created
    
    User->>API: GET /api/docs/my-documents
    API->>DB: Query pending acknowledgments
    API-->>User: List of pending docs
    
    User->>API: GET /api/docs/documents/[slug]
    API->>DB: Get document metadata
    API-->>User: Document with content
    Note right of User: User reads document
    
    User->>API: PUT /api/docs/acknowledgments/[id]
    Note right of API: status: viewed
    API->>DB: Update acknowledgment
    API-->>User: Acknowledged
    
    User->>API: PUT /api/docs/acknowledgments/[id]
    Note right of API: status: signed
    API->>DB: Update with signature data
    API-->>User: Signed
```

## High-Level Process Flow

```mermaid
flowchart TB
    subgraph creation [Document Creation]
        C1[Create Draft] --> C2[Write MDX Content]
        C2 --> C3[Configure Settings]
        C3 --> C4[Submit for Review]
        C4 --> C5{Approved?}
        C5 -->|Yes| C6[Publish]
        C5 -->|No| C2
    end
    
    subgraph rollout [Rollout Process]
        R1[Select Target Type] --> R2{Target Type}
        R2 -->|Organization| R3[All Users]
        R2 -->|Team| R4[Select Team]
        R2 -->|Role| R5[Select Role]
        R2 -->|User| R6[Select User]
        R3 --> R7[Set Requirements]
        R4 --> R7
        R5 --> R7
        R6 --> R7
        R7 --> R8[Set Due Date]
        R8 --> R9[Activate Rollout]
        R9 --> R10[Create Acknowledgments]
    end
    
    subgraph acknowledgment [Acknowledgment Flow]
        A1[User Sees in My Docs] --> A2[Opens Document]
        A2 --> A3[Reads Content]
        A3 --> A4{Signature Required?}
        A4 -->|Yes| A5[Type Signature]
        A5 --> A6[Confirm Agreement]
        A6 --> A7[Document Signed]
        A4 -->|No| A8[Click Acknowledge]
        A8 --> A9[Document Acknowledged]
    end
    
    C6 --> R1
    R10 --> A1
```

## Admin Acknowledgment Tracking UX

Acknowledgments are accessed through a document-centric workflow:

```mermaid
flowchart LR
    subgraph DocEdit [Document Edit Page]
        A[Rollouts Tab] --> B[Click Rollout Card]
        B --> C[Rollout Detail Drawer]
        C --> D[Acknowledgments DataTable]
    end
    
    subgraph Summary [Acknowledgments Tab]
        E[Stats Summary Only]
        E --> F[Total/Pending/Viewed/Completed]
        E --> G[Link to Rollouts Tab]
    end
```

**Key UX Decisions:**
- No standalone attestations page - acknowledgments are per-document
- Rollout cards are clickable and show progress bars
- Clicking a rollout opens a slide-out drawer with a paginated DataTable
- Acknowledgments tab shows only aggregate statistics
- Edit button on document view page (RBAC-gated)

## Acknowledgment State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: Rollout Created
    pending --> viewed: User Opens Document
    viewed --> acknowledged: User Clicks Acknowledge
    viewed --> signed: User Signs Document
    acknowledged --> signed: Upgrade to Signature
    signed --> [*]: Complete
    acknowledged --> [*]: Complete
```

## Database Schema Tables

### docs_documents
Primary table for document metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| org_id | UUID | Organization reference |
| slug | TEXT | URL-friendly identifier |
| title | TEXT | Document title |
| description | TEXT | Brief description |
| category | ENUM | policy, procedure, guideline, manual, template, training, general |
| tags | JSONB | Array of tags |
| status | ENUM | draft, in_review, published, archived |
| current_version | TEXT | Current version string (e.g., "1.0") |
| owner_id | UUID | Person who owns the document |
| show_header | BOOLEAN | Display metadata header |
| show_footer | BOOLEAN | Display version history footer |
| show_version_history | BOOLEAN | Display collapsible version history |
| metadata | JSONB | Additional metadata (effectiveDate, confidentiality, etc.) |

### docs_document_versions
Version history for documents.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | Document reference |
| version | TEXT | Version string |
| change_description | TEXT | Detailed change notes |
| change_summary | TEXT | Brief summary |
| approved_by_id | UUID | Person who approved |
| approved_at | TIMESTAMP | Approval timestamp |
| content_snapshot | TEXT | Optional MDX content snapshot |

### docs_document_rollouts
Defines who needs to read/acknowledge documents.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | Document reference |
| target_type | ENUM | organization, team, role, user |
| target_id | UUID | Target entity (null for org-wide) |
| requirement | ENUM | optional, required, required_with_signature |
| due_date | DATE | When acknowledgment is due |
| is_active | BOOLEAN | Whether rollout is active |
| send_notification | BOOLEAN | Send email notifications |

### docs_document_acknowledgments
Tracks user reading/signing.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | Document reference |
| rollout_id | UUID | Rollout reference |
| user_id | UUID | User who needs to acknowledge |
| status | ENUM | pending, viewed, acknowledged, signed |
| version_acknowledged | TEXT | Version they acknowledged |
| viewed_at | TIMESTAMP | When first viewed |
| acknowledged_at | TIMESTAMP | When acknowledged |
| signed_at | TIMESTAMP | When signed |
| signature_data | JSONB | Signature method and value |

## MDX Components

### Available in Documents

```mdx
# Standard Markdown
- Headers (h1-h6)
- Bold, italic, code
- Lists (ordered/unordered)
- Links and images
- Tables
- Code blocks

# Custom Components
<DocumentHeader
  title="Policy Name"
  version="1.0"
  status="published"
  category="policy"
  owner={{ name: "John Doe" }}
  effectiveDate="2024-01-01"
  confidentiality="internal"
  tags={["security", "hr"]}
/>

<Callout variant="warning" title="Important">
  This is a warning callout.
</Callout>

<MermaidDiagram chart={`
flowchart LR
    A[Start] --> B[Process] --> C[End]
`} />

<DocumentFooter
  showVersionHistory={true}
  versions={[...]}
  lastReviewedAt="2024-01-01"
  nextReviewAt="2025-01-01"
/>
```

### Mermaid Diagram Features
- Pan: Click and drag
- Zoom: Mouse wheel
- Fullscreen: Expand button
- Reset: Reset view button

## RBAC Permissions

| Permission | Actions | Roles |
|------------|---------|-------|
| docs.overview | read | User, HR, Security, Auditor, Admin, Owner |
| docs.documents | read | User, HR, Security, Auditor, Admin, Owner |
| docs.documents.write | create, edit | HR, Security, Admin, Owner |
| docs.documents.delete | delete | Admin, Owner |
| docs.documents.publish | publish | HR, Security, Admin, Owner |
| docs.rollouts | read | HR, Security, Admin, Owner |
| docs.rollouts.write | create, edit, delete | HR, Security, Admin, Owner |
| docs.acknowledgments | read | HR, Security, Auditor, Admin, Owner |
| docs.settings | read, write | Admin, Owner |

## File Structure

```
apps/web/
├── app/
│   ├── api/docs/
│   │   ├── documents/
│   │   │   ├── route.ts           # List/create documents
│   │   │   └── [id]/
│   │   │       └── route.ts       # Get/update/delete document
│   │   ├── rollouts/
│   │   │   ├── route.ts           # List/create rollouts
│   │   │   └── [id]/
│   │   │       └── route.ts       # Get/update/delete rollout
│   │   ├── acknowledgments/
│   │   │   ├── route.ts           # List acknowledgments (supports rolloutId filter)
│   │   │   └── [id]/
│   │   │       └── route.ts       # Update acknowledgment
│   │   └── my-documents/
│   │       └── route.ts           # User's pending documents
│   └── (dashboard)/docs/
│       ├── page.tsx               # Overview
│       ├── documents/
│       │   ├── page.tsx           # Document library
│       │   ├── new/
│       │   │   └── page.tsx       # Create document
│       │   └── [slug]/
│       │       ├── page.tsx       # Edit document (with rollout drawer)
│       │       └── rollouts/
│       │           └── new/
│       │               └── page.tsx # Create rollout
│       ├── my-documents/
│       │   └── page.tsx           # My pending docs
│       ├── view/
│       │   └── [slug]/
│       │       └── page.tsx       # Document viewer (with edit button)
│       ├── policies/
│       │   └── page.tsx           # Policy documents
│       ├── procedures/
│       │   └── page.tsx           # SOP documents
│       └── settings/
│           └── page.tsx           # Module settings
├── components/docs/
│   ├── index.ts                   # Exports
│   ├── mdx-renderer.tsx           # MDX rendering
│   ├── document-header.tsx        # Header component
│   ├── document-footer.tsx        # Footer component
│   ├── mermaid-diagram.tsx        # Mermaid with pan/zoom
│   ├── callout.tsx                # Callout boxes
│   ├── table-of-contents.tsx      # ToC with scrollspy
│   └── rollout-detail-drawer.tsx  # Rollout acknowledgments drawer
├── content/docs/
│   └── *.mdx                      # MDX document files
└── lib/
    ├── api/docs.ts                # React Query hooks
    ├── docs/
    │   ├── mdx.ts                 # MDX file utilities
    │   └── types.ts               # TypeScript types & Zod schemas
    └── db/schema/docs.ts          # Drizzle schema
```

## Integration Points

### Security Module
- Link documents to security controls via `linked_control_ids`
- Reference in compliance frameworks via `linked_framework_codes`
- Track as evidence for audits

### Workflows Module
- Approval workflows for publishing
- Review workflows for periodic reviews

### People Module
- Owner assignment from person directory
- Team-based rollouts
- Role-based rollouts

## Future Enhancements

- [ ] Document templates
- [ ] AI-assisted writing
- [ ] Document comparison/diff view
- [ ] Export to PDF
- [ ] Email notifications for rollouts
- [ ] Slack integration for reminders
- [ ] Analytics dashboard
- [ ] Document search (full-text)
- [ ] Version bump wizard on publish
- [ ] Bulk rollout management
- [ ] Document expiry alerts
