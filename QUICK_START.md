# Quick Start Guide

Get IdaraOS - Organization Operating System - running locally in minutes using Docker.

## Prerequisites

- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Git** - For cloning the repository

## Local Development Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/stellarsoft-tech/IdaraOS.git
cd IdaraOS
```

### Step 2: Start the Development Environment

```bash
cd deployment/docker
docker-compose -f docker-compose.dev.yml up
```

This starts:
- **PostgreSQL** database on port 5432
- **Database migrations** (runs automatically)
- **Next.js dev server** with hot reload
- **Caddy** reverse proxy for HTTPS

### Step 3: Access the Application

- **HTTPS** (recommended): https://localhost
- **Direct**: http://localhost:3000

The first time you access via HTTPS, your browser will warn about the self-signed certificate. This is expected for local development - proceed anyway.

### Step 4: Start Building

The development environment is ready. Any changes you make to the source code will be reflected immediately.

---

## Alternative: Local Production Build

To test the production build locally:

```bash
cd deployment/docker
docker-compose -f docker-compose.local.yml up -d
```

This builds and runs the optimized production version.

---

## Manual Setup (Without Docker)

If you prefer to run without Docker:

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 14+

### Steps

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your database connection

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Visit http://localhost:3000

---

## Environment Variables

Key environment variables (set automatically in Docker):

| Variable | Description | Default (Docker) |
|----------|-------------|------------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://idaraos:localdevpassword@db:5432/idaraos` |
| `JWT_SECRET` | Secret for JWT tokens | Auto-generated |
| `ENCRYPTION_KEY` | Key for encrypting sensitive data | Auto-generated |
| `NEXTAUTH_URL` | Application URL for auth callbacks | `https://localhost` |

For Microsoft Entra ID integration, you'll also need:
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`

---

## Development Commands

### Using the Dev Script (Recommended for Windows)

```powershell
cd deployment/docker

# Start everything
.\dev.ps1 start

# After adding a new npm package to package.json
.\dev.ps1 install

# After changing database schema files
.\dev.ps1 db:push

# View logs
.\dev.ps1 logs

# Full reset (nuclear option)
.\dev.ps1 reset
```

Run `.\dev.ps1` without arguments to see all available commands.

### Using pnpm (Cross-platform)

From the project root:

```bash
# === STARTUP ===
pnpm docker:dev:detach           # Start all services in background
pnpm docker:logs:web             # Watch web container logs

# === AFTER ADDING NPM PACKAGES ===
pnpm docker:install              # Install packages & restart web

# === AFTER CHANGING DATABASE SCHEMA ===
pnpm docker:db:push              # Push schema changes to database
pnpm docker:db:sync              # Push schema + reseed RBAC

# === UTILITIES ===
pnpm docker:restart:web          # Quick restart of web container
pnpm docker:shell:web            # Open shell in web container
pnpm docker:ps                   # Show container status

# === RESET ===
pnpm docker:db:reset             # Reset database (drop all data)
pnpm docker:down:volumes         # Stop & remove all volumes
```

### Common Workflows

**I added a new npm package:**
```bash
pnpm docker:install
```

**I changed the database schema:**
```bash
pnpm docker:db:push
```

**I added new RBAC permissions:**
```bash
pnpm docker:db:seed-rbac
```

**Something is broken, help!**
```bash
# Full reset - stops everything, clears volumes, rebuilds
cd deployment/docker
.\dev.ps1 reset
```

### Non-Docker Development

```bash
# Start development server
pnpm dev

# Linting
pnpm lint
pnpm lint --fix

# Type checking
pnpm typecheck

# Database
pnpm db:push      # Push schema (dev)
pnpm db:generate  # Generate migration
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio GUI
```

---

## Project Structure Overview

```
apps/web/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Dashboard pages
│   │   ├── settings/       # Settings module
│   │   └── people/         # People & HR module
│   └── api/                # API routes
├── components/
│   ├── primitives/         # Reusable components (DataTable, FormBuilder, etc.)
│   └── ui/                 # shadcn/ui components
└── lib/
    ├── api/                # React Query hooks
    ├── db/                 # Database schema
    └── rbac/               # Permissions
```

---

## Available Modules

### Settings (`/settings`)

- **Organization Profile** - Company settings, timezone, currency
- **Users & Access** - User management, role assignment
- **Roles & Permissions** - Custom roles with permission matrix
- **Integrations** - Microsoft Entra ID SSO/SCIM

### People & HR (`/people`)

- **Directory** - Employee list with search and filters
- **Person Detail** - Individual profiles
- **Onboarding** - New hire workflows (placeholder)
- **Time Off** - Leave management (placeholder)

---

## Key Components

### DataTable

```tsx
import { DataTableAdvanced } from "@/components/primitives/data-table-advanced"

<DataTableAdvanced
  columns={columns}
  data={data}
  loading={isLoading}
  searchKey="name"
  searchPlaceholder="Search..."
  facetedFilters={{
    status: { type: "enum" },
    team: { type: "enum" },
  }}
  enableExport
  enableColumnVisibility
/>
```

### FormDrawer

```tsx
import { FormDrawer } from "@/components/primitives/form-drawer"

<FormDrawer
  open={open}
  onOpenChange={setOpen}
  title="Create Item"
  schema={createSchema}
  config={formConfig}
  fields={["name", "email", "status"]}
  mode="create"
  onSubmit={handleCreate}
/>
```

### PageShell

```tsx
import { PageShell } from "@/components/primitives/page-shell"

<PageShell
  title="My Page"
  description="Page description"
  action={<Button>Action</Button>}
>
  {children}
</PageShell>
```

### Protected (RBAC)

```tsx
import { Protected } from "@/components/primitives/protected"

<Protected module="settings.users" action="create">
  <Button>Add User</Button>
</Protected>
```

---

## Troubleshooting

### Docker Issues

**Port already in use:**
```bash
# Stop existing containers
docker-compose -f docker-compose.dev.yml down

# Check what's using the port
# Windows: netstat -ano | findstr :3000
# Mac/Linux: lsof -i :3000
```

**Database connection errors:**
```bash
# Restart with fresh volumes
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up
```

**Hot reload not working:**
Ensure your Docker Desktop has file sharing enabled for your project directory.

### General Issues

**TypeScript errors after pulling:**
```bash
pnpm install
pnpm typecheck
```

**Database schema out of sync:**
```bash
pnpm db:migrate
```

---

## Next Steps

1. Explore the existing modules at `/settings` and `/people`
2. Read the [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development workflow
3. Review module architectures in `docs/modules/`
4. Check [DECISIONS.md](docs/DECISIONS.md) for technical context

---

## Support

- Review existing documentation in `docs/`
- Check code examples in existing modules
- Open a discussion for questions
