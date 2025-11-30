# Database Migrations

**Note:** We use Drizzle ORM with schema-first migrations. The schema files in `apps/web/lib/db/schema/` are the source of truth.

## Quick Start

```bash
# 1. Start PostgreSQL (Docker)
docker run -d --name idaraos-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=idaraos \
  postgres:16

# 2. Push schema to database (dev only)
cd apps/web
pnpm db:push

# 3. (Optional) Seed demo data
pnpm db:seed

# 4. View database in browser
pnpm db:studio
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate migration from schema changes |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:push` | Push schema directly (dev only) |
| `pnpm db:studio` | Open Drizzle Studio UI |
| `pnpm db:seed` | Insert demo data (optional) |

## Environment

Create `apps/web/.env.local`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/idaraos
```

## Schema Location

Drizzle schema files are in: `apps/web/lib/db/schema/`

- `index.ts` - Exports all tables
- `people.ts` - People/employees table

## Adding New Tables

1. Create schema file in `apps/web/lib/db/schema/` (e.g., `assets.ts`)
2. Export from `index.ts`
3. **For development:** Run `pnpm db:push` to apply directly
4. **For production:** Run `pnpm db:generate` to create migration files, then `pnpm db:migrate` to apply

## Production

For production:
1. Use managed PostgreSQL (Supabase, Neon, Railway, etc.)
2. Set `DATABASE_URL` environment variable
3. Generate migrations: `pnpm db:generate` (creates files in `apps/web/drizzle/`)
4. Run migrations: `pnpm db:migrate` in CI/CD pipeline
5. **Never run `db:push` in production** - always use generated migrations
