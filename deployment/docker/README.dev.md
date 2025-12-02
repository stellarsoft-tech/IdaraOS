# Development Docker Setup

This guide explains how to use the development Docker Compose setup for IdaraOS with hot reloading and HTTPS.

## Quick Start

```bash
cd deployment/docker
docker-compose -f docker-compose.dev.yml up
```

The application will be available at:
- **https://localhost** (recommended for Entra SSO)
- http://localhost:3000 (direct, no HTTPS)

## HTTPS Setup

The development environment includes **Caddy** as a reverse proxy that provides automatic HTTPS with self-signed certificates.

### First Time Setup (Trust Certificate)

When you first access https://localhost, your browser will show a security warning. This is expected for self-signed certificates:

**Chrome/Edge:**
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

**Firefox:**
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**Optional: Trust the certificate system-wide:**
```bash
# Access the Caddy container
docker exec -it idaraos-caddy-dev sh

# The certificate is at /data/caddy/pki/authorities/local/root.crt
# Copy it out and add to your system's trusted certificates
```

### Why HTTPS?

- **Entra ID SSO**: Microsoft's OAuth requires HTTPS redirect URIs
- **Security Headers**: Caddy adds security headers (HSTS, X-Frame-Options, etc.)
- **Closer to Production**: Test with the same protocol as production

## Entra ID (Azure AD) Setup

Before using SSO, register your app in Entra ID:

```powershell
# From the repository root
cd deployment/azure/scripts
./register-entra-app.ps1 -CreateClientSecret
```

