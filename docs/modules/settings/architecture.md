# Settings Module

## Overview

The Settings module provides organizational configuration and administration capabilities. It allows administrators to manage organization details, users, roles, integrations, and audit logs.

## Module Structure

```mermaid
graph TB
    subgraph "Settings Module"
        ORG[Organization Profile]
        USERS[Users & Access]
        ROLES[Roles & Permissions]
        INT[Integrations Hub]
        AUDIT[Audit Log]
        API[API Keys]
        BRAND[Branding]
    end
    
    ORG --> |configures| USERS
    USERS --> |assigned via| ROLES
    INT --> |provisions| USERS
    INT --> |syncs| ROLES
    USERS --> |actions logged to| AUDIT
    ROLES --> |actions logged to| AUDIT
    
    subgraph "External Modules"
        PEOPLE[People & HR]
        ASSETS[Assets]
    end
    
    INT -.-> |provides connection| PEOPLE
    INT -.-> |provides connection| ASSETS
```

## Integration Architecture

The Settings module owns the **identity provider connection** (Entra ID credentials, SSO config) and **user provisioning**. It is intentionally **people-agnostic** - it doesn't know about the People module.

```mermaid
graph TB
    subgraph "Settings: Integrations (People-Agnostic)"
        CONN[Entra ID Connection<br/>Tenant, Client ID, Secret]
        SSO[SSO Configuration]
        SCIM[SCIM Endpoint]
        USER_SYNC[User Sync Config<br/>Group Prefix, Role Mapping]
    end
    
    subgraph "Users & Roles"
        USERS[(Users Table)]
        ROLES[(User Roles)]
    end
    
    CONN --> SSO
    CONN --> SCIM
    CONN --> USER_SYNC
    USER_SYNC --> USERS
    USER_SYNC --> ROLES
```

### Module Responsibilities

| This Module Handles | Other Modules Handle |
|---------------------|---------------------|
| ✅ Entra connection credentials | People sync config (People > Settings) |
| ✅ SSO/authentication | Asset sync config (Assets > Settings) |
| ✅ User provisioning | Module-specific group patterns |
| ✅ Group → Role mapping | Module-specific field mapping |
| ✅ SCIM endpoint | Module-specific sync triggers |

### Connection Sharing

Other modules can **borrow** the Entra connection for their own sync needs:

```mermaid
graph LR
    subgraph "Settings Module"
        CONN[Entra Connection]
    end
    
    subgraph "People Module"
        PEOPLE_SYNC[People Sync<br/>Uses connection if<br/>Mode B enabled]
    end
    
    subgraph "Assets Module"
        ASSET_SYNC[Asset Sync<br/>Future]
    end
    
    CONN -.->|shared credentials| PEOPLE_SYNC
    CONN -.->|shared credentials| ASSET_SYNC
```

The connection (tenant ID, client ID, secret) is shared, but each module has its own:
- Group pattern/prefix
- Field mapping
- Sync behavior settings
- Sync trigger

## Sub-Modules

### Organization Profile (`/settings`)

Manage organization-level settings and preferences.

**Features:**
- Organization name and application name
- Website and social links (LinkedIn, Twitter, YouTube)
- Regional settings (timezone, currency, date format)

### Users & Access (`/settings/users`)

Manage user accounts and their access to the system.

**Features:**
- List all users with roles and status
- Create users (manual or from Entra ID)
- Edit user details and status
- Assign/remove roles
- Link users to people in the directory
- Sync users from Microsoft Entra ID (SCIM)
- Role statistics dashboard

### Roles & Permissions (`/settings/roles`)

Define custom roles with granular permissions.

**Features:**
- List all roles with permission counts
- Create custom roles with color badges
- Edit role permissions via matrix UI
- System roles (read-only name/description)
- Permission matrix by module and action

### Integrations (`/settings/integrations`)

Connect third-party services for SSO, provisioning, and file storage.

**Features:**

#### Microsoft Entra ID (Azure AD)
- SSO configuration (tenant ID, client ID, client secret)
- SCIM provisioning for automatic user sync
- Group prefix for role mapping (e.g., `IdaraOS-*`)
- Group-to-role mapping
- Bidirectional sync support
- Integration status monitoring
- Manual sync trigger for users

