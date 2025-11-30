import { z } from "zod"

/**
 * Field type definitions
 */
export const FieldTypeSchema = z.enum([
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "enum",
  "uuid",
  "json",
])

export type FieldType = z.infer<typeof FieldTypeSchema>

/**
 * Search configuration for a field
 */
export const SearchConfigSchema = z.object({
  fts: z.boolean().optional().describe("Enable full-text search"),
  vector: z.boolean().optional().describe("Enable vector search"),
})

export type SearchConfig = z.infer<typeof SearchConfigSchema>

/**
 * Validation rules
 */
export const ValidationSchema = z.union([
  z.literal("email"),
  z.literal("url"),
  z.literal("phone"),
  z.string().regex(/^min:\d+$/), // min:3
  z.string().regex(/^max:\d+$/), // max:255
  z.string().regex(/^regex:.+$/), // regex:pattern
])

export type Validation = z.infer<typeof ValidationSchema>

/**
 * Field definition in a spec
 */
export const FieldSchema = z.object({
  name: z.string().describe("Field name (snake_case)"),
  type: FieldTypeSchema.describe("Field data type"),
  required: z.boolean().optional().describe("Is this field required?"),
  default: z.any().optional().describe("Default value"),
  validation: ValidationSchema.optional().describe("Validation rule"),
  ref: z.string().optional().describe("Reference to another entity (namespace.entity)"),
  values: z.array(z.string()).optional().describe("Allowed values for enum type"),
  search: SearchConfigSchema.optional().describe("Search configuration"),
  computed: z.boolean().optional().describe("Is this a computed field?"),
  expr: z.string().optional().describe("SQL expression or function name for computed field"),
})

export type Field = z.infer<typeof FieldSchema>

/**
 * Sort direction
 */
export const SortDirectionSchema = z.enum(["asc", "desc"])

export type SortDirection = z.infer<typeof SortDirectionSchema>

/**
 * Table configuration
 */
export const TableConfigSchema = z.object({
  columns: z.array(z.string()).describe("Fields to display as columns"),
  defaultSort: z.tuple([z.string(), SortDirectionSchema]).describe("Default sort [field, direction]"),
  filters: z.array(z.string()).describe("Fields to enable filtering on"),
})

export type TableConfig = z.infer<typeof TableConfigSchema>

/**
 * Form configuration
 */
export const FormConfigSchema = z.object({
  create: z.array(z.string()).describe("Fields in create form"),
  edit: z.array(z.string()).describe("Fields in edit form"),
})

export type FormConfig = z.infer<typeof FormConfigSchema>

/**
 * Routing configuration
 */
export const RoutingSchema = z.object({
  list: z.string().describe("List page route"),
  detail: z.string().describe("Detail page route with [id] parameter"),
})

export type Routing = z.infer<typeof RoutingSchema>

/**
 * Permission configuration
 */
export const PermissionsSchema = z.object({
  read: z.array(z.string()).describe("Roles that can read this entity"),
  write: z.array(z.string()).describe("Roles that can write to this entity"),
  scope: z.string().describe("Scoping field (usually org_id)"),
})

export type Permissions = z.infer<typeof PermissionsSchema>

/**
 * Complete module specification
 */
export const ModuleSpecSchema = z.object({
  entity: z.string().describe("Entity name (singular, lowercase, snake_case)"),
  namespace: z.string().describe("Module namespace (e.g., 'people', 'security.isms')"),
  label: z.string().describe("Human-readable label (singular)"),
  id: z.string().describe("Primary key field name"),
  routing: RoutingSchema.describe("Route configuration"),
  permissions: PermissionsSchema.describe("Permission configuration"),
  fields: z.array(FieldSchema).min(1).describe("Field definitions"),
  table: TableConfigSchema.describe("Table display configuration"),
  forms: FormConfigSchema.describe("Form configuration"),
  events: z.array(z.string()).optional().describe("Event names for audit log"),
})

export type ModuleSpec = z.infer<typeof ModuleSpecSchema>

/**
 * Validate a spec.json file
 */
export function validateSpec(spec: unknown): ModuleSpec {
  return ModuleSpecSchema.parse(spec)
}

/**
 * Validate with detailed error messages
 */
export function validateSpecSafe(spec: unknown): {
  success: boolean
  data?: ModuleSpec
  errors?: string[]
} {
  const result = ModuleSpecSchema.safeParse(spec)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(
    (err) => `${err.path.join(".")}: ${err.message}`
  )
  
  return { success: false, errors }
}

/**
 * Helper to get field by name
 */
export function getField(spec: ModuleSpec, fieldName: string): Field | undefined {
  return spec.fields.find((f) => f.name === fieldName)
}

/**
 * Helper to get required fields
 */
export function getRequiredFields(spec: ModuleSpec): Field[] {
  return spec.fields.filter((f) => f.required === true)
}

/**
 * Helper to get computed fields
 */
export function getComputedFields(spec: ModuleSpec): Field[] {
  return spec.fields.filter((f) => f.computed === true)
}

/**
 * Helper to get editable fields (non-computed)
 */
export function getEditableFields(spec: ModuleSpec): Field[] {
  return spec.fields.filter((f) => !f.computed)
}

/**
 * Helper to get searchable fields
 */
export function getSearchableFields(spec: ModuleSpec): Field[] {
  return spec.fields.filter((f) => f.search?.fts || f.search?.vector)
}

/**
 * Helper to get enum fields
 */
export function getEnumFields(spec: ModuleSpec): Field[] {
  return spec.fields.filter((f) => f.type === "enum")
}

/**
 * Helper to get reference fields
 */
export function getReferenceFields(spec: ModuleSpec): Field[] {
  return spec.fields.filter((f) => f.ref !== undefined)
}

/**
 * Helper to parse namespace into parts
 */
export function parseNamespace(namespace: string): string[] {
  return namespace.split(".")
}

/**
 * Helper to build output path for generated files
 */
export function getOutputPath(spec: ModuleSpec, filename: string): string {
  const namespaceParts = parseNamespace(spec.namespace)
  const path = [...namespaceParts, spec.entity].join("/")
  return `apps/web/lib/generated/${path}/${filename}`
}