This script will:
1. Create an Entra ID app registration
2. Configure HTTPS redirect URIs (https://localhost, https://idaraos.local)
3. Set up API permissions
4. Output environment variables for your `.env.local`

Then add to your `.env.local`:
```env
AZURE_AD_CLIENT_ID=<from script output>
AZURE_AD_TENANT_ID=<from script output>
AZURE_AD_CLIENT_SECRET=<from script output>
```

## How It Works

### Volume Mounts

The development setup mounts your entire repository into the container:

```yaml
volumes:
  - ../../:/app                           # Mount entire repo
  - web_node_modules:/app/node_modules    # Container's node_modules
  - web_app_node_modules:/app/apps/web/node_modules
  - web_next_cache:/app/apps/web/.next    # Build cache
```

**Why use named volumes for node_modules?**
- Container has dependencies installed for Linux (Alpine)
- Host might have different OS (Windows/Mac)
- Prevents conflicts between host and container dependencies

### Hot Reloading

- Next.js Fast Refresh is enabled
- File watchers use polling (`CHOKIDAR_USEPOLLING=true`) for better compatibility
- Changes to `.ts`, `.tsx`, `.css` files trigger automatic reloads
- No need to restart the container

### Services

| Service | Purpose | Port |
|---------|---------|------|
| `caddy` | HTTPS reverse proxy | 80, 443 |
| `web` | Next.js dev server | 3000 |
| `db` | PostgreSQL database | 5432 |
| `db-init` | Migrations & seeding | - |

## Common Tasks

### Start Development Environment

```bash
docker-compose -f docker-compose.dev.yml up
```

### Start in Background

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f web
docker-compose -f docker-compose.dev.yml logs -f caddy
```

### Stop Environment

```bash
docker-compose -f docker-compose.dev.yml down
```

### Reset Database

```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up
```

### Run Database Migrations

Migrations run automatically when the `db-init` container starts. To run them manually:

```bash
# Inside the web container
docker exec -it idaraos-web-dev sh
cd apps/web
pnpm db:run-migrations
```

### Create New Migration

When you modify the database schema:

```bash
# On your host machine (in apps/web directory)
cd apps/web
pnpm db:generate --name your_migration_name
```

This creates a new SQL file in `apps/web/drizzle/` that will be applied on next deployment.

### Rebuild Container (after dependency changes)

```bash
docker-compose -f docker-compose.dev.yml build --no-cache web
docker-compose -f docker-compose.dev.yml up
```

### Run Commands Inside Container

```bash
# Access shell
docker exec -it idaraos-web-dev sh

# Run pnpm commands
docker exec -it idaraos-web-dev pnpm --filter web db:studio
docker exec -it idaraos-web-dev pnpm --filter web lint
```

## Troubleshooting

### HTTPS Certificate Errors

If you get certificate errors even after accepting:

1. **Clear HSTS** for localhost in browser
2. **Regenerate certificates**:
   ```bash
   docker-compose -f docker-compose.dev.yml down -v
   docker-compose -f docker-compose.dev.yml up
   ```

### Changes Not Reflecting

1. **Check file watcher**: Ensure `CHOKIDAR_USEPOLLING=true` is set (it is by default)
2. **Check volume mounts**: Verify files are actually mounted
   ```bash
   docker exec -it idaraos-web-dev ls -la /app/apps/web
   ```
3. **Restart container**: Sometimes file watchers need a restart
   ```bash
   docker-compose -f docker-compose.dev.yml restart web
   ```

### Port Already in Use

If port 443 or 3000 is already in use:

```yaml
# In docker-compose.dev.yml, change:
ports:
  - "8443:443"  # Use 8443 for HTTPS
  - "3001:3000" # Use 3001 for HTTP
```

Then update `NEXTAUTH_URL`:
```yaml
environment:
  NEXTAUTH_URL: https://localhost:8443
```

### Database Connection Issues

1. **Check database is healthy**:
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

2. **Check database logs**:
   ```bash
   docker-compose -f docker-compose.dev.yml logs db
   ```

3. **Verify DATABASE_URL**:
   ```bash
   docker exec -it idaraos-web-dev env | grep DATABASE_URL
   ```

### Caddy Not Proxying

1. **Check Caddy logs**:
   ```bash
   docker-compose -f docker-compose.dev.yml logs caddy
   ```

2. **Verify web container is running**:
   ```bash
   docker-compose -f docker-compose.dev.yml ps web
   ```

3. **Test direct access**: http://localhost:3000 should work

### Node Modules Issues

If you see module resolution errors:

1. **Rebuild container** (reinstalls dependencies):
   ```bash
   docker-compose -f docker-compose.dev.yml build --no-cache web
   ```

2. **Check volume mounts** (node_modules should be in named volumes):
   ```bash
   docker exec -it idaraos-web-dev ls -la /app/node_modules
   ```

### Performance Issues

- **File watching**: Polling can be slower than native events, but more reliable in Docker
- **Large repos**: Consider using `.dockerignore` patterns (though it doesn't affect volumes)
- **Memory**: Ensure Docker has enough RAM allocated (4GB+ recommended)

## Differences from Production Build

| Feature | Development | Production |
|---------|------------|------------|
| **Build** | No build step | Full Next.js build |
| **Hot Reload** | ✅ Enabled | ❌ Disabled |
| **HTTPS** | ✅ Self-signed | ✅ Real certs |
| **Source Maps** | ✅ Full | ⚠️ Limited |
| **File Watching** | ✅ Active | ❌ None |
| **Volume Mounts** | ✅ Yes | ❌ No |
| **Image Size** | ~500MB | ~150MB |
| **Startup Time** | ~5s | ~2s |

## Best Practices

1. **Use `.env.local`** for local environment variables (not committed)
2. **Keep dependencies in sync** - Run `pnpm install` locally if you add packages
3. **Rebuild container** after major dependency changes
4. **Use separate volumes** - Dev uses `postgres_data_dev`, prod uses `postgres_data`
5. **Check logs regularly** - Development mode shows more verbose output
6. **Use HTTPS** - Always use https://localhost for Entra SSO testing

## Integration with IDE

Most IDEs will work normally since files are on your host machine:

- ✅ **VS Code**: Full IntelliSense and debugging
- ✅ **Cursor**: Full AI assistance
- ✅ **Git**: All git operations work normally
- ✅ **File Search**: IDE search works across mounted files

The container only runs the dev server - all editing happens on your host machine.

## Custom Domain (Optional)

To use `idaraos.local` instead of `localhost`:

1. **Add to hosts file**:
   ```
   # Windows: C:\Windows\System32\drivers\etc\hosts
   # Mac/Linux: /etc/hosts
   127.0.0.1 idaraos.local
   ```

2. **Access at**: https://idaraos.local

This is already configured in the Caddyfile.