#### File Storage Integrations
- **SharePoint** - Store files in SharePoint document libraries
  - Uses Microsoft Graph API
  - Requires `Sites.ReadWrite.All` Application permission with admin consent
  - Auto-discovers Site ID and Drive ID on test connection
- **Azure Blob Storage** - Store files in Azure blob containers
  - Connection string or managed identity authentication
- **Local Storage** - Development-only storage

```mermaid
graph TB
    subgraph "Settings: Integrations"
        ENTRA[Microsoft 365<br/>Identity & SSO]
        STORAGE[File Storage<br/>SharePoint / Blob]
    end
    
    subgraph "Storage Providers"
        SP[SharePoint]
        BLOB[Azure Blob]
        LOCAL[Local]
    end
    
    subgraph "Filing Module"
        CATS[File Categories]
        FILES[Files]
    end
    
    ENTRA --> |auth for| SP
    STORAGE --> SP
    STORAGE --> BLOB
    STORAGE --> LOCAL
    
    SP --> CATS
    BLOB --> CATS
    CATS --> FILES
```

**Storage Integration Flow:**

1. Admin adds storage integration (e.g., SharePoint site URL)
2. Admin clicks "Test" to verify connection
3. System uses Microsoft Graph to fetch Site ID and Drive ID
4. Admin creates file categories linked to the storage integration
5. Files uploaded to categories are stored in the configured location

**People-Agnostic Design:**

This module is intentionally decoupled from the People module. It handles:
- ✅ User account provisioning
- ✅ Role assignment via groups
- ✅ SSO authentication
- ✅ Storage integration configuration
- ❌ People/Employee sync (managed in People > Settings)
- ❌ File categories (managed in Filing > Categories)

If People sync is configured independently in People > Settings (Mode B), this module shows a notice:

```
⚠️ People sync is managed independently in People > Settings.
   User sync here only affects user accounts, not employee records.
```

See [People Module Architecture](../people/architecture.md) for People sync configuration.
See [Filing Module Architecture](../filing/architecture.md) for file management.

### Audit Log (`/settings/audit-log`)

View system activity for compliance and security. This page shows audit logs specifically for the Settings module (organization settings, users, roles, integrations).

**Features:**
- Searchable, filterable audit log table
- Filter by action type (create, update, delete, login, sync)
- Filter by date range
- Full-text search by entity name, actor email
- View detailed change history with before/after comparison
- Export to CSV/JSON for compliance reporting
- Actor identification (who made the change)
- IP address and user agent tracking

**Audit Architecture:**

```mermaid
graph TB
    subgraph "API Layer"
        PEOPLE_API[People API Routes]
        SETTINGS_API[Settings API Routes]
        AUTH_API[Auth API Routes]
    end
    
    subgraph "Audit Service"
        LOGGER[AuditLogger]
        DIFF[FieldDiffCalculator]
        SANITIZE[SensitiveDataSanitizer]
    end
    
    subgraph "Storage"
        AUDIT_DB[(audit_logs table)]
    end
    
    subgraph "UI - Filtered Views"
        PEOPLE_AUDIT[People > Audit Log<br/>modulePrefix: people.*]
        SETTINGS_AUDIT[Settings > Audit Log<br/>modulePrefix: settings.*]
    end
    
    PEOPLE_API --> LOGGER
    SETTINGS_API --> LOGGER
    AUTH_API --> LOGGER
    
    LOGGER --> DIFF
    LOGGER --> SANITIZE
    LOGGER --> AUDIT_DB
    
    AUDIT_DB --> |filtered by module| PEOPLE_AUDIT
    AUDIT_DB --> |filtered by module| SETTINGS_AUDIT
```

**Logged Actions:**

| Module | Actions Logged |
|--------|----------------|
| `settings.users` | User create, update, delete, role changes |
| `settings.roles` | Role create, update, delete, permission changes |
| `settings.organization` | Organization settings updates |
| `settings.integrations` | Connection changes (secrets masked) |
| `auth` | Login, logout events |

**Sensitive Data Handling:**

The audit logger automatically masks sensitive fields:
- Passwords and password hashes
- API keys and tokens
- Client secrets
- Encryption keys

Example masked output:
```json
{
  "changedFields": ["clientSecret"],
  "previousValues": { "clientSecret": "[REDACTED]" },
  "newValues": { "clientSecret": "[REDACTED]" }
}
```

### API Keys (`/settings/api-keys`) - Placeholder

Manage API tokens for programmatic access.

