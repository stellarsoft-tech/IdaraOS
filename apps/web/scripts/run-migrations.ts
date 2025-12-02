#!/usr/bin/env tsx
/**
 * CLI Script: Run Database Migrations
 * 
 * This script runs all pending Drizzle ORM migrations against the database.
 * It should be called during deployment before starting the application.
 * 
 * Usage:
 *   pnpm db:run-migrations
 *   
 * Environment:
 *   DATABASE_URL - Required. PostgreSQL connection string.
 *   NODE_ENV - Optional. Set to "production" to enable SSL.
 */

import { runMigrations } from "../lib/db/migrate"

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  IdaraOS Database Migration Runner")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log()
  
  const startTime = Date.now()
  
  try {
    await runMigrations()
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log()
    console.log(`⏱️  Completed in ${duration}s`)
    console.log()
    process.exit(0)
  } catch (error) {
    console.error()
    console.error("Migration failed. See error above.")
    console.error()
    process.exit(1)
  }
}

main()

