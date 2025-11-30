#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { validateSpec, getOutputPath, type ModuleSpec } from "../../specs/spec.schema.js"
import { generateTypes } from "./types.js"
import { generateColumns } from "./columns.js"
import { generateFormConfig } from "./form-config.js"
import { generateSQL } from "./sql.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Main generator CLI
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error("Usage: pnpm generate <spec-path>")
    console.error("Example: pnpm generate specs/modules/people/person/spec.json")
    process.exit(1)
  }
  
  const specPath = args[0]
  
  try {
    console.log(`\n📋 Reading spec: ${specPath}`)
    const spec = await loadSpec(specPath)
    
    console.log(`✓ Spec loaded: ${spec.label} (${spec.namespace}.${spec.entity})`)
    console.log(`\n🔨 Generating code...\n`)
    
    // Generate all artifacts
    await generateAllArtifacts(spec)
    
    console.log(`\n✨ Generation complete!\n`)
    console.log(`Generated files:`)
    console.log(`  - ${getOutputPath(spec, "types.ts")}`)
    console.log(`  - ${getOutputPath(spec, "columns.tsx")}`)
    console.log(`  - ${getOutputPath(spec, "form-config.ts")}`)
    console.log(`\nNext steps:`)
    console.log(`  1. Review generated files`)
    console.log(`  2. Create list page at: ${spec.routing.list}/page.tsx`)
    console.log(`  3. Create detail page at: ${spec.routing.detail}/page.tsx`)
    console.log(`  4. Add to navigation in: app-sidebar.tsx`)
    
  } catch (error) {
    console.error(`\n❌ Generation failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

/**
 * Load and validate spec.json file
 */
async function loadSpec(specPath: string): Promise<ModuleSpec> {
  try {
    const content = await fs.readFile(specPath, "utf-8")
    const json = JSON.parse(content)
    return validateSpec(json)
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      throw new Error(`Spec file not found: ${specPath}`)
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in spec file: ${error.message}`)
    }
    throw error
  }
}

/**
 * Generate all code artifacts from spec
 */
async function generateAllArtifacts(spec: ModuleSpec): Promise<void> {
  const projectRoot = path.resolve(__dirname, "../..")
  
  // Generate types
  const typesPath = path.resolve(projectRoot, getOutputPath(spec, "types.ts"))
  await generateTypes(spec, typesPath)
  
  // Generate columns
  const columnsPath = path.resolve(projectRoot, getOutputPath(spec, "columns.tsx"))
  await generateColumns(spec, columnsPath)
  
  // Generate form config
  const formConfigPath = path.resolve(projectRoot, getOutputPath(spec, "form-config.ts"))
  await generateFormConfig(spec, formConfigPath)
  
  // Generate SQL migration
  const sqlPath = path.resolve(projectRoot, `migrations/${Date.now()}_create_${spec.entity}s.sql`)
  await generateSQL(spec, sqlPath)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main, loadSpec, generateAllArtifacts }