### Branding (`/settings/branding`) - Placeholder

Customize logos, colors, and themes.

---

## Authorization Architecture

IdaraOS uses a **database-driven RBAC (Role-Based Access Control)** system where all permissions are dynamically defined and queried from the database. This enables administrators to create custom roles and assign granular permissions without code changes.

### RBAC Data Model

```mermaid
erDiagram
    users ||--o{ rbac_user_roles : has
    rbac_roles ||--o{ rbac_user_roles : assigned_to
    rbac_roles ||--o{ rbac_role_permissions : has
    rbac_permissions ||--o{ rbac_role_permissions : granted_by
    rbac_modules ||--o{ rbac_permissions : defines
    rbac_actions ||--o{ rbac_permissions : defines
    
    rbac_modules {
        uuid id PK
        text slug "e.g. people.person"
        text name
        text category
        boolean is_active
    }
    
    rbac_actions {
        uuid id PK
        text slug "e.g. view, create, edit, delete"
        text name
    }
    
    rbac_permissions {
        uuid id PK
        uuid module_id FK
        uuid action_id FK
    }
    
    rbac_roles {
        uuid id PK
        uuid org_id FK
        text slug
        text name
        boolean is_system
        boolean is_default
    }
    
    rbac_role_permissions {
        uuid role_id FK
        uuid permission_id FK
    }
    
    rbac_user_roles {
        uuid user_id FK
        uuid role_id FK
        text source "manual or sync"
    }
```

### Authorization Flow

All API routes use the `requirePermission()` helper which queries the database in real-time:

```mermaid
flowchart TD
    Request[API Request] --> GetSession["getSession()"]
    GetSession --> HasSession{Session exists?}
    HasSession -->|No| Return401[401 Unauthorized]
    HasSession -->|Yes| CheckPerm["checkUserPermission(userId, module, action)"]
    
    subgraph DatabaseQuery["Database Query"]
        CheckPerm --> JoinTables["JOIN: userRoles → rolePermissions → permissions → modules + actions"]
        JoinTables --> QueryResult{Permission found?}
    end
    
    QueryResult -->|No| Return403[403 Forbidden]
    QueryResult -->|Yes| Handler[Execute Route Handler]
```

### Server-Side Permission Check

The `checkUserPermission()` function in `lib/rbac/server.ts` performs a single optimized query:

```typescript
// Checks if user has permission via their assigned roles
async function checkUserPermission(
  userId: string,
  moduleSlug: string,  // e.g., "people.person"
  actionSlug: string   // e.g., "edit"
): Promise<boolean>
```

**Query Flow:**
1. Find all roles assigned to the user (`rbac_user_roles`)
2. Find all permissions for those roles (`rbac_role_permissions`)
3. Check if any permission matches the module + action (`rbac_permissions` → `rbac_modules` + `rbac_actions`)

### API Route Authorization Pattern

All protected API routes follow this pattern:

```typescript
export async function GET(request: NextRequest) {
  try {
    // Authorization check - throws if not authorized
    const session = await requirePermission("settings.users", "view")
    const orgId = session.orgId
    
    // Route logic...
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    // Handle other errors...
  }
}
```

**Error Responses:**
- `401 Unauthorized` - No valid session (not authenticated)
- `403 Forbidden` - Session valid but lacks required permission

### Client-Side Permission Check

The frontend uses React context (`lib/rbac/context.tsx`) to cache permissions:

```typescript
// In components
const { hasPermission } = useUser()

if (hasPermission("settings.users", "create")) {
  // Show create button
}

// Or use the Protected wrapper
<Protected module="settings.users" action="delete">
  <DeleteButton />
</Protected>
```

Client permissions are fetched from `/api/rbac/user-permissions` on login and cached in React state.

### Permission Naming Convention

Permissions follow a hierarchical naming pattern:

| Module Slug | Description |
|-------------|-------------|
| `settings.organization` | Organization settings |
| `settings.users` | User management |
| `settings.integrations` | Integration configuration |
| `people.person` | People directory |
| `people.roles` | Organizational roles |
| `people.teams` | Team management |
| `assets.inventory` | Asset inventory |
| `security.risk` | Risk management |

**Actions:**
- `view` - Read access
- `create` - Create new records
- `edit` - Modify existing records
- `delete` - Remove records

### Multi-Role Permission Resolution

