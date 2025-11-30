# Module Specifications

This directory contains `spec.json` files that define the structure of each module in IdaraOS. These specs are the **single source of truth** and are used to generate types, forms, tables, and routes.

## Directory Structure

```
specs/
  modules/
    people/
      person/
        spec.json
    security/
      isms/
        risk/
          spec.json
```

## Spec Schema

### Basic Structure

```json
{
  "entity": "string",         // Entity name (singular, lowercase)
  "namespace": "string",      // Module namespace (e.g., "people", "security.isms")
  "label": "string",          // Human-readable label (singular)
  "id": "string",             // Primary key field name
  "routing": {
    "list": "string",         // List page route
    "detail": "string"        // Detail page route with [id] param
  },
  "permissions": {
    "read": ["string"],       // Roles that can read
    "write": ["string"],      // Roles that can write
    "scope": "string"         // Scoping field (usually "org_id")
  },
  "fields": [...],            // Field definitions (see below)
  "table": {...},             // Table configuration (see below)
  "forms": {...},             // Form configuration (see below)
  "events": ["string"]        // Optional: event names for audit log
}
```

### Field Definition

```json
{
  "name": "string",           // Field name (snake_case)
  "type": "string",           // Field type (see types below)
  "required": boolean,        // Is field required?
  "default": "any",           // Optional: default value
  "validation": "string",     // Optional: validation rule (e.g., "email", "url")
  "ref": "string",            // Optional: reference to another entity
  "values": ["string"],       // For enum types: allowed values
  "search": {                 // Optional: search configuration
    "fts": boolean,           // Full-text search
    "vector": boolean         // Vector search
  },
  "computed": boolean,        // Is this a computed field?
  "expr": "string"            // For computed: SQL expression or function name
}
```

### Supported Field Types

- **Primitives**: `string`, `text`, `number`, `boolean`, `date`, `datetime`
- **Special**: `enum`, `uuid`, `json`
- **Relationships**: `ref` (foreign key)
- **Computed**: Any type with `"computed": true`

### Table Configuration

```json
{
  "columns": ["string"],      // Fields to show in table (in order)
  "defaultSort": ["field", "asc|desc"],  // Default sort
  "filters": ["string"]       // Fields to enable filtering on
}
```

### Form Configuration

```json
{
  "create": ["string"],       // Fields in create form (in order)
  "edit": ["string"]          // Fields in edit form (in order)
}
```

## Example: Person Spec

```json
{
  "entity": "person",
  "namespace": "people",
  "label": "Person",
  "id": "person_id",
  "routing": {
    "list": "/people/directory",
    "detail": "/people/directory/[person_id]"
  },
  "permissions": {
    "read": ["HR", "Admin", "Owner"],
    "write": ["HR", "Admin", "Owner"],
    "scope": "org_id"
  },
  "fields": [
    {
      "name": "name",
      "type": "string",
      "required": true,
      "search": { "fts": true }
    },
    {
      "name": "email",
      "type": "string",
      "required": true,
      "validation": "email",
      "search": { "fts": true }
    },
    {
      "name": "role",
      "type": "string",
      "required": true
    },
    {
      "name": "team",
      "type": "string",
      "required": false
    },
    {
      "name": "status",
      "type": "enum",
      "values": ["active", "onboarding", "offboarding", "inactive"],
      "default": "active",
      "required": true
    },
    {
      "name": "start_date",
      "type": "date",
      "required": true
    },
    {
      "name": "assigned_assets",
      "type": "number",
      "required": false,
      "computed": true,
      "expr": "COUNT(assets.id) WHERE assets.assigned_to = person_id"
    }
  ],
  "table": {
    "columns": ["name", "email", "role", "team", "status", "start_date", "assigned_assets"],
    "defaultSort": ["name", "asc"],
    "filters": ["status", "role", "team"]
  },
  "forms": {
    "create": ["name", "email", "role", "team", "start_date"],
    "edit": ["name", "email", "role", "team", "status", "start_date"]
  },
  "events": ["person.created", "person.updated", "person.deleted"]
}
```

