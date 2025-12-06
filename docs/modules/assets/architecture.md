# Assets Module

## Overview

The Assets module manages organizational hardware, software licenses, and equipment. It supports both manual asset management and automated device sync from Microsoft Intune. The module follows the same architectural patterns as the Settings and People modules.

## Module Structure

```mermaid
graph TB
    subgraph "Assets Module"
        OVERVIEW[Overview Dashboard]
        INV[Inventory]
        CAT[Categories]
        ASSIGN[Assignments]
        MAINT[Maintenance]
        LIFE[Lifecycle]
        SETTINGS[Settings]
        AUDIT[Audit Log]
    end
    
    OVERVIEW --> INV
    INV --> ASSIGN
    INV --> MAINT
    INV --> LIFE
    CAT --> INV
    SETTINGS --> |configures| INV
    INV --> |actions logged to| AUDIT
    
    subgraph "People Module"
        PEOPLE[People Directory]
    end
    
    subgraph "Settings Module"
        INT[Integrations Hub]
    end
    
    subgraph "External"
        INTUNE[Microsoft Intune]
    end
    
    ASSIGN --> |assigned to| PEOPLE
    INT --> |connection| INTUNE
    INT -.-> |shared connection| SETTINGS
    INTUNE --> |Device data| INV
```

## Integration Architecture

### Microsoft Intune Sync

The Assets module leverages the existing Entra ID connection from Settings > Integrations to sync devices from Microsoft Intune. This follows the "centralized connection, distributed configuration" pattern.

```mermaid
graph TB
    subgraph "Settings > Integrations"
        ENTRA[Entra Connection]
        DEVICE_SYNC[Device Sync Toggle]
    end
    
    subgraph "Assets > Settings"
        SYNC_CONFIG[Sync Configuration]
        FILTER[Device Filters]
        MAPPING[Category Mapping]
    end
    
    subgraph "Microsoft Graph API"
        INTUNE[/managedDevices/]
    end
    
    subgraph "Assets Module"
        ASSETS[(Assets Table)]
    end
    
    ENTRA --> DEVICE_SYNC
    ENTRA --> INTUNE
    DEVICE_SYNC --> SYNC_CONFIG
    SYNC_CONFIG --> FILTER
    SYNC_CONFIG --> MAPPING
    INTUNE --> |Device data| ASSETS
    MAPPING --> |Category assignment| ASSETS
```

### Sync Flow

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant UI as Assets > Settings
    participant API as Assets API
    participant Graph as Microsoft Graph
    participant DB as Database
    
    Note over Admin,DB: Initial Setup
    Admin->>UI: Enable device sync
    UI->>API: Save sync configuration
    API->>DB: Store sync settings
    
    Note over Admin,DB: Sync Execution
    Admin->>UI: Click "Sync Now"
    UI->>API: POST /api/assets/sync
    API->>Graph: GET /deviceManagement/managedDevices
    Graph-->>API: Device list
    
    loop For each device
        API->>DB: Check if device exists (by intune_device_id)
        alt Device exists
            API->>DB: Update asset record
        else New device
            API->>API: Map device type to category
            API->>DB: Create asset record
            API->>DB: Create lifecycle event
        end
    end
    
    API-->>UI: Sync results
    UI-->>Admin: "Synced X devices"