Users can have multiple roles. Permissions are resolved using **union** (OR logic):

```
User has roles: [HR Manager, IT Support]

HR Manager permissions: people.*, settings.users:view
IT Support permissions: assets.*, security.controls:view

User's effective permissions: people.*, settings.users:view, assets.*, security.controls:view
```

### Why Database Queries (Not Caching)?

IdaraOS uses **direct database queries** for authorization rather than caching because:

1. **Immediate Effect**: Permission changes are reflected instantly
2. **Simplicity**: No cache invalidation logic needed
3. **Accuracy**: No risk of stale permissions granting unauthorized access
4. **Performance**: With proper indexes, queries take ~1-5ms
5. **Security**: For an internal ops platform, accuracy > micro-optimization

If needed, in-memory caching with TTL can be added later without changing the API.

---

## Permissions

### Permission Matrix

| Sub-Module | Action | Owner | Admin | HR | User |
|------------|--------|-------|-------|-----|------|
| Organization | View | Yes | Yes | Yes | Yes |
| Organization | Edit | Yes | Yes | No | No |
| Users | View | Yes | Yes | Yes | No |
| Users | Create | Yes | Yes | No | No |
| Users | Edit | Yes | Yes | No | No |
| Users | Delete | Yes | Yes | No | No |
| Roles | View | Yes | Yes | No | No |
| Roles | Create | Yes | Yes | No | No |
| Roles | Edit | Yes | Yes | No | No |
| Roles | Delete | Yes | Yes | No | No |
| Integrations | View | Yes | Yes | No | No |
| Integrations | Edit | Yes | Yes | No | No |
| Audit Log | View | Yes | Yes | Yes | No |

### Permission Diagram

```mermaid
graph LR
    subgraph "Settings Permissions"
        OWNER[Owner]
        ADMIN[Admin]
        HR[HR]
        USER[User]
    end
    
    subgraph "Modules"
        ORG[Organization]
        USR[Users]
        ROL[Roles]
        INT[Integrations]
        AUD[Audit Log]
    end
    
    OWNER -->|full access| ORG
    OWNER -->|full access| USR
    OWNER -->|full access| ROL
    OWNER -->|full access| INT
    OWNER -->|full access| AUD
    
    ADMIN -->|full access| ORG
    ADMIN -->|full access| USR
    ADMIN -->|full access| ROL
    ADMIN -->|full access| INT
    ADMIN -->|full access| AUD
    
    HR -->|view| ORG
    HR -->|view| AUD
    
    USER -->|view| ORG
```

---

## User Flows

### User Creation Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Users Page
    participant API as /api/users
    participant DB as Database
    participant Entra as Entra ID
    
    Admin->>UI: Click "Add User"
    UI->>UI: Open user creation drawer
    
    alt Import from Entra ID
        Admin->>UI: Search Entra users
        UI->>API: GET /api/integrations/entra/users?q=search
        API->>Entra: Search users in tenant
        Entra-->>API: User list
        API-->>UI: User list
        Admin->>UI: Select user
        UI->>UI: Populate name/email from Entra
    end
    
    Admin->>UI: Fill form, select roles
    Admin->>UI: Click "Add User"
    UI->>API: POST /api/users
    API->>DB: Insert user
    DB-->>API: User created
    API->>DB: Insert user_roles
    DB-->>API: Roles assigned
    API-->>UI: Success
    UI-->>Admin: Toast notification, refresh list
```

### Role Management Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Roles Page
    participant API as /api/rbac/roles
    participant DB as Database
    
    Admin->>UI: Click "Create Role"
    UI->>UI: Open role drawer
    
    UI->>API: GET /api/rbac/modules
    API-->>UI: Module list
    UI->>API: GET /api/rbac/actions
    API-->>UI: Action list
    UI->>API: GET /api/rbac/permissions
    API-->>UI: All permissions
    
    UI->>UI: Render permission matrix
    Admin->>UI: Enter name, description
    Admin->>UI: Select color
    Admin->>UI: Check permissions in matrix
    Admin->>UI: Click "Create Role"
    
    UI->>API: POST /api/rbac/roles
    API->>DB: Insert role
    DB-->>API: Role created
    API->>DB: Insert role_permissions
    DB-->>API: Permissions assigned
    API-->>UI: Success
    UI-->>Admin: Toast notification, refresh list
```

