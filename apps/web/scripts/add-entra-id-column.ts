/**
 * Migration script to add entra_id column to core_users table
 */
import { db } from "../lib/db"
import { sql } from "drizzle-orm"

async function addEntraIdColumn() {
  console.log("Adding entra_id column to core_users table...")
  
  try {
    await db.execute(sql`ALTER TABLE core_users ADD COLUMN IF NOT EXISTS entra_id TEXT`)
    console.log("✓ Column added successfully")
  } catch (error) {
    console.error("Error adding column:", error)
    process.exit(1)
  }
  
  process.exit(0)
}

addEntraIdColumn()

