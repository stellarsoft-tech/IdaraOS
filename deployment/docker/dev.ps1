# =============================================================================
# IdaraOS - Development Helper Script
# =============================================================================
# Usage: .\dev.ps1 <command>
# =============================================================================

param(
    [Parameter(Position=0)]
    [string]$Command,
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show-Help {
    Write-Host @"

IdaraOS Development Commands
============================

STARTUP & SHUTDOWN:
  start         Start all services (db + web)
  stop          Stop all services
  restart       Restart web container (quick reload)
  reset         Full reset: stop, clear volumes, rebuild, start

PACKAGE MANAGEMENT:
  install       Install packages (after adding to package.json)
  
DATABASE (Migrations - Recommended):
  db:generate       Generate migration from schema changes
  db:migrate        Run pending migrations
  db:migrate:force  Run migrations, force-fix conflicts
  db:migrate:fix    Fix out-of-sync migration state
  db:status         Show migration status
  
DATABASE (Dev Shortcuts):
  db:push           Quick schema push (bypasses migrations, dev only)
  db:seed           Seed the database with initial data
  db:seed-rbac      Seed RBAC permissions and roles
  db:reset          Reset database (drop all, migrate, seed)

UTILITIES:
  logs          Show web container logs (follow mode)
  shell         Open shell in web container
  status        Show container status

EXAMPLES:
  .\dev.ps1 start           # Start development environment
  .\dev.ps1 install         # After adding a new npm package
  .\dev.ps1 db:generate     # After changing schema files (creates migration)
  .\dev.ps1 db:migrate      # Apply pending migrations
  .\dev.ps1 db:status       # Check migration status
  .\dev.ps1 reset           # Nuclear option - full reset

SCHEMA CHANGE WORKFLOW:
  1. Edit schema files in apps/web/lib/db/schema/
  2. Run: .\dev.ps1 db:generate
  3. Review the generated .sql file in apps/web/drizzle/
  4. Run: .\dev.ps1 db:migrate
  5. If needed: .\dev.ps1 db:seed-rbac

"@
}

function Invoke-DockerCompose {
    param([string[]]$Arguments)
    Push-Location $ScriptDir
    try {
        & docker compose -f docker-compose.dev.yml @Arguments
    } finally {
        Pop-Location
    }
}

function Wait-ForHealthy {
    param([string]$Service, [int]$TimeoutSeconds = 60)
    Write-Host "Waiting for $Service to be healthy..." -ForegroundColor Cyan
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        $status = docker inspect --format='{{.State.Health.Status}}' "idaraos-$Service-dev" 2>$null
        if ($status -eq "healthy") {
            Write-Host "$Service is healthy!" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Write-Host "$Service did not become healthy within $TimeoutSeconds seconds" -ForegroundColor Red
    return $false
}

function Wait-ForWebReady {
    param([int]$TimeoutSeconds = 120)
    Write-Host "Waiting for web server to be ready..." -ForegroundColor Cyan
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 302) {
                Write-Host "Web server is ready!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Server not ready yet
        }
        Start-Sleep -Seconds 3
        $elapsed += 3
        Write-Host "  Still waiting... ($elapsed/$TimeoutSeconds seconds)" -ForegroundColor Gray
    }
    Write-Host "Web server did not become ready within $TimeoutSeconds seconds" -ForegroundColor Yellow
    Write-Host "Check logs with: .\dev.ps1 logs" -ForegroundColor Yellow
    return $false
}