### Entra ID SSO Configuration Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Integrations Page
    participant API as /api/integrations/entra
    participant DB as Database
    participant Entra as Microsoft Entra ID
    
    Admin->>UI: Navigate to Integrations
    UI->>API: GET /api/integrations/entra
    API->>DB: Fetch integration config
    DB-->>API: Config (or empty)
    API-->>UI: Integration status
    
    Admin->>UI: Enter Tenant ID, Client ID, Client Secret
    Admin->>UI: Click "Connect"
    UI->>API: POST /api/integrations/entra
    API->>Entra: Validate credentials (get token)
    
    alt Valid credentials
        Entra-->>API: Access token
        API->>DB: Save encrypted config
        DB-->>API: Saved
        API-->>UI: Connected status
        UI-->>Admin: Success toast
    else Invalid credentials
        Entra-->>API: Error
        API-->>UI: Error message
        UI-->>Admin: Error toast
    end
```

### SCIM User Provisioning Flow

```mermaid
sequenceDiagram
    participant Entra as Microsoft Entra ID
    participant API as /api/scim/*
    participant DB as Database
    participant App as IdaraOS
    
    Note over Entra,App: Entra triggers SCIM provisioning
    
    Entra->>API: POST /api/scim/Users
    API->>API: Validate SCIM token
    API->>DB: Check if user exists
    
    alt New user
        API->>DB: Create user (status: active)
        API->>DB: Create linked person record
        DB-->>API: Created
    else Existing user
        API->>DB: Update user details
        DB-->>API: Updated
    end
    
    API-->>Entra: SCIM response
    
    Note over Entra,App: Group membership sync
    
    Entra->>API: PATCH /api/scim/Groups/{id}
    API->>DB: Map Entra group to role
    API->>DB: Update user_roles
    DB-->>API: Updated
    API-->>Entra: SCIM response
```

---

## API Endpoints

### Users API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| GET | `/api/users/[id]` | Get user details |
| PATCH | `/api/users/[id]` | Update user |
| DELETE | `/api/users/[id]` | Delete user |

### RBAC API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rbac/roles` | List all roles |
| POST | `/api/rbac/roles` | Create role |
| GET | `/api/rbac/roles/[id]` | Get role with permissions |
| PATCH | `/api/rbac/roles/[id]` | Update role and permissions |
| DELETE | `/api/rbac/roles/[id]` | Delete role |
| GET | `/api/rbac/modules` | List all modules |
| GET | `/api/rbac/actions` | List all actions |
| GET | `/api/rbac/permissions` | List all permissions |
| GET | `/api/rbac/users/[id]/roles` | Get user's roles |
| PUT | `/api/rbac/users/[id]/roles` | Update user's roles |

### Organization API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/organization` | Get organization details |
| PATCH | `/api/organization` | Update organization |

### Integrations API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations/entra` | Get Entra integration status |
| POST | `/api/integrations/entra` | Connect Entra ID |
| PATCH | `/api/integrations/entra` | Update Entra settings |
| DELETE | `/api/integrations/entra` | Disconnect Entra ID |
| POST | `/api/integrations/entra/sync` | Trigger manual sync |
| POST | `/api/integrations/entra/scim-token` | Regenerate SCIM token |
| GET | `/api/integrations/entra/users` | Search Entra users |

### Storage Integrations API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings/storage-integrations` | List storage integrations |
| POST | `/api/settings/storage-integrations` | Create storage integration |
| GET | `/api/settings/storage-integrations/[id]` | Get integration details |
| PATCH | `/api/settings/storage-integrations/[id]` | Update integration |
| DELETE | `/api/settings/storage-integrations/[id]` | Delete integration |
| POST | `/api/settings/storage-integrations/[id]/test` | Test connection |

**Test Connection Response (SharePoint):**

```json
{
  "success": true,
  "details": {
    "message": "SharePoint connection verified successfully",
    "siteUrl": "https://contoso.sharepoint.com/sites/hr",
    "siteName": "HR Site",
    "siteId": "contoso.sharepoint.com,abc123,...",
    "driveName": "Documents",
    "driveId": "b!xyz..."
  }
}
```

### SCIM API (Entra Provisioning)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scim/Users` | List users (SCIM) |
| POST | `/api/scim/Users` | Create user (SCIM) |
| GET | `/api/scim/Users/[id]` | Get user (SCIM) |
| PATCH | `/api/scim/Users/[id]` | Update user (SCIM) |
| DELETE | `/api/scim/Users/[id]` | Delete user (SCIM) |
| GET | `/api/scim/Groups` | List groups (SCIM) |
| PATCH | `/api/scim/Groups/[id]` | Update group (SCIM) |

### Audit Log API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit/logs` | List audit logs with filtering |
| GET | `/api/audit/logs/[id]` | Get single audit log entry |
| GET | `/api/audit/logs/export` | Export logs as CSV/JSON |

**Query Parameters for `/api/audit/logs`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `module` | string | Exact module match (e.g., `settings.users`) |
| `modulePrefix` | string | Module prefix match (e.g., `settings.` for all settings) |
| `action` | string | Filter by action type (create, update, delete, etc.) |
| `entityType` | string | Filter by entity type (user, role, person, etc.) |
| `entityId` | uuid | Filter by specific entity ID |
| `actorId` | uuid | Filter by actor (who made the change) |
| `from` | ISO date | Start of date range |
| `to` | ISO date | End of date range |
| `search` | string | Full-text search in entity names, descriptions |
| `limit` | number | Max results (default 50, max 100) |
| `offset` | number | Pagination offset |

---

## Database Schema

### Core Tables

- `organizations` - Organization settings and preferences
- `users` - User accounts
- `rbac_roles` - Role definitions
- `rbac_modules` - Module definitions
- `rbac_actions` - Action definitions (view, create, edit, delete)
- `rbac_permissions` - Module + Action combinations
- `rbac_role_permissions` - Role to permission mappings
- `rbac_user_roles` - User to role assignments
- `integrations` - Identity provider configurations (Entra ID)
- `core_storage_integrations` - File storage configurations (SharePoint, Blob)
- `audit_logs` - System activity log

### Audit Logs Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `org_id` | UUID | Organization reference |
| `module` | TEXT | Module identifier (e.g., `people.directory`) |
| `action` | TEXT | Action type (create, update, delete, etc.) |
| `entity_type` | TEXT | Type of entity affected (person, user, role) |
| `entity_id` | UUID | ID of the affected entity |
| `entity_name` | TEXT | Human-readable name for display |
| `actor_id` | UUID | User who performed the action |
| `actor_email` | TEXT | Actor's email at time of action |
| `actor_name` | TEXT | Actor's name at time of action |
| `actor_ip` | TEXT | IP address of the request |
| `actor_user_agent` | TEXT | Browser/client user agent |
| `previous_values` | JSONB | State before the change |
| `new_values` | JSONB | State after the change |
| `changed_fields` | TEXT[] | Array of changed field names |
| `metadata` | JSONB | Additional context |
| `description` | TEXT | Human-readable description |
| `timestamp` | TIMESTAMPTZ | When the action occurred |

### Key Relationships

```mermaid
erDiagram
    organizations ||--o{ users : has
    users ||--o{ rbac_user_roles : has
    rbac_roles ||--o{ rbac_user_roles : has
    rbac_roles ||--o{ rbac_role_permissions : has
    rbac_permissions ||--o{ rbac_role_permissions : has
    rbac_modules ||--o{ rbac_permissions : has
    rbac_actions ||--o{ rbac_permissions : has
    organizations ||--o{ integrations : has
    organizations ||--o{ audit_logs : has
    users ||--o{ audit_logs : creates
    
    audit_logs {
        uuid id PK
        uuid org_id FK
        text module
        text action
        text entity_type
        uuid entity_id
        text entity_name
        uuid actor_id FK
        text actor_email
        jsonb previous_values
        jsonb new_values
        text[] changed_fields
        timestamptz timestamp
    }
```

---

## Components

### Key React Components

- `PageShell` - Consistent page layout with title, description, action
- `DataTableAdvanced` - Full-featured data table
- `FormDrawer` - Schema-driven form in a drawer
- `Protected` - RBAC-aware visibility wrapper
- `StatusBadge` - Colored status indicators
- `RolePermissionMatrix` - Permission grid UI

### React Query Hooks

- `useOrganization`, `useUpdateOrganization`
- `useUsersList`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`
- `useRoles`, `useRole`, `useCreateRole`, `useUpdateRole`, `useDeleteRole`
- `useUserRoles`, `useUpdateUserRoles`
- `useEntraIntegration`, `useSaveEntraIntegration`, `useTriggerSync`