```

## Sub-Modules

### Overview Dashboard (`/assets`)

High-level view of asset metrics and quick access to sub-modules.

**Features:**
- Total assets count
- Assets by status (available, assigned, maintenance, retired)
- Assets by category breakdown
- Recent activity timeline
- Quick links to sub-modules

### Inventory (`/assets/inventory`)

Central asset registry with full CRUD capabilities.

**Features:**
- Searchable, filterable data table
- Faceted filters (status, category, location, assignee)
- Create asset via drawer form
- Edit asset via drawer form
- Delete asset with confirmation
- Assign/unassign to person
- Column visibility toggle
- CSV export
- Click row to view details
- Stats cards (total, available, assigned, maintenance)
- Intune sync indicator badge

### Asset Detail (`/assets/inventory/[id]`)

Individual asset profile view with comprehensive information.

**Features:**
- Asset card with icon, tag, model, status badge
- Specification details (serial, manufacturer, purchase info)
- Current assignee display with link to person
- Edit/Delete capabilities with RBAC

**Tabs:**
- **Overview**: Specifications, purchase details, warranty info
- **Assignments**: Assignment history with dates and assignees
- **Maintenance**: Maintenance records and repair history
- **Activity**: Lifecycle events timeline

**Intune Integration Section (for synced assets):**
- Sync status indicator
- Compliance state badge
- Last sync timestamp
- Enrollment type
- Warning about manual changes being overwritten

### Categories (`/assets/categories`)

Hierarchical asset type management.

**Features:**
- Tree view of categories
- Create category with icon and color
- Edit category
- Delete category (with asset reassignment)
- Set default depreciation period
- Subcategory support

**Default Categories:**
- Hardware
  - Laptops
  - Desktops
  - Monitors
  - Phones
  - Tablets
  - Peripherals
- Software
  - Licenses
- Furniture
- Vehicles

### Assignments (`/assets/assignments`)

Track asset allocations to people.

**Features:**
- View all current assignments
- Filter by person, department, asset type
- Assign asset to person
- Return asset (end assignment)
- Assignment history per asset
- Bulk assign/unassign

### Maintenance (`/assets/maintenance`)

Repair tickets and maintenance schedules.

**Features:**
- List of maintenance records
- Filter by status, type, date range
- Create maintenance ticket
- Update ticket status
- Track costs and vendors
- Schedule preventive maintenance
- Link to asset detail

### Lifecycle (`/assets/lifecycle`)

Asset lifecycle tracking and disposal management.

**Features:**
- View lifecycle events for all assets
- Filter by event type, date range
- Depreciation overview (optional)
- Disposal records
- Audit trail of all changes

### Settings (`/assets/settings`)

Module-level settings for Assets, including Intune sync configuration.

**Sections:**

#### General Settings
- Default status for new assets
- Required fields configuration
- Auto-generate asset tags toggle

#### Intune Sync Settings (shown only if Entra is connected)

**Device Sync Toggle**: Enable/disable sync

**Device Filters:**
- OS platform filter (Windows, macOS, iOS, Android)
- Compliance state filter
- Management state filter

**Category Mapping:**
| Intune Device Type | Maps To Category |
|--------------------|------------------|
| Windows | Hardware > Laptops/Desktops |
| macOS | Hardware > Laptops/Desktops |
| iOS | Hardware > Phones/Tablets |
| Android | Hardware > Phones/Tablets |

**Sync Behavior:**
- Auto-delete assets when removed from Intune
- Auto-create people for unknown assignees
- Sync frequency (manual only for now)

---

## Permissions

### Permission Matrix

| Sub-Module | Action | Owner | Admin | Asset Manager | IT | User |
|------------|--------|-------|-------|---------------|-----|------|
| Overview | View | Yes | Yes | Yes | Yes | Yes |
| Inventory | View | Yes | Yes | Yes | Yes | Own |
| Inventory | Create | Yes | Yes | Yes | Yes | No |
| Inventory | Edit | Yes | Yes | Yes | Yes | No |
| Inventory | Delete | Yes | Yes | Yes | No | No |
| Categories | View | Yes | Yes | Yes | Yes | Yes |
| Categories | Manage | Yes | Yes | Yes | No | No |
| Assignments | View | Yes | Yes | Yes | Yes | Own |
| Assignments | Manage | Yes | Yes | Yes | Yes | No |
| Maintenance | View | Yes | Yes | Yes | Yes | No |
| Maintenance | Manage | Yes | Yes | Yes | Yes | No |
| Lifecycle | View | Yes | Yes | Yes | Yes | No |
| Settings | View | Yes | Yes | Yes | No | No |
| Settings | Configure | Yes | Yes | No | No | No |

### Permission Diagram

```mermaid
graph LR
    subgraph "Assets Permissions"
        OWNER[Owner]
        ADMIN[Admin]
        ASSET_MGR[Asset Manager]
        IT[IT]
        USER[User]
    end
    
    subgraph "Modules"
        OVR[Overview]
        INV[Inventory]
        CAT[Categories]
        ASN[Assignments]
        MNT[Maintenance]
        LIF[Lifecycle]
        SET[Settings]
    end
    
    OWNER -->|full access| OVR
    OWNER -->|full access| INV
    OWNER -->|full access| CAT
    OWNER -->|full access| ASN
    OWNER -->|full access| MNT
    OWNER -->|full access| LIF
    OWNER -->|full access| SET
    
    ADMIN -->|full access| OVR
    ADMIN -->|full access| INV
    ADMIN -->|full access| CAT
    ADMIN -->|full access| ASN
    ADMIN -->|full access| MNT
    ADMIN -->|full access| LIF
    ADMIN -->|full access| SET
    
    ASSET_MGR -->|view, create, edit| INV
    ASSET_MGR -->|manage| CAT
    ASSET_MGR -->|manage| ASN
    ASSET_MGR -->|manage| MNT
    ASSET_MGR -->|view| LIF
    ASSET_MGR -->|view| SET
    
    IT -->|view, create, edit| INV
    IT -->|view| CAT
    IT -->|manage| ASN
    IT -->|manage| MNT
    IT -->|view| LIF
    
    USER -->|view own| INV
    USER -->|view own| ASN
