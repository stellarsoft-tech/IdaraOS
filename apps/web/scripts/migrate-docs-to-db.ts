/**
 * Docs Content Backfill — thin CLI wrapper
 *
 * The backfill logic now lives in post-migrate.ts as a tracked DATA_MIGRATION
 * entry (id: 2026-04-07_backfill_docs_content_from_mdx). It runs automatically
 * with `pnpm db:post-migrate` on every deployment.
 *
 * This wrapper exists for ad-hoc manual runs only:
 *   npx tsx scripts/migrate-docs-to-db.ts
 *
 * It simply delegates to `db:post-migrate` which is idempotent.
 */

import { execSync } from "child_process"

console.log("Delegating to db:post-migrate (backfill is registered as a tracked data migration)...\n")

try {
  execSync("pnpm db:post-migrate", { stdio: "inherit", cwd: process.cwd() })
} catch {
  process.exit(1)
}