switch ($Command) {
    "start" {
        Write-Host "`n=== Starting IdaraOS Development Environment ===" -ForegroundColor Cyan
        
        # Start database first
        Invoke-DockerCompose "up", "-d", "db"
        Wait-ForHealthy "db" 30
        
        # Start web (skip db-init, we'll handle migrations separately)
        Invoke-DockerCompose "up", "-d", "web", "--no-deps"
        
        Write-Host "`nServices starting. This may take a minute on first run (installing packages)." -ForegroundColor Yellow
        Write-Host "Run '.\dev.ps1 logs' to watch progress." -ForegroundColor Yellow
        
        Wait-ForWebReady 180
        
        Write-Host "`n=== IdaraOS is ready at http://localhost:3000 ===" -ForegroundColor Green
    }
    
    "stop" {
        Write-Host "`n=== Stopping IdaraOS ===" -ForegroundColor Cyan
        Invoke-DockerCompose "down"
        Write-Host "Stopped." -ForegroundColor Green
    }
    
    "restart" {
        Write-Host "`n=== Restarting Web Container ===" -ForegroundColor Cyan
        Invoke-DockerCompose "restart", "web"
        Wait-ForWebReady 120
        Write-Host "Restarted." -ForegroundColor Green
    }
    
    "reset" {
        Write-Host "`n=== Full Reset (this will delete all data) ===" -ForegroundColor Red
        $confirm = Read-Host "Are you sure? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Host "Cancelled." -ForegroundColor Yellow
            return
        }
        
        Write-Host "Stopping containers..." -ForegroundColor Cyan
        Invoke-DockerCompose "down", "-v"
        
        Write-Host "Removing volumes..." -ForegroundColor Cyan
        docker volume rm idaraos_web_node_modules idaraos_web_app_node_modules idaraos_web_next_cache idaraos_postgres_data_dev 2>$null
        
        Write-Host "Rebuilding and starting..." -ForegroundColor Cyan
        Invoke-DockerCompose "up", "-d", "--build", "db"
        Wait-ForHealthy "db" 30
        
        Invoke-DockerCompose "up", "-d", "--build", "web", "--no-deps"
        
        Write-Host "`nWaiting for packages to install (this may take a few minutes)..." -ForegroundColor Yellow
        Wait-ForWebReady 300
        
        Write-Host "`nRunning database setup..." -ForegroundColor Cyan
        Start-Sleep -Seconds 5
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:push"
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:seed"
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:seed-rbac"
        
        Write-Host "`n=== Reset complete! IdaraOS is ready at http://localhost:3000 ===" -ForegroundColor Green
    }
    
    "install" {
        Write-Host "`n=== Installing Packages ===" -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "web", "sh", "-c", "cd /app && pnpm install"
        Write-Host "`nRestarting web server to pick up changes..." -ForegroundColor Cyan
        Invoke-DockerCompose "restart", "web"
        Wait-ForWebReady 60
        Write-Host "Done!" -ForegroundColor Green
    }
    
    "db:generate" {
        Write-Host "`n=== Generating Migration ===" -ForegroundColor Cyan
        Write-Host "This creates a new migration file from your schema changes." -ForegroundColor Gray
        Invoke-DockerCompose "exec", "-T", "web", "pnpm", "--filter", "web", "db:generate"
        Write-Host "`nMigration generated! Check apps/web/drizzle/ for the new file." -ForegroundColor Green
        Write-Host "Next: Run '.\dev.ps1 db:migrate' to apply it." -ForegroundColor Yellow
    }
    
    "db:migrate" {
        Write-Host "`n=== Running Migrations ===" -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "-T", "web", "pnpm", "--filter", "web", "db:migrate"
        Write-Host "Migrations complete!" -ForegroundColor Green
    }
    
    "db:migrate:force" {
        Write-Host "`n=== Running Migrations (Force Mode) ===" -ForegroundColor Yellow
        Write-Host "This will mark conflicting migrations as applied." -ForegroundColor Gray
        Invoke-DockerCompose "exec", "-T", "web", "pnpm", "--filter", "web", "db:migrate:force"
        Write-Host "Migrations complete!" -ForegroundColor Green
    }
    
    "db:migrate:fix" {
        Write-Host "`n=== Fixing Migration State ===" -ForegroundColor Cyan
        Write-Host "This marks all local migrations as applied in the database." -ForegroundColor Gray
        Invoke-DockerCompose "exec", "-T", "web", "pnpm", "--filter", "web", "db:migrate:fix"
        Write-Host "Migration state fixed!" -ForegroundColor Green
    }
    
    "db:status" {
        Write-Host "`n=== Migration Status ===" -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "-T", "web", "pnpm", "--filter", "web", "db:migrate:status"
    }
    
    "db:push" {
        Write-Host "`n=== Pushing Schema (Dev Mode) ===" -ForegroundColor Yellow
        Write-Host "WARNING: db:push bypasses migrations. Use only for quick dev iteration." -ForegroundColor Red
        Write-Host "For proper changes, use: db:generate + db:migrate" -ForegroundColor Gray
        Invoke-DockerCompose "exec", "-T", "web", "pnpm", "--filter", "web", "db:push"
        Write-Host "Schema pushed!" -ForegroundColor Green
    }
    
    "db:seed" {
        Write-Host "`n=== Seeding Database ===" -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:seed"
        Write-Host "Seeding complete!" -ForegroundColor Green
    }
    
    "db:seed-rbac" {
        Write-Host "`n=== Seeding RBAC ===" -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:seed-rbac"
        Write-Host "RBAC seeding complete!" -ForegroundColor Green
    }
    
    "db:reset" {
        Write-Host "`n=== Resetting Database ===" -ForegroundColor Red
        $confirm = Read-Host "This will drop all tables. Are you sure? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Host "Cancelled." -ForegroundColor Yellow
            return
        }
        
        Write-Host "Dropping and recreating database..." -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "db", "psql", "-U", "idaraos", "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        
        Write-Host "Pushing schema..." -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:push"
        
        Write-Host "Seeding data..." -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:seed"
        Invoke-DockerCompose "exec", "web", "pnpm", "--filter", "web", "db:seed-rbac"
        
        Write-Host "Database reset complete!" -ForegroundColor Green
    }
    
    "logs" {
        Write-Host "`n=== Web Container Logs (Ctrl+C to exit) ===" -ForegroundColor Cyan
        Invoke-DockerCompose "logs", "-f", "web"
    }
    
    "shell" {
        Write-Host "`n=== Opening Shell in Web Container ===" -ForegroundColor Cyan
        Invoke-DockerCompose "exec", "web", "sh"
    }
    
    "status" {
        Write-Host "`n=== Container Status ===" -ForegroundColor Cyan
        Invoke-DockerCompose "ps"
    }
    
    default {
        Show-Help
    }
}

