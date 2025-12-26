# Database Migrations Guide

This document describes the **correct** workflow for managing database schema changes in IdaraOS using Drizzle ORM.

## Quick Reference

```bash
# Generate a new migration from schema changes
pnpm --filter web db:generate

# Check migration status
pnpm --filter web db:migrate:status

# Apply pending migrations
pnpm --filter web db:migrate:run

# View database in browser (dev only)
pnpm --filter web db:studio
```

## The Golden Rule

> **NEVER write SQL migration files by hand. ALWAYS use `drizzle-kit generate`.**

Drizzle ORM maintains snapshots of your schema state. When you write SQL manually, the snapshots become out of sync, causing future migrations to be incorrect.

---

## Workflow: Making Schema Changes

### Step 1: Edit the TypeScript Schema

Make your changes in `apps/web/lib/db/schema/*.ts`:

```typescript
// Example: Change FK from RESTRICT to SET NULL
// Before
templateStepId: uuid("template_step_id")
  .notNull()
  .references(() => workflowTemplateSteps.id, { onDelete: "restrict" }),

// After  
templateStepId: uuid("template_step_id")
  .references(() => workflowTemplateSteps.id, { onDelete: "set null" }),
```

### Step 2: Generate the Migration

```bash
cd apps/web
pnpm db:generate
```

This creates:
- `drizzle/XXXX_migration_name.sql` - The SQL migration
- `drizzle/meta/XXXX_snapshot.json` - Schema snapshot after this migration
- Updates `drizzle/meta/_journal.json` - Migration registry

### Step 3: Review the Generated SQL

Always review what Drizzle generated:

```bash
cat drizzle/XXXX_*.sql
```

If the generated SQL isn't what you want:
1. Adjust your TypeScript schema
2. Delete the generated files
3. Run `db:generate` again

### Step 4: Test Locally

```bash
pnpm db:migrate:run
```

### Step 5: Commit ALL Migration Files

```bash
git add apps/web/drizzle/
git commit -m "feat: add migration for XYZ"
```

**Important:** Commit ALL of these:
- `*.sql` files
- `meta/_journal.json`
- `meta/*_snapshot.json`

---

## Environment-Specific Behavior

### Local Development (Rapid Iteration)

When rapidly prototyping, you CAN use `db:push`:

```bash
pnpm db:push  # Syncs schema directly, no migrations
```

**Warning:** `db:push` can:
- Drop columns/tables
- Lose data
- Desync from migration state

Use it only when you're iterating fast and don't care about data loss.

### CI/CD / Staging / Production

**NEVER use `db:push`**. Only use migrations:

```bash
pnpm db:migrate:run
```

The Docker init container runs this automatically on deployment.

---

## Troubleshooting

### "Column already exists" Error

This happens when:
1. `db:push` was used instead of migrations
2. Someone manually ran SQL
3. Migration files were modified after being applied

**Fix:**
```bash
# Check what's applied vs pending
pnpm db:migrate:status

# If database was created with db:push, baseline it first
pnpm db:baseline
```

### Migration Conflicts

If you have schema changes that conflict with migrations:

```bash
# Option 1: Regenerate migrations (loses all migration history)
rm -rf drizzle/
pnpm db:generate

# Option 2: Pull current state and generate diff
pnpm db:pull  # Creates schema from existing DB
# Then manually reconcile
```

### Foreign Key Constraint Violations

When you see:
```
ERROR: update or delete on table "X" violates foreign key constraint
```

**Solution:** Change the FK action in schema:
```typescript
// From
.references(() => table.id, { onDelete: "restrict" })

// To (allows deletion by nulling the reference)
.references(() => table.id, { onDelete: "set null" })

// Or (auto-deletes child records)
.references(() => table.id, { onDelete: "cascade" })
```

Then generate a migration: `pnpm db:generate`

---

## Commands Reference

| Command | Description | When to Use |
|---------|-------------|-------------|
| `db:generate` | Generate migration from schema diff | After editing schema files |
| `db:migrate:run` | Apply pending migrations | Before testing, in CI/CD |
| `db:migrate:status` | Show applied/pending migrations | Debugging |
| `db:push` | Push schema directly (no migration) | Local prototyping ONLY |
| `db:studio` | Open Drizzle Studio GUI | Debugging |
| `db:baseline` | Mark existing schema as migrated | One-time after db:push |

---

## Anti-Patterns to Avoid

### ❌ Writing SQL Migrations by Hand

```sql
-- DON'T DO THIS
ALTER TABLE foo ADD COLUMN bar TEXT;
```

**Why:** Snapshots become out of sync.

**Instead:** Edit TypeScript schema, run `db:generate`.

### ❌ Using db:push in Production

```bash
# DON'T DO THIS IN CI/CD
pnpm db:push --force
```

**Why:** Can drop tables, no rollback, no tracking.

**Instead:** Use `db:migrate:run`.

### ❌ Modifying Applied Migrations

**DON'T** edit a migration file after it's been applied to any database.

**Instead:** Create a new migration that makes corrections.

### ❌ Not Committing Snapshot Files

The `meta/*_snapshot.json` files are REQUIRED for Drizzle to calculate diffs.

**Always commit:** SQL files + journal + snapshots.

---

## Docker Migration Flow

```
┌─────────────────────────────────────────────────────┐
│                  Deployment                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. db-init container starts                        │
│     └─ Runs: pnpm db:migrate:run                    │
│         └─ Reads drizzle/__drizzle_migrations       │
│         └─ Applies only NEW migrations              │
│         └─ Updates tracking table                   │
│                                                      │
│  2. db-init container runs seeds                    │
│     └─ Runs: pnpm db:seed (idempotent)             │
│     └─ Runs: pnpm db:seed-rbac (idempotent)        │
│                                                      │
│  3. db-init container exits (success)              │
│                                                      │
│  4. web container starts                            │
│     └─ App connects to migrated database           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Drizzle ORM Resources

- [Official Migrations Guide](https://orm.drizzle.team/docs/migrations)
- [drizzle-kit Commands](https://orm.drizzle.team/kit-docs/commands)
- [Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration)

