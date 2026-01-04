# Database Migrations Guide

This document describes the **production-ready** workflow for managing database schema changes in IdaraOS using Drizzle ORM with PostgreSQL.

## Quick Reference

```bash
# Generate a new migration from schema changes
pnpm --filter web db:generate

# Check migration status (CI/CD friendly)
pnpm --filter web db:check

# Apply pending migrations
pnpm --filter web db:migrate:run

# View migration status
pnpm --filter web db:migrate:status

# View database in browser (dev only)
pnpm --filter web db:studio

# Run post-migration tasks (data migrations + RBAC sync)
pnpm --filter web db:post-migrate
```

## The Golden Rules

> **1. NEVER write SQL migration files by hand. ALWAYS use `drizzle-kit generate`.**

Drizzle ORM maintains snapshots of your schema state. When you write SQL manually, the snapshots become out of sync, causing future migrations to be incorrect.

> **2. NEVER use `db:push` in production. ONLY use it for rapid prototyping.**

`db:push` can drop tables and lose data. It has no migration history.

> **3. ALWAYS commit migration files together with schema changes.**

This includes: `*.sql` files, `meta/_journal.json`, and `meta/*_snapshot.json`.

---

## How Migrations Work

### Drizzle vs Entity Framework

| Feature | Drizzle ORM | Entity Framework |
|---------|-------------|------------------|
| Schema Definition | TypeScript files | C# classes with attributes |
| Migration Generation | `drizzle-kit generate` | `Add-Migration` |
| Migration Format | Pure SQL files | C#/Up-Down methods |
| Rollback Support | Not supported OOTB | Built-in `Down()` method |
| Snapshot Tracking | JSON in `meta/` | `__EFMigrationsHistory` |
| Data Seeding | Separate scripts | `HasData()` configuration |
| Custom SQL | Full control | Limited via `Sql()` |

**Key Difference:** Drizzle generates pure SQL (more transparent, portable) while EF generates code. Drizzle does not have automatic rollback support - to undo a migration, create a new migration that reverses the changes.

---

## Workflow: Making Schema Changes

### Step 1: Edit the TypeScript Schema

Make your changes in `apps/web/lib/db/schema/*.ts`:

```typescript
// Example: Add a new column
// Before
export const users = pgTable("core_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
})

// After  
export const users = pgTable("core_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nickname: text("nickname"), // NEW COLUMN
})
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

If the generated SQL is not what you want:
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
git commit -m "feat: add nickname column to users"
```

**Important:** Commit ALL of these:
- `*.sql` files
- `meta/_journal.json`
- `meta/*_snapshot.json`

---

## Supported Schema Operations

Drizzle automatically handles these operations via `drizzle-kit generate`:

| Operation | Auto-Generated? | Notes |
|-----------|-----------------|-------|
| Add table | Yes | Creates `CREATE TABLE` |
| Drop table | Yes | Creates `DROP TABLE` (prompts) |
| Add column | Yes | `ALTER TABLE ADD COLUMN` |
| Drop column | Yes | `ALTER TABLE DROP COLUMN` |
| Rename column | Prompted | Asks if rename or drop+add |
| Change column type | Yes | Uses `USING` clause |
| Add index | Yes | `CREATE INDEX` |
| Drop index | Yes | `DROP INDEX` |
| Add foreign key | Yes | With ON DELETE/UPDATE |
| Change FK action | Yes | Drops and recreates |
| Add constraint | Yes | Unique, check, etc. |
| Add schema | Yes | `CREATE SCHEMA` |

### Handling Complex Changes

#### Renaming Columns

When you rename a column, Drizzle will prompt you to confirm whether it is a rename or a drop+add.

#### Changing Column Types

For type changes, Drizzle generates a `USING` clause. You may need to modify this for complex conversions:

```sql
-- Generated (may need modification)
ALTER TABLE "users" ALTER COLUMN "status" TYPE integer USING "status"::integer;

-- Modified for safe conversion
ALTER TABLE "users" ALTER COLUMN "status" TYPE integer 
  USING CASE 
    WHEN status = 'active' THEN 1 
    WHEN status = 'inactive' THEN 0 
    ELSE 0 
  END;
```

---

## Reverting Changes

Drizzle does not auto-generate rollback migrations. To undo a migration:

1. **Modify your schema** to reverse the change (e.g., remove the column you added)
2. **Run `db:generate`** to create a new migration that drops the column
3. **Apply the migration** with `db:migrate:run`

This creates a forward-only migration history, which is the recommended approach for production databases.

---

## Data Migrations

For data transformations that accompany schema changes, use the post-migrate system.

### Adding a Data Migration

Edit `apps/web/scripts/post-migrate.ts`:

```typescript
const DATA_MIGRATIONS: DataMigration[] = [
  // Existing migrations...
  
  {
    id: "2024-03-15_populate_nicknames",
    description: "Set default nicknames from user names",
    run: async (db) => {
      await db.execute(sql`
        UPDATE core_users 
        SET nickname = split_part(name, ' ', 1)
        WHERE nickname IS NULL
      `)
    },
  },
]
```

### Data Migration Rules

1. **Unique ID**: Use `YYYY-MM-DD_descriptive_name` format
2. **Idempotent**: Safe to run multiple times
3. **Tracked**: Each migration runs only once (tracked in `data_migrations` table)
4. **Non-blocking**: Failures do not stop deployment

