# People & HR Module

## Overview

The People & HR module manages workforce information, employee lifecycle, and HR operations. It serves as a foundational module that other modules reference for people-related data (assignees, owners, approvers).

## Module Structure

```mermaid
graph TB
    subgraph "People & HR Module"
        OVERVIEW[Overview Dashboard]
        DIR[People Directory]
        DETAIL[Person Detail]
        ONBOARD[Onboarding]
        TIMEOFF[Time Off]
        ROLES[HR Roles]
    end
    
    OVERVIEW --> DIR
    DIR --> DETAIL
    DETAIL --> |linked to| USERS[Settings: Users]
    ONBOARD --> DIR
    TIMEOFF --> DIR
    
    subgraph "External References"
        USERS
        ENTRA[Entra ID]
    end
    
    ENTRA --> |provisions| DIR
    ENTRA --> |provisions| USERS
```

## Sub-Modules

### Overview Dashboard (`/people`)

High-level view of workforce metrics and quick access to sub-modules.

**Features:**
- Total people count
- Active employees count
- Onboarding in progress
- Teams count
- Quick links to sub-modules
- Recent activity timeline

### People Directory (`/people/directory`)

Central employee listing with full CRUD capabilities.

**Features:**
- Searchable, filterable data table
- Faceted filters (status, team, role, start date)
- Create person via drawer form
- Edit person via drawer form
- Delete person with confirmation
- Link/unlink to user account
- Column visibility toggle
- CSV export
- Click row to view details
- Stats cards (total, active, recent hires, teams)

### Person Detail (`/people/directory/[slug]`)

Individual employee profile view.

**Features:**
- Profile information display
- Edit capability
- Link to user account
- Status indicators
- Entra ID badge if synced

### Onboarding (`/people/onboarding`) - Placeholder

New hire workflow management.

**Planned Features:**
- Onboarding checklist templates
- Task assignment and tracking
- Progress indicators
- Automated provisioning triggers

### Time Off (`/people/time-off`) - Placeholder

Leave request and calendar management.

**Planned Features:**
- Leave request submission
- Approval workflow
- Calendar view
- Balance tracking
- Policy configuration

### HR Roles (`/people/roles`) - Placeholder

HR-specific role management.

**Planned Features:**
- Job title definitions
- Reporting structures
- Compensation bands

---

## Permissions

### Permission Matrix

| Sub-Module | Action | Owner | Admin | HR | User |
|------------|--------|-------|-------|-----|------|
| Overview | View | Yes | Yes | Yes | Yes |
| Directory | View | Yes | Yes | Yes | Yes |
| Directory | Create | Yes | Yes | Yes | No |
| Directory | Edit | Yes | Yes | Yes | No |
| Directory | Delete | Yes | Yes | No | No |
| Person Detail | View | Yes | Yes | Yes | Yes |
| Person Detail | Edit | Yes | Yes | Yes | No |
| Onboarding | View | Yes | Yes | Yes | No |
| Onboarding | Manage | Yes | Yes | Yes | No |
| Time Off | View | Yes | Yes | Yes | Own |
| Time Off | Request | Yes | Yes | Yes | Yes |
| Time Off | Approve | Yes | Yes | Yes | No |

### Permission Diagram

```mermaid
graph LR
    subgraph "People Permissions"
        OWNER[Owner]
        ADMIN[Admin]
        HR[HR]
        USER[User]
    end
    
    subgraph "Modules"
        OVR[Overview]
        DIR[Directory]
        DET[Detail]
        ONB[Onboarding]
        TOF[Time Off]
    end
    
    OWNER -->|full access| OVR
    OWNER -->|full access| DIR
    OWNER -->|full access| DET
    OWNER -->|full access| ONB
    OWNER -->|full access| TOF
    
    ADMIN -->|full access| OVR
    ADMIN -->|full access| DIR
    ADMIN -->|full access| DET
    ADMIN -->|full access| ONB
    ADMIN -->|full access| TOF
    
    HR -->|view, create, edit| OVR
    HR -->|view, create, edit| DIR
    HR -->|view, edit| DET
    HR -->|full access| ONB
    HR -->|manage| TOF
    
    USER -->|view| OVR
    USER -->|view| DIR
    USER -->|view| DET
    USER -->|own records| TOF
```