```

---

## User Flows

### Create Asset Flow

```mermaid
sequenceDiagram
    actor Admin as Admin/IT
    participant UI as Inventory Page
    participant API as /api/assets
    participant DB as Database
    
    Admin->>UI: Click "Add Asset"
    UI->>UI: Open create drawer
    Admin->>UI: Fill form (tag, name, category, model, serial)
    Admin->>UI: Click "Add Asset"
    
    UI->>API: POST /api/assets
    API->>API: Validate data
    API->>API: Generate asset tag if auto-generate enabled
    API->>DB: Insert asset record
    API->>DB: Insert lifecycle event (acquired)
    DB-->>API: Asset created
    API-->>UI: Success response
    UI->>UI: Close drawer
    UI->>UI: Invalidate query cache
    UI-->>Admin: Toast "Asset added", refresh list
```

### Assign Asset Flow

```mermaid
sequenceDiagram
    actor Admin as Admin/IT
    participant UI as Inventory Page
    participant API as /api/assets
    participant DB as Database
    
    Admin->>UI: Click asset row actions
    Admin->>UI: Select "Assign to Person"
    UI->>UI: Open assignment dialog
    
    UI->>API: GET /api/people
    API->>DB: Select available people
    DB-->>API: People list
    API-->>UI: People list
    
    Admin->>UI: Select person from dropdown
    Admin->>UI: Add assignment notes (optional)
    Admin->>UI: Click "Assign"
    
    UI->>API: POST /api/assets/[id]/assign
    API->>DB: Update asset.assigned_to_id
    API->>DB: Update asset.assigned_at
    API->>DB: Update asset.status = 'assigned'
    API->>DB: Insert assignment record
    API->>DB: Insert lifecycle event (assigned)
    DB-->>API: Updated
    API-->>UI: Success
    
    UI->>UI: Invalidate assets & people cache
    UI-->>Admin: Toast "Asset assigned", refresh list
```

### Return Asset Flow

```mermaid
sequenceDiagram
    actor Admin as Admin/IT
    participant UI as Assignments Page
    participant API as /api/assets
    participant DB as Database
    
    Admin->>UI: Click assignment row actions
    Admin->>UI: Select "Return Asset"
    UI->>UI: Open confirmation dialog
    
    Admin->>UI: Add return notes (optional)
    Admin->>UI: Click "Confirm Return"
    
    UI->>API: POST /api/assets/[id]/return
    API->>DB: Update asset.assigned_to_id = null
    API->>DB: Update asset.status = 'available'
    API->>DB: Update assignment.returned_at = now()
    API->>DB: Insert lifecycle event (returned)
    DB-->>API: Updated
    API-->>UI: Success
    
    UI->>UI: Invalidate cache
    UI-->>Admin: Toast "Asset returned", refresh list
```

### Intune Sync Flow

```mermaid
sequenceDiagram
    actor Admin as Admin
    participant Settings as Settings > Integrations
    participant AssetSettings as Assets > Settings
    participant API as /api/assets/sync
    participant Graph as Microsoft Graph API
    participant DB as Database
    
    Note over Admin,DB: Enable Device Sync
    Admin->>Settings: Navigate to Entra integration
    Admin->>Settings: Enable "Device Sync" toggle
    Settings->>DB: Save sync_devices_enabled = true
    
    Note over Admin,DB: Configure Sync
    Admin->>AssetSettings: Configure device filters
    Admin->>AssetSettings: Set category mappings
    AssetSettings->>DB: Save asset sync configuration
    
    Note over Admin,DB: Execute Sync
    Admin->>AssetSettings: Click "Sync Devices"
    AssetSettings->>API: POST /api/assets/sync
    
    API->>Graph: GET /deviceManagement/managedDevices
    Note right of Graph: With filters: $filter=operatingSystem eq 'Windows'
    Graph-->>API: Managed devices list
    
    loop For each device
        API->>DB: Find asset by intune_device_id
        alt Asset exists
            API->>DB: Update asset fields
            API->>DB: Update intune_last_sync_at
        else New device
            API->>API: Map OS to category
            API->>API: Find person by userPrincipalName
            API->>DB: Create asset record
            API->>DB: Create assignment if person found
            API->>DB: Create lifecycle event
        end
    end
    
    API-->>AssetSettings: Sync summary
    AssetSettings-->>Admin: "Synced 25 devices (5 new, 20 updated)"
```

---

## API Endpoints

### Assets API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assets` | List all assets |
| POST | `/api/assets` | Create asset |
| GET | `/api/assets/[id]` | Get asset details |
| PATCH | `/api/assets/[id]` | Update asset |
| DELETE | `/api/assets/[id]` | Delete asset |
| POST | `/api/assets/[id]/assign` | Assign asset to person |
| POST | `/api/assets/[id]/return` | Return asset |
| POST | `/api/assets/sync` | Trigger Intune sync |

