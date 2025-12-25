#!/bin/sh
set -e

cd /app

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  IdaraOS Development Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if packages need to be installed
if [ ! -d "/app/node_modules/.pnpm" ] || [ ! -d "/app/apps/web/node_modules/next" ]; then
  echo "📦 Installing packages (first run)..."
  echo "   This may take a few minutes..."
  echo ""
  pnpm install --prefer-offline || pnpm install
  echo ""
  echo "✅ Packages installed!"
else
  echo "📦 Checking for package updates..."
  pnpm install --prefer-offline 2>/dev/null || true
fi

echo ""
echo "🚀 Starting Next.js development server..."
echo ""

cd /app/apps/web
exec npx next dev --hostname 0.0.0.0 --port 3000

