/**
 * Post-Migration Hook
 * 
 * This script runs automatically after database migrations.
 * It ensures the RBAC system is properly synced with any new modules.
 * 
 * Run: pnpm db:post-migrate (called automatically by db:migrate)
 */

import { syncRBACPermissions } from "./sync-rbac-permissions"

async function postMigrate() {
  console.log("\n" + "=".repeat(50))
  console.log("🚀 Running post-migration tasks...")
  console.log("=".repeat(50) + "\n")

  // Sync RBAC permissions (ensures Owner has all new module permissions)
  await syncRBACPermissions()

  console.log("\n" + "=".repeat(50))
  console.log("✅ Post-migration tasks complete!")
  console.log("=".repeat(50) + "\n")
}

postMigrate()
  .catch((error) => {
    console.error("❌ Post-migration failed:", error)
    process.exit(1)
  })

