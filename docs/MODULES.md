# IdaraOS Modules

## Complete Module List

### Core (Foundation)
- **People & HR** - Employee directory, org chart, roles, teams
- **Authentication** - Users, sessions, SSO, MFA
- **Organization** - Company settings, departments, locations

### Operations
- **Assets** - Hardware, software licenses, equipment tracking
- **Documents** - File storage, version control, policies
- **Vendors** - Supplier management, contracts, evaluations
- **Workflows** - Approval flows, automation, task routing

### Finance
- **Expenses** - Expense reports, reimbursements, approvals
- **Budgets** - Department budgets, tracking, forecasting
- **Contracts** - Legal agreements, renewals, obligations
- **Billing** - Subscription management (SaaS context)

### Security & Compliance
- **ISMS** - Risk register, controls, audits, incidents
- **Policies** - Company policies, attestations, acknowledgments
- **Access Reviews** - Periodic access certifications
- **Training** - Compliance training, certifications

### Employee Experience
- **Onboarding** - New hire checklists, tasks, provisioning
- **Offboarding** - Exit checklists, deprovisioning
- **Time Off** - Leave requests, calendars, balances
- **Directory** - People search, org browser

### Communication
- **Announcements** - Company-wide communications
- **Knowledge Base** - Internal wiki, FAQs
- **Feedback** - Surveys, suggestions, pulse checks

---

## Phase 1: People & HR Module

### Overview
The People & HR module is foundational - most other modules reference people (owners, assignees, approvers). Build this first.

### Pages to Build (First 2-3)

1. **People Directory** (`/people/directory`) - List all employees
2. **Person Detail** (`/people/directory/[id]`) - View/edit employee
3. **Teams** (`/people/teams`) - Team management

---

## Detailed Build Plan: People Directory + Person Detail

### Step 1: Define Spec

Create `specs/modules/people/person/spec.json`:

```json
{
  "entity": "person",
  "namespace": "people",
  "label": { "singular": "Person", "plural": "People" },
  "id": "person_id",
  "slug": { "field": "name", "unique": true },
  "routing": {
    "list": "/people/directory",
    "detail": "/people/directory/[slug]"
  },
  "permissions": {
    "read": ["User", "HR", "Admin", "Owner"],
    "write": ["HR", "Admin", "Owner"],
    "delete": ["Admin", "Owner"],
    "scope": "org_id"
  },
  "fields": [
    { "name": "name", "type": "string", "required": true, "search": { "fts": true } },
    { "name": "email", "type": "string", "required": true, "unique": true, "validation": "email" },
    { "name": "role", "type": "string", "required": true },
    { "name": "department", "type": "ref", "ref": "departments.department", "required": true },
    { "name": "team", "type": "ref", "ref": "people.team" },
    { "name": "manager", "type": "ref", "ref": "people.person" },
    { "name": "status", "type": "enum", "values": ["active", "onboarding", "offboarding", "inactive"], "default": "active" },
    { "name": "start_date", "type": "date", "required": true },
    { "name": "end_date", "type": "date" },
    { "name": "phone", "type": "string" },
    { "name": "location", "type": "ref", "ref": "org.location" },
    { "name": "avatar_url", "type": "string" },
    { "name": "bio", "type": "text" }
  ],
  "table": {
    "columns": ["name", "email", "role", "department", "team", "status", "start_date"],
    "defaultSort": ["name", "asc"],
    "filters": ["status", "department", "team", "location"]
  },
  "forms": {
    "create": ["name", "email", "role", "department", "team", "manager", "start_date", "phone", "location"],
    "edit": ["name", "email", "role", "department", "team", "manager", "status", "start_date", "end_date", "phone", "location", "avatar_url", "bio"]
  }
}
```

### Step 2: Generate Code

```bash
pnpm generate specs/modules/people/person/spec.json
```

**Outputs:**
- `apps/web/lib/generated/people/person/types.ts`
- `apps/web/lib/generated/people/person/columns.tsx`
- `apps/web/lib/generated/people/person/form-config.ts`
- `migrations/{timestamp}_create_people_person.sql`

### Step 3: Database Setup

Create migration file with:
- `people_persons` table
- Indexes on `org_id`, `email`, `status`, `department_id`, `team_id`
- Full-text search index on `name`
- RLS policies for org scoping
- Foreign keys to departments, teams, locations

### Step 4: API Layer

Create `apps/web/lib/api/people/person.ts`:

