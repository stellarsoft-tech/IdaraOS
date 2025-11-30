# Database Migrations

SQL migration files for IdaraOS database schema.

## Naming Convention

```
{timestamp}_description.sql
```

Example:
```
1701234567890_create_people_persons.sql
1701234568000_create_security_risks.sql
```

## Running Migrations

### Manual
```bash
psql -d idara_db -f migrations/1701234567890_create_people_persons.sql
```

### Automated (TODO)
```bash
pnpm migrate:up    # Run pending migrations
pnpm migrate:down  # Rollback last migration
```

## Generated Migrations

Migrations are auto-generated from `spec.json` files when you run:

```bash
pnpm generate specs/modules/<area>/<entity>/spec.json
```

This creates:
- `migrations/{timestamp}_create_{entity}s.sql`

## Migration Structure

Each migration includes:
1. **CREATE TABLE** with all fields
2. **Indexes** for performance
3. **Constraints** (enums, foreign keys)
4. **Functions** for computed fields
5. **RLS Policies** for security
6. **Triggers** for updated_at
7. **Comments** for documentation

## RLS Setup

Migrations include Row-Level Security policies that require these settings:

```sql
-- Set current user context
SET app.current_user_id = '{user_id}';
SET app.current_role = '{role}';
SET app.current_org_id = '{org_id}';
```

Your application must set these before querying.

## Rollback

To rollback a migration, manually write the reverse operations:
- DROP TABLE
- DROP INDEX
- DROP FUNCTION
- DROP POLICY

Store rollbacks in: `migrations/{timestamp}_rollback_{description}.sql`

## Best Practices

1. **Never edit applied migrations** - create new ones
2. **Test migrations** on dev database first
3. **Backup before running** in production
4. **Review generated SQL** before applying
5. **Commit migrations** with code changes
6. **Document manual changes** if you edit generated SQL

## Common Tasks

### Create table from spec
```bash
pnpm generate specs/modules/people/person/spec.json
# Creates: migrations/{timestamp}_create_persons.sql
```

### Add column
```sql
ALTER TABLE people_persons
ADD COLUMN phone VARCHAR(50);
```

### Create index
```sql
CREATE INDEX idx_people_persons_phone ON people_persons(phone);
```

### Add RLS policy
```sql
CREATE POLICY persons_manager_read ON people_persons
FOR SELECT
USING (
  manager_id = current_setting('app.current_user_id')::UUID
);
```