### Categories API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assets/categories` | List all categories |
| POST | `/api/assets/categories` | Create category |
| PATCH | `/api/assets/categories/[id]` | Update category |
| DELETE | `/api/assets/categories/[id]` | Delete category |

### Assignments API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assets/assignments` | List all assignments |
| GET | `/api/assets/[id]/assignments` | Get assignment history for asset |

### Maintenance API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assets/maintenance` | List all maintenance records |
| POST | `/api/assets/maintenance` | Create maintenance record |
| GET | `/api/assets/[id]/maintenance` | Get maintenance for asset |
| PATCH | `/api/assets/maintenance/[id]` | Update maintenance record |

---

## Database Schema

### Entity Relationships

```mermaid
erDiagram
    organizations ||--o{ assets_assets : has
    organizations ||--o{ assets_categories : has
    organizations ||--o{ assets_tags : has
    assets_categories ||--o{ assets_assets : categorizes
    assets_categories ||--o| assets_categories : parent
    assets_assets ||--o{ assets_asset_tags : has
    assets_tags ||--o{ assets_asset_tags : tagged
    assets_assets ||--o| people_persons : assigned_to
    assets_assets ||--o{ assets_assignments : has
    people_persons ||--o{ assets_assignments : receives
    assets_assets ||--o{ assets_maintenance_records : has
    assets_assets ||--o{ assets_lifecycle_events : has
    
    assets_assets {
        uuid id PK
        uuid org_id FK
        string asset_tag UK
        string name
        uuid category_id FK
        enum status
        string serial_number
        string manufacturer
        string model
        date purchase_date
        decimal purchase_cost
        date warranty_end
        string location
        uuid assigned_to_id FK
        timestamp assigned_at
        enum source
        string intune_device_id
        string intune_compliance_state
        timestamp intune_last_sync_at
        boolean sync_enabled
        jsonb custom_fields
    }
    
    assets_categories {
        uuid id PK
        uuid org_id FK
        string name
        string slug
        uuid parent_id FK
        string icon
        string color
        int depreciation_years
    }
    
    assets_assignments {
        uuid id PK
        uuid asset_id FK
        uuid person_id FK
        timestamp assigned_at
        timestamp returned_at
        uuid assigned_by_id FK
        text notes
    }
    
    assets_maintenance_records {
        uuid id PK
        uuid asset_id FK
        enum type
        enum status
        text description
        date scheduled_date
        date completed_date
        decimal cost
        string vendor
    }
    
    assets_lifecycle_events {
        uuid id PK
        uuid asset_id FK
        enum event_type
        timestamp event_date
        jsonb details
        uuid performed_by_id FK
    }
```

---

## Status Definitions

| Status | Description | Badge Color |
|--------|-------------|-------------|
| `available` | Ready for assignment | Green |
| `assigned` | Currently assigned to a person | Blue |
| `maintenance` | Under repair or maintenance | Amber |
| `retired` | No longer in active use | Gray |
| `disposed` | Permanently removed | Red |

---

## Components

### Key React Components

- `PageShell` - Page layout with title and actions
- `DataTableAdvanced` - Full-featured data table
- `FormDrawer` - Schema-driven form drawer
- `Protected` - RBAC visibility wrapper
- `StatusBadge` - Asset status indicators
- `StatsCard` - Metric display cards
- `CategoryTree` - Hierarchical category view

### React Query Hooks

Located in `lib/api/assets.ts`:

- `useAssetsList()` - Fetch all assets
- `useAsset(id)` - Fetch single asset
- `useCreateAsset()` - Create mutation
- `useUpdateAsset()` - Update mutation
- `useDeleteAsset()` - Delete mutation
- `useAssignAsset()` - Assign mutation
- `useReturnAsset()` - Return mutation
- `useCategoriesList()` - Fetch categories
- `useSyncDevices()` - Trigger Intune sync

---

## Integration Points

### With People Module

- Assets can be assigned to people in the directory
- Person detail page shows assigned assets
- When person is deleted, assets are unassigned

### With Settings Module

- Borrows Entra ID connection for Intune sync
- Device Sync toggle in Settings > Integrations
- Asset sync configuration in Assets > Settings

### Intune Sync Details

**Required API Permissions:**
```
DeviceManagementManagedDevices.Read.All
DeviceManagementServiceConfig.Read.All
```

**Data Mapping:**

| Intune Property | Asset Field |
|-----------------|-------------|
| `id` | `intune_device_id` |
| `deviceName` | `name` |
| `serialNumber` | `serial_number` |
| `manufacturer` | `manufacturer` |
| `model` | `model` |
| `complianceState` | `intune_compliance_state` |
| `enrolledDateTime` | `purchase_date` (if not set) |
| `lastSyncDateTime` | `intune_last_sync_at` |
| `operatingSystem` | Mapped to category |
| `userPrincipalName` | Used to find/create person |