```typescript
// Typed API client for people
export const personApi = createCrudClient<Person, CreatePerson, UpdatePerson>({
  baseUrl: "/api/people/person",
})

// React Query hooks
export function usePersonList(filters?: PersonFilters) {
  return useListQuery("people", () => personApi.list(filters))
}

export function usePersonDetail(id: string) {
  return useDetailQuery(["people", id], () => personApi.get(id))
}

export function useCreatePerson() {
  return useCreateMutation("people", personApi.create)
}

export function useUpdatePerson(id: string) {
  return useUpdateMutation(["people", id], (data) => personApi.update(id, data))
}
```

### Step 5: RBAC Configuration

Update `apps/web/lib/rbac/permissions.ts`:

```typescript
export const permissions = {
  "people.person": {
    read: [Role.User, Role.HR, Role.Admin, Role.Owner],
    write: [Role.HR, Role.Admin, Role.Owner],
    delete: [Role.Admin, Role.Owner],
  },
}
```

### Step 6: List Page (`/people/directory`)

File: `apps/web/app/(dashboard)/people/directory/page.tsx`

**Features:**
- DataTable with generated columns
- Faceted filters: status, department, team, location
- Global search on name
- Column visibility toggle
- CSV export
- "Add Person" button (Protected for HR+)
- FormDrawer for create
- Row click → navigate to detail
- Pagination (10/25/50/100)
- Loading skeleton
- Empty state

**Implementation Tasks:**
1. Import generated columns, form-config, types
2. Use `usePersonList()` hook for data
3. Wire up DataTable with all features
4. Add FormDrawer with `createFormSchema`
5. Handle create mutation with toast feedback
6. Add to navigation routes

### Step 7: Detail Page (`/people/directory/[slug]`)

File: `apps/web/app/(dashboard)/people/directory/[slug]/page.tsx`

**Features:**
- PageShell with person name as title
- Back button to directory
- ResourceLayout with tabs:
  - **Overview** - Profile card, key info, manager, team
  - **Assets** - Assigned assets (readonly for now)
  - **Activity** - Audit log of changes
- Edit button (Protected for HR+)
- FormDrawer for edit
- Delete confirmation dialog (Protected for Admin+)

**Implementation Tasks:**
1. Use `usePersonDetail(slug)` hook
2. Build Overview tab with profile card
3. Build placeholder tabs (Assets, Activity)
4. Wire up edit FormDrawer with `editFormSchema`
5. Handle update mutation
6. Add delete with confirmation dialog
7. Breadcrumbs: Home > People > Directory > [Name]

### Step 8: Navigation Updates

Update `apps/web/lib/navigation/routes.ts`:
- Ensure "/people/directory" is configured
- Add keywords for search: "people", "employees", "directory", "staff"

Update `apps/web/components/app-sidebar.tsx`:
- Verify People section exists with Directory link

### Step 9: Testing

**E2E Tests** (`tests/e2e/people/directory.spec.ts`):
1. Load directory page - verify table renders
2. Search for person - verify filter works
3. Click row - verify navigation to detail
4. Create person - verify form, submit, toast, table refresh
5. Edit person - verify form loads with data, submit works
6. Delete person - verify confirmation, removal from list
7. RBAC - verify HR can edit, User cannot see edit button

**Unit Tests**:
1. Generated types validate correctly
2. Form schemas reject invalid data
3. Column definitions render properly

### Step 10: Polish

- Loading states for all async operations
- Error boundaries for failures
- Toast messages for success/error
- Responsive layout (mobile table → cards)
- Avatar fallback to initials
- Status badge colors (active=green, onboarding=blue, etc.)

---

## Checklist

- [ ] Create/update `specs/modules/people/person/spec.json`
- [ ] Run `pnpm generate` for types, columns, forms
- [ ] Create/run database migration
- [ ] Implement API client and hooks
- [ ] Configure RBAC permissions
- [ ] Build list page with DataTable
- [ ] Build detail page with ResourceLayout
- [ ] Wire up create/edit FormDrawers
- [ ] Add delete confirmation
- [ ] Update navigation
- [ ] Write E2E tests
- [ ] Write unit tests
- [ ] Test RBAC enforcement
- [ ] Mobile responsiveness check
- [ ] Accessibility audit

---

## Dependencies

**Before this module:**
- None (this is first)

**Needed for full functionality (can stub initially):**
- Departments table (for department dropdown)
- Teams table (for team dropdown)  
- Locations table (for location dropdown)

**Stub approach:** Create simple seed data for departments/teams/locations, implement full modules later.

---

## Time Estimate

- Spec + Generate: 30 min
- Database + API: 1 hour
- List page: 1 hour
- Detail page: 1.5 hours
- Testing: 1 hour
- Polish: 30 min

**Total: ~5-6 hours**

