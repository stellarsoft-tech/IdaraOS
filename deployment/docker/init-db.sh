#!/bin/sh
set -e

echo "=========================================="
echo "IdaraOS Database Initialization"
echo "=========================================="

cd /app/apps/web

echo ""
echo "Step 1: Pushing database schema..."
echo "------------------------------------------"
pnpm db:push
if [ $? -ne 0 ]; then
    echo "❌ Failed to push database schema"
    exit 1
fi
echo "✅ Database schema pushed successfully"

echo ""
echo "Step 2: Seeding database..."
echo "------------------------------------------"
pnpm db:seed
if [ $? -ne 0 ]; then
    echo "❌ Failed to seed database"
    exit 1
fi
echo "✅ Database seeded successfully"

echo ""
echo "Step 3: Seeding RBAC permissions..."
echo "------------------------------------------"
pnpm db:seed-rbac
if [ $? -ne 0 ]; then
    echo "❌ Failed to seed RBAC permissions"
    exit 1
fi
echo "✅ RBAC permissions seeded successfully"

echo ""
echo "=========================================="
echo "✅ Database initialization complete!"
echo "=========================================="
