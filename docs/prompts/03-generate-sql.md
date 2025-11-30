# Prompt: Generate SQL + RLS from Spec

## Role
You are a database architect creating PostgreSQL schemas with row-level security.

## Context
- Input: `[SPEC_PATH]` (spec.json file)
- Stack: PostgreSQL with RLS
- Reference: `/docs/DECISIONS.md` for RBAC model

## Task
Generate SQL schema, indexes, and RLS policies from the spec.json file.

## Requirements

### 1. CREATE TABLE Statement
```sql
CREATE TABLE IF NOT EXISTS [namespace]_[entity] (
  [id_field] UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  [field1] [type] [NOT NULL] [DEFAULT],
  ...
  org_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
```

### 2. Indexes
- Primary key (automatic)
- Foreign keys
- Fields marked with `search.fts` → GIN index with `to_tsvector`
- Fields marked with `search.vector` → vector index
- Frequently filtered fields

### 3. CHECK Constraints
For enum fields:
```sql
ALTER TABLE [table_name]
ADD CONSTRAINT [field]_check
CHECK ([field] IN ('value1', 'value2', ...));
```

### 4. Computed Fields
Create PostgreSQL functions:
```sql
CREATE OR REPLACE FUNCTION [function_name]([params])
RETURNS [return_type]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Implementation
  RETURN [value];
END;
$$;
```

### 5. Row-Level Security Policies

**Enable RLS:**
```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

**Read Policy (based on spec.permissions.read):**
```sql
CREATE POLICY [entity]_read_policy ON [table_name]
FOR SELECT
USING (
  org_id = current_setting('app.current_org_id')::UUID
  AND (
    current_setting('app.current_role') IN ('Owner', 'Admin', ...)
    OR [entity]_owner_id = current_setting('app.current_user_id')::UUID
  )
);
```

**Write Policy (based on spec.permissions.write):**
```sql
CREATE POLICY [entity]_write_policy ON [table_name]
FOR INSERT, UPDATE, DELETE
USING (
  org_id = current_setting('app.current_org_id')::UUID
  AND current_setting('app.current_role') IN ('Owner', 'Admin', ...)
);
```

### 6. Updated Trigger
```sql
CREATE TRIGGER update_[table_name]_updated_at
BEFORE UPDATE ON [table_name]
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Type Mapping

| Spec Type | PostgreSQL Type |
|-----------|----------------|
| string | VARCHAR(255) |
| text | TEXT |
| number | INTEGER or NUMERIC |
| boolean | BOOLEAN |
| date | DATE |
| datetime | TIMESTAMP |
| uuid | UUID |
| enum | VARCHAR with CHECK |
| json | JSONB |

## Output Format

```sql
-- ============================================
-- [Entity Name] Table
-- Generated from: [spec_path]
-- ============================================

-- Table
CREATE TABLE IF NOT EXISTS [table_name] (
  ...
);

-- Indexes
CREATE INDEX idx_[table]_[field] ON [table]([field]);
CREATE INDEX idx_[table]_fts ON [table] USING GIN(to_tsvector('english', [field]));

-- Constraints
ALTER TABLE [table_name] ADD CONSTRAINT ...;

-- Functions (for computed fields)
CREATE OR REPLACE FUNCTION ...;

-- Row-Level Security
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;

-- Triggers
CREATE TRIGGER ...;

-- Comments
COMMENT ON TABLE [table_name] IS '[Entity description]';
COMMENT ON COLUMN [table_name].[field] IS '[Field description]';
```

## Example Usage

```
Use prompt: docs/prompts/03-generate-sql.md
Spec: specs/modules/security/isms/risk/spec.json
Output: migrations/001_create_risks_table.sql
```

## Verification Checklist

After generation:
- [ ] All fields from spec are present
- [ ] Enums have CHECK constraints
- [ ] Indexes on searchable/filterable fields
- [ ] RLS policies match spec.permissions
- [ ] Computed fields have functions
- [ ] Foreign keys have ON DELETE behavior
- [ ] Triggers for updated_at

## Do NOT
- Skip RLS policies
- Use generic policies (be specific to roles)
- Forget indexes on foreign keys
- Use TEXT for everything (choose appropriate types)

## Next Steps
1. Review generated SQL
2. Test with sample data
3. Verify RLS policies work correctly

