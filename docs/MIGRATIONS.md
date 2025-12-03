# Database Migrations

This document describes the database migration workflow for IdaraOS, which uses [Drizzle ORM](https://orm.drizzle.team/).

## Overview

The migration workflow is similar to Entity Framework Core:

1. **Make schema changes** in `apps/web/lib/db/schema/*.ts`
2. **Generate migration** with `pnpm db:generate`
3. **Review** the generated SQL in `apps/web/drizzle/`
4. **Commit** the migration files
5. **Deploy** - migrations run automatically

## Migration Commands

### Local Development

| Command | Description |
|---------|-------------|
| `pnpm --filter web db:generate` | Generate migration from schema changes |
| `pnpm --filter web db:status` | Show migration status (applied vs pending) |
| `pnpm --filter web db:check` | Check if migrations are up to date (CI) |
| `pnpm --filter web db:run-migrations` | Apply pending migrations |
| `pnpm --filter web db:push` | Push schema directly (dev only, no migration) |
| `pnpm --filter web db:studio` | Open Drizzle Studio to browse data |

### Docker Development

| Command | Description |
|---------|-------------|
| `pnpm docker:db:generate` | Generate migration in container |
| `pnpm docker:db:status` | Show migration status |
| `pnpm docker:db:migrate` | Apply pending migrations |
| `pnpm docker:db:push` | Push schema directly (dev only) |
| `pnpm docker:db:reset` | Reset database (drops all data!) |

## Workflow

### 1. Making Schema Changes

Edit files in `apps/web/lib/db/schema/`:

```typescript
// apps/web/lib/db/schema/people.ts
export const persons = pgTable("people_persons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Add new column
  hireDate: date("hire_date"),  // ← New column
  // ...
})
```

### 2. Generate Migration

```bash
# Using Docker (recommended)
pnpm docker:db:generate

# Or locally
pnpm --filter web db:generate
```

This creates a new SQL file in `apps/web/drizzle/`:

```
apps/web/drizzle/
├── 0000_cheerful_dust.sql
├── 0001_add_people_settings.sql
├── 0002_furry_smasher.sql
├── 0003_add_people_entra_fields.sql  ← New migration
└── meta/
    └── _journal.json
```

### 3. Review the Migration

Open the generated SQL file and review:

```sql
-- apps/web/drizzle/0003_add_people_entra_fields.sql
ALTER TABLE "people_persons" ADD COLUMN "hire_date" date;
```

### 4. Commit the Migration

```bash
git add apps/web/drizzle/
git commit -m "Add hire_date column to people_persons"
```

### 5. Deploy

When you deploy:
- The `db-init` container runs migrations automatically
- Migrations are tracked in `drizzle.__drizzle_migrations`
- Safe to run multiple times (idempotent)

## CI/CD Integration

### Pre-commit Hook

When you modify schema files, you'll see a reminder:

```
⚠️  Database schema files were modified!
   Remember to run: pnpm docker:db:generate
   Then commit the generated migration files.
```

### CI Pipeline

The CI workflow includes a `migration-check` job that:
1. Generates migrations to a temp directory
2. Fails if there are uncommitted schema changes
3. Ensures migrations are always in sync with schema

## Troubleshooting

### "Column does not exist" errors

This usually means migrations haven't been applied:

```bash
# Check migration status
pnpm docker:db:status

# Apply pending migrations
pnpm docker:db:migrate
```

### Database was created with `db:push`

If your database was created with `db:push` (no migrations), run:

```bash
# Baseline marks existing schema as migrated
pnpm --filter web db:baseline
```

### Schema drift detected in CI

If CI fails with "schema drift detected":

```bash
# Generate the missing migration
pnpm docker:db:generate

# Commit the migration file
git add apps/web/drizzle/
git commit -m "Generate migration for schema changes"
```

### Reset development database

⚠️ **Warning**: This deletes all data!

```bash
pnpm docker:db:reset
```

## Best Practices

### DO ✅

- Always generate migrations after schema changes
- Review generated SQL before committing
- Test migrations on a copy of production data
- Keep migrations small and focused
- Include both up and down migrations when possible

### DON'T ❌

- Don't use `db:push` in production
- Don't manually edit migration files (unless necessary)
- Don't skip migration commits
- Don't run destructive migrations without backup

## Architecture

### Migration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Development                               │
├─────────────────────────────────────────────────────────────┤
│  1. Schema Change    →    lib/db/schema/*.ts                │
│  2. Generate         →    pnpm db:generate                  │
│  3. Review           →    drizzle/*.sql                     │
│  4. Commit           →    git add & commit                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CI Pipeline                               │
├─────────────────────────────────────────────────────────────┤
│  migration-check job: Verify no uncommitted schema changes  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Deployment                                │
├─────────────────────────────────────────────────────────────┤
│  db-init container:                                         │
│    1. Check for existing tables                             │
│    2. Baseline if needed (db:push migration)                │
│    3. Run pending migrations                                │
│    4. Seed data                                             │
└─────────────────────────────────────────────────────────────┘
```

### Migration Tracking

Migrations are tracked in the `drizzle.__drizzle_migrations` table:

```sql
SELECT * FROM drizzle.__drizzle_migrations;
```

| id | hash | created_at |
|----|------|------------|
| 1 | 0000_cheerful_dust | 1764631349766 |
| 2 | 0001_add_people_settings | 1764633148959 |
| 3 | 0002_furry_smasher | 1764641493891 |

## Comparison with Entity Framework

| Entity Framework | Drizzle ORM |
|-----------------|-------------|
| `Add-Migration` | `pnpm db:generate` |
| `Update-Database` | `pnpm db:run-migrations` |
| `Script-Migration` | SQL files in `drizzle/` |
| `__EFMigrationsHistory` | `drizzle.__drizzle_migrations` |
| Model snapshot | `drizzle/meta/_journal.json` |

## Related Documentation

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit CLI](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