---

## User Flows

### Create Person Flow

```mermaid
sequenceDiagram
    actor HR as HR Manager
    participant UI as Directory Page
    participant API as /api/people
    participant DB as Database
    
    HR->>UI: Click "Add Person"
    UI->>UI: Open create drawer
    HR->>UI: Fill form (name, email, role, team, start date)
    HR->>UI: Click "Add Person"
    
    UI->>API: POST /api/people
    API->>API: Validate data
    API->>API: Generate slug from name
    API->>DB: Insert person record
    DB-->>API: Person created
    API-->>UI: Success response
    UI->>UI: Close drawer
    UI->>UI: Invalidate query cache
    UI-->>HR: Toast "Person added", refresh list
```

### Person Lifecycle Flow

```mermaid
sequenceDiagram
    participant SCIM as Entra SCIM
    participant API as IdaraOS API
    participant DB as Database
    participant HR as HR Manager
    
    Note over SCIM,HR: New Employee Joins
    
    alt Via SCIM Provisioning
        SCIM->>API: POST /api/scim/Users
        API->>DB: Create person (status: onboarding)
        API->>DB: Create user account
        API->>DB: Link person to user
        DB-->>API: Created
    else Manual Entry
        HR->>API: POST /api/people
        API->>DB: Create person (status: onboarding)
        DB-->>API: Created
    end
    
    Note over SCIM,HR: Onboarding Complete
    
    HR->>API: PATCH /api/people/[id]
    API->>DB: Update status to "active"
    DB-->>API: Updated
    
    Note over SCIM,HR: Employee Leaves
    
    HR->>API: PATCH /api/people/[id]
    API->>DB: Update status to "offboarding"
    DB-->>API: Updated
    
    HR->>API: PATCH /api/people/[id]
    API->>DB: Update status to "inactive", set end_date
    DB-->>API: Updated
```

### Link Person to User Account Flow

```mermaid
sequenceDiagram
    actor HR as HR Manager
    participant UI as Directory Page
    participant API as /api/users
    participant DB as Database
    
    HR->>UI: Click person row actions
    HR->>UI: Select "Link to User Account"
    UI->>UI: Open link dialog
    
    UI->>API: GET /api/users (filter: no personId)
    API->>DB: Select unlinked users
    DB-->>API: Available users
    API-->>UI: User list
    
    HR->>UI: Select user from dropdown
    HR->>UI: Click "Link Account"
    
    UI->>API: PATCH /api/users/[userId]
    API->>DB: Update user.personId = person.id
    DB-->>API: Updated
    API-->>UI: Success
    
    UI->>UI: Invalidate people & users cache
    UI-->>HR: Toast "User linked", refresh
```

### Edit Person Flow

```mermaid
sequenceDiagram
    actor HR as HR Manager
    participant UI as Directory Page
    participant API as /api/people
    participant DB as Database
    
    HR->>UI: Click person row actions
    HR->>UI: Select "Edit"
    UI->>UI: Open edit drawer with current values
    
    HR->>UI: Modify fields
    HR->>UI: Click "Save Changes"
    
    UI->>API: PATCH /api/people/[id]
    API->>API: Validate data
    API->>DB: Update person record
    DB-->>API: Person updated
    API-->>UI: Success response
    UI->>UI: Close drawer
    UI->>UI: Invalidate query cache
    UI-->>HR: Toast "Person updated", refresh list
```

### Delete Person Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Directory Page
    participant Dialog as Confirmation Dialog
    participant API as /api/people
    participant DB as Database
    
    Admin->>UI: Click person row actions
    Admin->>UI: Select "Delete"
    UI->>Dialog: Open confirmation
    
    Dialog->>Admin: "Are you sure? This cannot be undone."
    Admin->>Dialog: Click "Delete"
    
    Dialog->>API: DELETE /api/people/[id]
    API->>DB: Check for linked user
    
    alt Has linked user
        API->>DB: Unlink user (set personId = null)
    end
    
    API->>DB: Delete person record
    DB-->>API: Deleted
    API-->>UI: Success
    UI->>UI: Invalidate query cache
    UI-->>Admin: Toast "Person removed", refresh list
