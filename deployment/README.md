# IdaraOS Deployment

This directory contains deployment configurations for IdaraOS across different platforms.

## Supported Platforms

| Platform | Status | Directory |
|----------|--------|-----------|
| Azure Container Apps | ✅ Supported | [azure/](./azure/) |
| Vercel | 📋 Planned | - |
| AWS ECS | 📋 Planned | - |
| Google Cloud Run | 📋 Planned | - |

## Quick Start

### Local Development with Docker

```bash
cd deployment/docker
docker-compose -f docker-compose.local.yml up -d
```

This will:
1. Start a PostgreSQL database
2. Run database migrations and seed data (via `db-init` container)
3. Start the IdaraOS web application

Access the app at http://localhost:3000

**Default Credentials (from seed data):**
- Email: `admin@demo.com`
- Password: `admin123`

**To rebuild after code changes:**
```bash
docker-compose -f docker-compose.local.yml up -d --build
```

**To reset the database:**
```bash
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d
```

### Azure Deployment

See [azure/README.md](./azure/README.md) for detailed instructions.

```powershell
# Initialize infrastructure
./azure/scripts/init-infrastructure.ps1 `
    -EnvironmentName "dev" `
    -Location "uks" `
    -Sequence "001" `
    -Owner "your.email@company.com"
```

## Platform Comparison

### Azure Container Apps vs Vercel

| Aspect | Azure Container Apps | Vercel |
|--------|---------------------|--------|
| **Setup Complexity** | Medium (scripts + Docker) | Very Low (connect repo) |
| **Time to Deploy** | ~30 mins initial setup | ~5 mins |
| **Cost (Small Scale)** | ~$30-80/mo | Free tier available |
| **Cost (Enterprise)** | Better at scale | Gets expensive |
| **Multi-Cloud** | ✅ Yes (containerized) | ❌ No (Vercel only) |
| **Database Hosting** | ✅ Managed PostgreSQL | ❌ External only |
| **Full Customization** | ✅ Full control | ⚠️ Limited |
| **Enterprise SSO** | ✅ Entra ID native | ⚠️ Requires Enterprise |
| **Compliance** | ✅ SOC2, ISO27001, HIPAA | ⚠️ SOC2, GDPR |
| **Preview Deployments** | ⚠️ Manual setup | ✅ Built-in per PR |
| **Edge Functions** | Via Azure Functions | ✅ Built-in |
| **Cold Starts** | ⚠️ Possible (mitigated with min replicas) | ✅ Minimal |

### Recommendation

**Choose Azure Container Apps if:**
- You need multi-cloud portability
- You have enterprise compliance requirements
- You want managed PostgreSQL in the same network
- You're already using Azure/Entra ID
- You need PIM for privileged access management
- You want full infrastructure control

**Choose Vercel if:**
- You want the fastest deployment setup
- You primarily need a frontend/marketing site
- You're okay with external database hosting
- You want built-in PR preview deployments
- You don't need enterprise SSO
- Cost is a primary concern at small scale

### Why We Recommend Azure Container Apps for IdaraOS

1. **Entra ID Integration**: IdaraOS already has Entra ID SSO built-in, making Azure a natural fit
2. **Containerization**: Docker-based deployment enables future multi-cloud migration
3. **Database Proximity**: PostgreSQL in the same VNet reduces latency and improves security
4. **Enterprise Ready**: Full Azure compliance certifications for regulated industries
5. **PIM Support**: Just-In-Time privileged access for production environments
6. **Cost at Scale**: More predictable pricing as usage grows

## Directory Structure

```
IdaraOS/
├── .dockerignore               # Build context exclusions (must be at repo root)
│
├── deployment/
│   ├── docker/
│   │   ├── Dockerfile              # Multi-stage production build
│   │   └── docker-compose.local.yml # Local development stack
│   │
│   ├── azure/
│   │   ├── scripts/
│   │   │   ├── init-infrastructure.ps1    # One-time setup
│   │   │   ├── create-pim-rbac-groups.ps1 # PIM groups
│   │   │   └── deploy-aca-service.ps1     # Deploy container
│   │   └── README.md               # Azure-specific docs
│   │
│   └── README.md                   # This file
```

## CI/CD Workflows

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | PR, Push to main | Lint, test, build Docker |
| `deploy-azure.yml` | Push to main, Manual | Deploy to Azure environments |

## Environment Variables

Required for all deployment platforms:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Session token signing key | 64+ character random string |
| `ENCRYPTION_KEY` | Data encryption key | 32 character random string |
| `NODE_ENV` | Runtime environment | `production` |

## Security Best Practices

1. **Never commit secrets** - Use environment variables or secret managers
2. **Use OIDC authentication** - No stored credentials in CI/CD
3. **Enable PIM for production** - Just-In-Time elevated access
4. **Private database access** - No public endpoints in production
5. **Regular secret rotation** - Automate with Key Vault

## Contributing

When adding support for a new platform:

1. Create a new directory under `deployment/`
2. Include infrastructure-as-code scripts
3. Add comprehensive README
4. Update this file with comparison
5. Add CI/CD workflow in `.github/workflows/`
