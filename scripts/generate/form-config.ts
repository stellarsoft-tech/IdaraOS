import fs from "fs/promises"
import path from "path"
import type { ModuleSpec, Field } from "../../specs/spec.schema.js"

/**
 * Generate form field configuration from spec
 */
export async function generateFormConfig(spec: ModuleSpec, outputPath: string): Promise<void> {
  const content = `// Generated from spec.json - DO NOT EDIT MANUALLY
import { ${spec.entity}Schema, create${capitalize(spec.entity)}Schema, update${capitalize(spec.entity)}Schema } from "./types"

${generateFormFieldConfig(spec)}

${generateFormSchemas(spec)}
`

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, content, "utf-8")
  console.log(`✓ Generated form config: ${outputPath}`)
}

function generateFormFieldConfig(spec: ModuleSpec): string {
  const allFields = [...new Set([...spec.forms.create, ...spec.forms.edit])]
  
  const configs = allFields.map((fieldName) => {
    const field = spec.fields.find((f) => f.name === fieldName)
    if (!field) {
      throw new Error(`Field "${fieldName}" not found in spec`)
    }
    return generateFieldConfig(field, spec)
  }).join(",\n")

  return `/**
 * Form field configuration for ${spec.label}
 */
export const formConfig = {
${configs}
}`
}

function generateFieldConfig(field: Field, spec: ModuleSpec): string {
  const component = getComponentType(field)
  const label = toLabel(field.name)
  const placeholder = getPlaceholder(field)
  
  let config = `  ${field.name}: {
    component: "${component}",
    label: "${label}",
    placeholder: "${placeholder}",
    required: ${field.required || false}`
  
  // Add options for enum fields
  if (field.type === "enum" && field.values) {
    const options = field.values.map(v => {
      const label = v.split("_").map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(" ")
      return `      { value: "${v}", label: "${label}" }`
    }).join(",\n")
    
    config += `,
    options: [
${options}
    ]`
  }
  
  // Add reference configuration
  if (field.ref) {
    config += `,
    ref: "${field.ref}",
    // TODO: Add API endpoint for fetching options
    loadOptions: async (search: string) => {
      // Implement async loading for ${field.ref}
      return []
    }`
  }
  
  // Add input type for specific fields
  if (field.type === "number") {
    config += `,
    type: "number"`
  }
  
  if (field.validation === "email") {
    config += `,
    type: "email"`
  }
  
  if (field.validation === "url") {
    config += `,
    type: "url"`
  }
  
  // Add help text for certain fields
  if (field.search?.fts || field.search?.vector) {
    config += `,
    helpText: "This field is searchable"`
  }
  
  config += `
  }`
  
  return config
}

function getComponentType(field: Field): string {
  if (field.type === "text") return "textarea"
  if (field.type === "boolean") return "switch"
  if (field.type === "enum") return "select"
  if (field.type === "date") return "date-picker"
  if (field.type === "datetime") return "datetime-picker"
  if (field.ref) return "async-select"
  return "input"
}

function generateFormSchemas(spec: ModuleSpec): string {
  return `/**
 * Schema for create form
 */
export const createFormSchema = create${capitalize(spec.entity)}Schema

/**
 * Schema for edit form
 */
export const editFormSchema = update${capitalize(spec.entity)}Schema

/**
 * Get schema based on mode
 */
export function getFormSchema(mode: "create" | "edit") {
  return mode === "create" ? createFormSchema : editFormSchema
}

/**
 * Get fields based on mode
 */
export function getFormFields(mode: "create" | "edit"): string[] {
  return mode === "create" 
    ? ${JSON.stringify(spec.forms.create)}
    : ${JSON.stringify(spec.forms.edit)}
}`
}

function getPlaceholder(field: Field): string {
  const label = toLabel(field.name)
  
  if (field.type === "date" || field.type === "datetime") {
    return "Select date"
  }
  if (field.type === "enum") {
    return `Select ${label.toLowerCase()}`
  }
  if (field.type === "boolean") {
    return ""
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