```

---

## API Endpoints

### People API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/people` | List all people |
| POST | `/api/people` | Create person |
| GET | `/api/people/[id]` | Get person details |
| PATCH | `/api/people/[id]` | Update person |
| DELETE | `/api/people/[id]` | Delete person |

### Request/Response Examples

**GET /api/people**

```json
[
  {
    "id": "uuid",
    "slug": "john-doe",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Software Engineer",
    "team": "Engineering",
    "status": "active",
    "startDate": "2024-01-15",
    "endDate": null,
    "phone": "+1-555-0100",
    "location": "New York",
    "hasLinkedUser": true,
    "hasEntraLink": true,
    "linkedUser": {
      "id": "uuid",
      "email": "john@example.com"
    }
  }
]
```

**POST /api/people**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "Product Manager",
  "team": "Product",
  "startDate": "2024-02-01",
  "phone": "+1-555-0101",
  "location": "San Francisco"
}
```

---

## Database Schema

### Core Tables

- `people` - Employee records

### People Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `org_id` | UUID | Organization (multi-tenant) |
| `slug` | VARCHAR | URL-friendly identifier |
| `name` | VARCHAR | Full name |
| `email` | VARCHAR | Email address (unique per org) |
| `role` | VARCHAR | Job title/role |
| `team` | VARCHAR | Team name |
| `status` | ENUM | active, onboarding, offboarding, inactive |
| `start_date` | DATE | Employment start date |
| `end_date` | DATE | Employment end date (nullable) |
| `phone` | VARCHAR | Phone number |
| `location` | VARCHAR | Office location |
| `avatar` | VARCHAR | Avatar URL |
| `bio` | TEXT | Biography |
| `entra_id` | VARCHAR | Microsoft Entra ID (nullable) |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

### Relationships

```mermaid
erDiagram
    organizations ||--o{ people : has
    people ||--o| users : "linked to"
    people {
        uuid id PK
        uuid org_id FK
        string slug
        string name
        string email
        string role
        string team
        enum status
        date start_date
        date end_date
        string entra_id
    }
    users {
        uuid id PK
        uuid org_id FK
        uuid person_id FK
        string email
        string name
    }
```

---

## Components

### Key React Components

- `PageShell` - Page layout with title and actions
- `DataTableAdvanced` - Full-featured data table
- `FormDrawer` - Schema-driven form drawer
- `Protected` - RBAC visibility wrapper
- `StatusBadge` - Employee status indicators
- `StatsCard` - Metric display cards
- `QuickLinkCard` - Navigation cards with counts

### React Query Hooks

Located in `lib/api/people.ts`:

- `usePeopleList()` - Fetch all people
- `useCreatePerson()` - Create mutation
- `useUpdatePerson()` - Update mutation
- `useDeletePerson()` - Delete mutation

### Form Configuration

Located in `lib/generated/people/person/`:

- `formConfig` - Field definitions
- `createFormSchema` - Zod schema for creation
- `editFormSchema` - Zod schema for editing
- `getFormFields(mode)` - Fields for create/edit modes

### Table Columns

Located in `lib/generated/people/person/columns.tsx`:

- Name (with avatar)
- Email
- Role
- Team
- Status (with badge)
- Start Date
- Links (User badge, Entra badge)
- Actions (Edit, Delete, Link/Unlink)

---

## Status Definitions

| Status | Description | Badge Color |
|--------|-------------|-------------|
| `active` | Currently employed | Green |
| `onboarding` | New hire in progress | Blue |
| `offboarding` | Leaving the organization | Amber |
| `inactive` | No longer employed | Gray |

---

## Integration Points

### With Settings Module

- **Users**: People can be linked to user accounts for system access
- **Entra ID**: People are auto-created via SCIM provisioning

### With Future Modules

- **Assets**: Assign assets to people
- **Documents**: Link documents to people
- **Expenses**: People submit expense reports
- **Workflows**: People as approvers/assignees
