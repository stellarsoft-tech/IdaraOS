#!/bin/sh
set -e

cd /app

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  IdaraOS Development Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Packages are pre-installed (built into image)"
echo "🚀 Starting Next.js development server..."
echo ""

cd /app/apps/web
exec npx next dev --hostname 0.0.0.0 --port 3000

