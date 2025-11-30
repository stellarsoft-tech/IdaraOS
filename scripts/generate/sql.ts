import fs from "fs/promises"
import path from "path"
import type { ModuleSpec, Field } from "../../specs/spec.schema.js"

/**
 * Generate SQL schema with RLS policies from spec
 */
export async function generateSQL(spec: ModuleSpec, outputPath: string): Promise<void> {
  const tableName = `${spec.namespace.replace(".", "_")}_${spec.entity}s`
  
  const content = `-- ============================================
-- ${spec.label} Table
-- Generated from: ${spec.entity} spec
-- Namespace: ${spec.namespace}
-- ============================================

${generateCreateTable(spec, tableName)}

${generateIndexes(spec, tableName)}

${generateConstraints(spec, tableName)}

${generateComputedFunctions(spec)}

${generateRLS(spec, tableName)}

${generateTriggers(spec, tableName)}

${generateComments(spec, tableName)}
`

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, content, "utf-8")
  console.log(`✓ Generated SQL: ${outputPath}`)
}

function generateCreateTable(spec: ModuleSpec, tableName: string): string {
  const columns = spec.fields
    .filter((f) => !f.computed)
    .map((f) => `  ${f.name} ${getSQLType(f)}${f.required ? " NOT NULL" : ""}${getDefaultValue(f)}`)
    .join(",\n")
  
  return `-- Create table
CREATE TABLE IF NOT EXISTS ${tableName} (
${columns},
  ${spec.permissions.scope} UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT ${tableName}_pkey PRIMARY KEY (${spec.id})
);`
}

function getSQLType(field: Field): string {
  switch (field.type) {
    case "string":
      return "VARCHAR(255)"
    case "text":
      return "TEXT"
    case "number":
      return "INTEGER"
    case "boolean":
      return "BOOLEAN"
    case "date":
      return "DATE"
    case "datetime":
      return "TIMESTAMP"
    case "uuid":
      return "UUID"
    case "enum":
      return "VARCHAR(50)"
    case "json":
      return "JSONB"
    default:
      return "TEXT"
  }
}

function getDefaultValue(field: Field): string {
  if (field.default === undefined) {
    return ""
  }
  
  if (field.type === "boolean") {
    return ` DEFAULT ${field.default}`
  }
  
  if (field.type === "uuid" && field.default === "gen_random_uuid()") {
    return " DEFAULT gen_random_uuid()"
  }
  
  if (typeof field.default === "string") {
    return ` DEFAULT '${field.default}'`
  }
  
  return ` DEFAULT ${field.default}`
}

function generateIndexes(spec: ModuleSpec, tableName: string): string {
  const indexes: string[] = []
  
  // Index on org_id for scoping
  indexes.push(`CREATE INDEX idx_${tableName}_${spec.permissions.scope} ON ${tableName}(${spec.permissions.scope});`)
  
  // Indexes on filterable columns
  spec.table.filters.forEach((fieldName) => {
    const field = spec.fields.find((f) => f.name === fieldName)
    if (field && !field.computed) {
      indexes.push(`CREATE INDEX idx_${tableName}_${fieldName} ON ${tableName}(${fieldName});`)
    }
  })
  
  // Full-text search indexes
  const ftsFields = spec.fields.filter((f) => f.search?.fts)
  if (ftsFields.length > 0) {
    const ftsColumns = ftsFields.map((f) => f.name).join(", ")
    indexes.push(`CREATE INDEX idx_${tableName}_fts ON ${tableName} USING GIN(to_tsvector('english', ${ftsColumns}));`)
  }
  
  // Vector search indexes
  const vectorFields = spec.fields.filter((f) => f.search?.vector)
  vectorFields.forEach((field) => {
    indexes.push(`-- Vector index for ${field.name} (requires pgvector extension)`)
    indexes.push(`-- CREATE INDEX idx_${tableName}_${field.name}_vector ON ${tableName} USING ivfflat (${field.name}_embedding vector_cosine_ops);`)
  })
  
  return indexes.length > 0
    ? `\n-- Indexes\n${indexes.join("\n")}`
    : ""
}

function generateConstraints(spec: ModuleSpec, tableName: string): string {
  const constraints: string[] = []
  
  // Enum constraints
  spec.fields
    .filter((f) => f.type === "enum" && f.values)
    .forEach((field) => {
      const values = field.values!.map((v) => `'${v}'`).join(", ")
      constraints.push(`ALTER TABLE ${tableName}
ADD CONSTRAINT ${tableName}_${field.name}_check
CHECK (${field.name} IN (${values}));`)
    })
  
  return constraints.length > 0
    ? `\n-- Constraints\n${constraints.join("\n\n")}`
    : ""
}

function generateComputedFunctions(spec: ModuleSpec): string {
  const computedFields = spec.fields.filter((f) => f.computed && f.expr)
  
  if (computedFields.length === 0) {
    return ""
  }
  
  const functions = computedFields.map((field) => {
    return `-- Function for computed field: ${field.name}
CREATE OR REPLACE FUNCTION ${field.expr}()
RETURNS ${getSQLType(field)}
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- TODO: Implement computation logic
  -- Expression: ${field.expr}
  RETURN NULL;
END;
$$;`
  }).join("\n\n")
  
  return `\n-- Computed field functions\n${functions}`
}

function generateRLS(spec: ModuleSpec, tableName: string): string {
  const readRoles = spec.permissions.read.map((r) => `'${r}'`).join(", ")
  const writeRoles = spec.permissions.write.map((r) => `'${r}'`).join(", ")
  
  return `
-- Row Level Security
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Read policy
CREATE POLICY ${tableName}_read_policy ON ${tableName}
FOR SELECT
USING (
  ${spec.permissions.scope} = current_setting('app.current_org_id', true)::UUID
  AND (
    current_setting('app.current_role', true) = 'Owner'
    OR current_setting('app.current_role', true) IN (${readRoles})
  )
);

-- Write policy (INSERT, UPDATE)
CREATE POLICY ${tableName}_write_policy ON ${tableName}
FOR INSERT, UPDATE
USING (
  ${spec.permissions.scope} = current_setting('app.current_org_id', true)::UUID
  AND (
    current_setting('app.current_role', true) = 'Owner'
    OR current_setting('app.current_role', true) IN (${writeRoles})
  )
);

-- Delete policy
CREATE POLICY ${tableName}_delete_policy ON ${tableName}
FOR DELETE
USING (
  ${spec.permissions.scope} = current_setting('app.current_org_id', true)::UUID
  AND (
    current_setting('app.current_role', true) = 'Owner'
    OR current_setting('app.current_role', true) IN (${writeRoles})
  )
);`
}

function generateTriggers(spec: ModuleSpec, tableName: string): string {
  return `
-- Triggers
CREATE TRIGGER update_${tableName}_updated_at
BEFORE UPDATE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Note: Requires this function to exist:
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;`
}

function generateComments(spec: ModuleSpec, tableName: string): string {
  const comments: string[] = []
  
  comments.push(`COMMENT ON TABLE ${tableName} IS '${spec.label} entities';`)
  
  spec.fields.forEach((field) => {
    const comment = field.computed 
      ? `${toLabel(field.name)} (computed: ${field.expr})`
      : toLabel(field.name)
    comments.push(`COMMENT ON COLUMN ${tableName}.${field.name} IS '${comment}';`)
  })
  
  return `\n-- Comments\n${comments.join("\n")}`
}

function toLabel(fieldName: string): string {
  return fieldName
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

