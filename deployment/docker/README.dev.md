# Development Docker Setup

This guide explains how to use the development Docker Compose setup for IdaraOS with hot reloading.

## Quick Start

```bash
cd deployment/docker
docker-compose -f docker-compose.dev.yml up
```

The application will be available at http://localhost:3000

## How It Works

### Volume Mounts

The development setup mounts your entire repository into the container:

```yaml
volumes:
  - ../../:/app                    # Mount entire repo
  - /app/node_modules              # Exclude host node_modules
  - /app/apps/web/node_modules    # Use container's node_modules
  - /app/apps/web/.next           # Exclude build cache
```

**Why exclude node_modules?**
- Container has dependencies installed for Linux (Alpine)
- Host might have different OS (Windows/Mac)
- Prevents conflicts between host and container dependencies

### Hot Reloading

- Next.js Fast Refresh is enabled
- File watchers use polling (`CHOKIDAR_USEPOLLING=true`) for better compatibility
- Changes to `.ts`, `.tsx`, `.css` files trigger automatic reloads
- No need to restart the container

### Database

- Uses the same PostgreSQL setup as production build
- Database persists in `postgres_data_dev` volume
- Migrations run automatically on first start via `db-init` container

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
docker-compose -f docker-compose.dev.yml logs -f web
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

### Rebuild Container (after dependency changes)

```bash
docker-compose -f docker-compose.dev.yml build web
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

If port 3000 is already in use:

```yaml
# In docker-compose.dev.yml, change:
ports:
  - "3001:3000"  # Use 3001 on host, 3000 in container
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

### Node Modules Issues

If you see module resolution errors:

1. **Rebuild container** (reinstalls dependencies):
   ```bash
   docker-compose -f docker-compose.dev.yml build --no-cache web
   ```

2. **Check volume mounts** (node_modules should be excluded):
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

## Integration with IDE

Most IDEs will work normally since files are on your host machine:

- ✅ **VS Code**: Full IntelliSense and debugging
- ✅ **Cursor**: Full AI assistance
- ✅ **Git**: All git operations work normally
- ✅ **File Search**: IDE search works across mounted files

The container only runs the dev server - all editing happens on your host machine.
