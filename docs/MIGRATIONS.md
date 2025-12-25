# Database Migrations Guide

This guide explains how to work with database migrations in IdaraOS.

## Quick Reference

| Task | Command |
|------|---------|
| Check migration status | `pnpm docker:db:status` |
| Generate migration from schema changes | `pnpm docker:db:generate` |
| Apply pending migrations | `pnpm docker:db:migrate` |
| Force-apply migrations (fix conflicts) | `pnpm docker:db:migrate:force` |
| Fix out-of-sync state | `pnpm docker:db:migrate:fix` |
| Seed initial data | `pnpm docker:db:seed` |
| Seed RBAC permissions | `pnpm docker:db:seed-rbac` |

## Schema Change Workflow

### Step 1: Edit Schema Files

Schema files are located in `apps/web/lib/db/schema/`. Edit the relevant file:

```typescript
// apps/web/lib/db/schema/people.ts
export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  // Add your new field here:
  phone: text("phone"),  // <-- NEW
})
```

### Step 2: Generate Migration

```bash
pnpm docker:db:generate
```

This creates a new SQL file in `apps/web/drizzle/` like:
```
apps/web/drizzle/0009_add_phone_field.sql
```

### Step 3: Review the Migration

Always review the generated SQL to ensure it does what you expect:

```sql
-- apps/web/drizzle/0009_add_phone_field.sql
ALTER TABLE "people" ADD COLUMN "phone" text;
```

### Step 4: Apply the Migration

```bash
pnpm docker:db:migrate
```

### Step 5: Update RBAC (if needed)

If you added new modules or permissions:

```bash
pnpm docker:db:seed-rbac
```

## CI/CD Pipeline

All commands are non-interactive (use `-T` flag for docker exec):

```yaml
# GitHub Actions example
jobs:
  deploy:
    steps:
      - name: Run migrations
        run: pnpm docker:db:migrate
        
      - name: Seed RBAC
        run: pnpm docker:db:seed-rbac
```

## Troubleshooting

### "Relation already exists" Error

This happens when the database is out of sync with migrations (e.g., someone used `db:push`).

**Fix:**
```bash
# Option 1: Force-apply migrations
pnpm docker:db:migrate:force

# Option 2: Fix migration state
pnpm docker:db:migrate:fix
```

### "Migration table doesn't exist"

First time setup - migrations will create the table automatically.

### Checking What Migrations Are Pending

```bash
pnpm docker:db:status
```

Output:
```
📁 Local migrations: 9
✅ Applied: 7
⏳ Pending: 2

Pending migrations:
  - 0008_add_workflows
  - 0009_add_phone_field
```

### Full Database Reset (Dev Only)

If you need to start fresh:

```bash
pnpm docker:db:reset
```

This will:
1. Drop all tables
2. Run all migrations
3. Seed initial data
4. Seed RBAC permissions

## Migration Files Structure

```
apps/web/drizzle/
├── 0000_initial.sql           # First migration
├── 0001_add_people.sql        # Subsequent migrations
├── 0002_add_assets.sql
├── ...
└── meta/
    ├── _journal.json          # Migration tracking
    └── 0000_snapshot.json     # Schema snapshots
```

## Best Practices

1. **Always use migrations** - Never use `db:push` in shared environments
2. **Review generated SQL** - Before applying, ensure it's correct
3. **Keep migrations small** - One logical change per migration
4. **Never edit applied migrations** - Create a new migration instead
5. **Test migrations** - Run in dev before deploying to prod
6. **Commit migration files** - They're part of your codebase

## Dev Mode Shortcuts

For rapid iteration during development, you can use `db:push` which applies schema changes directly without creating migration files:

```bash
pnpm docker:db:push
```

⚠️ **Warning:** Only use `db:push` for local development. Always use proper migrations for shared environments.

## Common Commands Reference

### Using dev.ps1 (PowerShell)

```powershell
cd deployment/docker

.\dev.ps1 db:generate        # Generate migration
.\dev.ps1 db:migrate         # Apply migrations
.\dev.ps1 db:migrate:force   # Force-apply
.\dev.ps1 db:migrate:fix     # Fix state
.\dev.ps1 db:status          # Check status
.\dev.ps1 db:seed            # Seed data
.\dev.ps1 db:seed-rbac       # Seed RBAC
```

### Using pnpm (Cross-platform)

```bash
pnpm docker:db:generate
pnpm docker:db:migrate
pnpm docker:db:migrate:force
pnpm docker:db:migrate:fix
pnpm docker:db:status
pnpm docker:db:seed
pnpm docker:db:seed-rbac
```
