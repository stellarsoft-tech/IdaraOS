#!/bin/sh
# =============================================================================
# Local Development Database Setup
# =============================================================================
# Use this for initial local setup. For ongoing changes, use:
#   pnpm --filter web db:push     (fast prototyping)
#   pnpm --filter web db:generate (create migration when ready)
#   pnpm --filter web db:migrate:run (apply migrations)
# =============================================================================

set -e

echo "=========================================="
echo "IdaraOS Local Database Setup"
echo "=========================================="

cd /app/apps/web

echo ""
echo "Step 1: Running migrations..."
pnpm db:migrate:run || {
    echo "No migrations to apply or first run"
}

echo ""
echo "Step 2: Seeding database..."
pnpm db:seed || echo "Seed skipped"

echo ""
echo "Step 3: Seeding RBAC..."
pnpm db:seed-rbac || echo "RBAC seed skipped"

echo ""
echo "=========================================="
echo "✅ Database ready!"
echo "=========================================="
echo ""
echo "Login: admin@example.com / Admin123!"