---

## CI/CD Integration

### Pre-Merge Checks

Add to your CI pipeline:

```yaml
# Check for schema drift and file integrity
- name: Check Migrations
  run: pnpm --filter web db:check:ci
```

Exit codes:
- `0` - All checks passed
- `1` - Schema drift (needs `db:generate`)
- `2` - Missing migration files
- `3` - Pending migrations (needs `db:migrate:run`)
- `4` - Configuration error

### Deployment Flow

```yaml
deploy:
  steps:
    # 1. Run migrations
    - name: Apply Migrations
      run: pnpm --filter web db:migrate:run
    
    # 2. Run post-migration tasks
    - name: Post-Migrate
      run: pnpm --filter web db:post-migrate
    
    # 3. Start application
    - name: Start App
      run: pnpm --filter web start
```

### Docker Deployment

The init container automatically runs migrations:

```yaml
# docker-compose.yml
db-init:
  build:
    dockerfile: deployment/docker/Dockerfile.init
  # Runs: pnpm db:migrate:run + pnpm db:post-migrate
```

---

## Environment-Specific Behavior

### Local Development (Rapid Prototyping)

When rapidly prototyping, you CAN use `db:push`:

```bash
# Use docker-compose.dev.yml which uses db:push
docker-compose -f docker-compose.dev.yml up

# Or directly:
pnpm db:push  # Syncs schema directly, no migrations
```

**Warning:** `db:push` can:
- Drop columns/tables
- Lose data
- Desync from migration state

Use it only when you are iterating fast and do not care about data loss.

### Staging / Production

**NEVER use `db:push`**. Only use migrations:

```bash
pnpm db:migrate:run
pnpm db:post-migrate
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
# Check what is applied vs pending
pnpm db:migrate:status

# If database was created with db:push, baseline it first
pnpm db:baseline
```

### "No migrations to apply" but Database is Empty

The migrations table does not exist yet. Run:

```bash
pnpm db:migrate:run
```

This will create the `drizzle.__drizzle_migrations` table and apply all migrations.

### Migration Conflicts After Merge

If two developers created migrations simultaneously:

```bash
# Option 1: Regenerate the conflicting migration
# Delete your local migration files that conflict
rm drizzle/XXXX_your_migration.sql
rm drizzle/meta/XXXX_snapshot.json

# Pull latest and regenerate
git pull
pnpm db:generate
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
| `db:check` | Validate migration state | In CI/CD pipelines |
| `db:check:ci` | CI mode validation (strict) | GitHub Actions, etc. |
| `db:post-migrate` | Run data migrations + RBAC sync | After schema migrations |
| `db:baseline` | Mark db:push db as migrated | One-time after db:push |
| `db:push` | Push schema directly (no migration) | **Local prototyping ONLY** |
| `db:studio` | Open Drizzle Studio GUI | Debugging |

---

## Anti-Patterns to Avoid

### Writing SQL Migrations by Hand

```sql
-- DO NOT DO THIS
ALTER TABLE foo ADD COLUMN bar TEXT;
```

**Why:** Snapshots become out of sync.

**Instead:** Edit TypeScript schema, run `db:generate`.

### Using db:push in Production

```bash
# DO NOT DO THIS IN CI/CD
pnpm db:push --force
```

**Why:** Can drop tables, no history, no tracking.

**Instead:** Use `db:migrate:run`.

### Modifying Applied Migrations

**DO NOT** edit a migration file after it has been applied to any database.

**Instead:** Create a new migration that makes corrections.

### Not Committing Snapshot Files

The `meta/*_snapshot.json` files are REQUIRED for Drizzle to calculate diffs.

**Always commit:** SQL files + journal + snapshots.

### Skipping Code Review for Migrations

Migration SQL can drop data. Always review generated SQL before committing.

---

## Best Practices

### 1. Small, Focused Migrations

Instead of one large migration that adds tables, columns, and constraints, break it into smaller focused changes.

### 2. Test Migrations on Staging First

Never run untested migrations on production. Use a staging environment that mirrors production.

### 3. Use Transactions

Drizzle wraps migrations in transactions by default. For custom SQL that spans multiple operations, ensure it is wrapped in a transaction.

### 4. Monitor Migration Performance

For large tables, schema changes can be slow. Monitor and test migration duration on production-like data volumes.

### 5. Document Breaking Changes

If a migration requires code changes (new required column, removed column), document this in the PR.

---

## Docker Migration Flow

```
Deployment Flow:

1. db-init container starts
   - Runs: pnpm db:migrate:run
   - Reads drizzle/__drizzle_migrations
   - Applies only NEW migrations
   - Updates tracking table

2. db-init runs post-migration
   - Runs: pnpm db:post-migrate
   - Data migrations (idempotent)
   - RBAC sync

3. db-init runs seeds
   - Runs: pnpm db:seed (idempotent)
   - Runs: pnpm db:seed-rbac (idempotent)

4. db-init container exits (success)

5. web container starts
   - App connects to migrated database
```

---

## Resources

- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [drizzle-kit Commands](https://orm.drizzle.team/kit-docs/commands)
- [Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)

---

**Last Updated**: January 2026
