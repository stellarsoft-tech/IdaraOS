import fs from "fs/promises"
import path from "path"
import type { ModuleSpec, Field } from "../../specs/spec.schema.js"

/**
 * Generate Zod schema and TypeScript types from spec
 */
export async function generateTypes(spec: ModuleSpec, outputPath: string): Promise<void> {
  const content = `// Generated from spec.json - DO NOT EDIT MANUALLY
import { z } from "zod"

${generateZodSchemas(spec)}

${generateTypeAliases(spec)}

${generateFieldMetadata(spec)}
`

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, content, "utf-8")
  console.log(`✓ Generated types: ${outputPath}`)
}

function generateZodSchemas(spec: ModuleSpec): string {
  const schemaFields = spec.fields
    .filter((f) => !f.computed) // Exclude computed fields from schema
    .map((f) => generateZodField(f))
    .join(",\n  ")

  return `/**
 * Zod schema for ${spec.label}
 */
export const ${spec.entity}Schema = z.object({
  ${schemaFields}
})

/**
 * Schema for creating ${spec.label} (without computed fields and optional ID)
 */
export const create${capitalize(spec.entity)}Schema = ${spec.entity}Schema.omit({ ${spec.id}: true })

/**
 * Schema for updating ${spec.label}
 */
export const update${capitalize(spec.entity)}Schema = ${spec.entity}Schema.partial().required({ ${spec.id}: true })`
}

function generateZodField(field: Field): string {
  let zodType = getZodType(field)
  
  // Add validation
  if (field.validation) {
    zodType = addValidation(zodType, field.validation)
  }
  
  // Handle optional vs required
  if (!field.required) {
    zodType = `${zodType}.optional()`
  }
  
  // Add default value
  if (field.default !== undefined) {
    const defaultValue = typeof field.default === "string" 
      ? `"${field.default}"` 
      : field.default
    zodType = `${zodType}.default(${defaultValue})`
  }
  
  return `${field.name}: ${zodType}`
}

function getZodType(field: Field): string {
  switch (field.type) {
    case "string":
    case "text":
      return "z.string()"
    case "number":
      return "z.number()"
    case "boolean":
      return "z.boolean()"
    case "date":
    case "datetime":
      return "z.string()" // Dates as ISO strings
    case "uuid":
      return "z.string().uuid()"
    case "enum":
      if (!field.values || field.values.length === 0) {
        throw new Error(`Enum field "${field.name}" must have values`)
      }
      const values = field.values.map(v => `"${v}"`).join(", ")
      return `z.enum([${values}])`
    case "json":
      return "z.any()" // Can be refined
    default:
      return "z.any()"
  }
}

function addValidation(zodType: string, validation: string): string {
  if (validation === "email") {
    return `${zodType}.email("Invalid email address")`
  }
  if (validation === "url") {
    return `${zodType}.url("Invalid URL")`
  }
  if (validation === "phone") {
    return `${zodType}.regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, "Invalid phone number")`
  }
  if (validation.startsWith("min:")) {
    const min = validation.split(":")[1]
    return `${zodType}.min(${min}, "Minimum ${min} characters required")`
  }
  if (validation.startsWith("max:")) {
    const max = validation.split(":")[1]
    return `${zodType}.max(${max}, "Maximum ${max} characters allowed")`
  }
  if (validation.startsWith("regex:")) {
    const pattern = validation.substring(6)
    return `${zodType}.regex(/${pattern}/, "Invalid format")`
  }
  return zodType
}

function generateTypeAliases(spec: ModuleSpec): string {
  const entityName = capitalize(spec.entity)
  
  return `/**
 * TypeScript type for ${spec.label}
 */
export type ${entityName} = z.infer<typeof ${spec.entity}Schema>

/**
 * Type for creating ${spec.label}
 */
export type Create${entityName} = z.infer<typeof create${capitalize(spec.entity)}Schema>

/**
 * Type for updating ${spec.label}
 */
export type Update${entityName} = z.infer<typeof update${capitalize(spec.entity)}Schema>`
}

function generateFieldMetadata(spec: ModuleSpec): string {
  const metadata = spec.fields.map((f) => {
    const label = toLabel(f.name)
    const placeholder = getPlaceholder(f)
    const type = getInputType(f)
    
    return `  ${f.name}: {
    label: "${label}",
    placeholder: "${placeholder}",
    type: "${type}",
    required: ${f.required || false},
    computed: ${f.computed || false}
  }`
  }).join(",\n")
  
  return `/**
 * Field metadata for UI rendering
 */
export const ${spec.entity}FieldMetadata = {
${metadata}
}`
}

function getInputType(field: Field): string {
  switch (field.type) {
    case "text":
      return "textarea"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "date":
      return "date"
    case "datetime":
      return "datetime"
    case "enum":
      return "select"
    case "uuid":
      return field.ref ? "async-select" : "text"
    default:
      return "text"
  }
}

function getPlaceholder(field: Field): string {
  const label = toLabel(field.name)
  
  if (field.type === "date" || field.type === "datetime") {
    return "Select date"
  }
  if (field.type === "enum") {
    return `Select ${label.toLowerCase()}`
  }
  if (field.ref) {
    return `Search ${label.toLowerCase()}`
  }
  
  return `Enter ${label.toLowerCase()}`
}

function toLabel(fieldName: string): string {
  return fieldName
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