## Example: Risk Spec

```json
{
  "entity": "risk",
  "namespace": "security.isms",
  "label": "Risk",
  "id": "risk_id",
  "routing": {
    "list": "/security/risks",
    "detail": "/security/risks/[risk_id]"
  },
  "permissions": {
    "read": ["Security", "Auditor", "Admin", "Owner"],
    "write": ["Security", "Admin", "Owner"],
    "scope": "org_id"
  },
  "fields": [
    {
      "name": "title",
      "type": "string",
      "required": true,
      "search": { "fts": true }
    },
    {
      "name": "description",
      "type": "text",
      "required": false,
      "search": { "fts": true, "vector": true }
    },
    {
      "name": "owner_id",
      "type": "uuid",
      "required": true,
      "ref": "people.person"
    },
    {
      "name": "likelihood",
      "type": "enum",
      "values": ["low", "medium", "high"],
      "default": "medium",
      "required": true
    },
    {
      "name": "impact",
      "type": "enum",
      "values": ["low", "medium", "high"],
      "default": "medium",
      "required": true
    },
    {
      "name": "level",
      "type": "enum",
      "values": ["low", "medium", "high", "critical"],
      "computed": true,
      "expr": "risk_level(likelihood, impact)"
    },
    {
      "name": "status",
      "type": "enum",
      "values": ["open", "mitigating", "accepted", "closed"],
      "default": "open",
      "required": true
    }
  ],
  "table": {
    "columns": ["title", "owner_id", "likelihood", "impact", "level", "status"],
    "defaultSort": ["level", "desc"],
    "filters": ["owner_id", "status", "likelihood", "impact", "level"]
  },
  "forms": {
    "create": ["title", "owner_id", "likelihood", "impact", "description"],
    "edit": ["title", "owner_id", "likelihood", "impact", "status", "description"]
  },
  "events": ["risk.created", "risk.updated", "risk.closed"]
}
```

## Field Mapping to UI Components

| Type | Component | Notes |
|------|-----------|-------|
| string | Input | Standard text input |
| text | Textarea | Multi-line input |
| number | Input[type=number] | Numeric input |
| boolean | Switch | Toggle switch |
| date | DatePicker | Calendar picker |
| datetime | DateTimePicker | Date + time picker |
| enum | Select | Dropdown from values |
| ref | AsyncSelect | Searchable dropdown |
| computed | Display only | Not editable |

## Validation Rules

| Rule | Description | Example |
|------|-------------|---------|
| email | Valid email format | user@example.com |
| url | Valid URL | https://example.com |
| phone | Valid phone number | +1-555-0100 |
| min:n | Minimum length/value | min:3 |
| max:n | Maximum length/value | max:255 |
| regex:pattern | Custom regex | regex:^[A-Z]{2,4}$ |

## Best Practices

1. **Keep specs focused**: One entity per spec file
2. **Use semantic names**: `start_date` not `sd`
3. **Order matters**: Fields in `forms.create` appear in that order
4. **Computed fields**: Define at database level, not in app code
5. **Enums**: Use lowercase, snake_case values
6. **References**: Always use `ref` for foreign keys
7. **Search**: Enable FTS for user-facing text fields
8. **Permissions**: Be explicit, default to most restrictive

## Generating Code

```bash
# Generate all artifacts for a spec
pnpm generate specs/modules/people/person/spec.json

# Watch mode (regenerate on spec changes)
pnpm generate:watch
```

This generates:
- `apps/web/lib/generated/<namespace>/<entity>/types.ts`
- `apps/web/lib/generated/<namespace>/<entity>/columns.tsx`
- `apps/web/lib/generated/<namespace>/<entity>/form-config.ts`

## Validation

Before generating, specs are validated against the schema. Common errors:

- ❌ Missing required fields (`entity`, `namespace`, `label`, `id`)
- ❌ Invalid types (use supported types only)
- ❌ Enum without values
- ❌ Computed field without expression
- ❌ Reference without target entity

---

**Remember**: Edit the spec, regenerate, test. Never edit generated files directly.

