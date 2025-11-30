import fs from "fs/promises"
import path from "path"
import type { ModuleSpec, Field } from "../../specs/spec.schema.js"

/**
 * Generate TanStack Table column definitions from spec
 */
export async function generateColumns(spec: ModuleSpec, outputPath: string): Promise<void> {
  const content = `// Generated from spec.json - DO NOT EDIT MANUALLY
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { format } from "date-fns"
import type { ${capitalize(spec.entity)} } from "./types"

${generateColumnDefinitions(spec)}

${generateStatusVariants(spec)}
`

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, content, "utf-8")
  console.log(`✓ Generated columns: ${outputPath}`)
}

function generateColumnDefinitions(spec: ModuleSpec): string {
  const columns = spec.table.columns
    .map((fieldName) => {
      const field = spec.fields.find((f) => f.name === fieldName)
      if (!field) {
        throw new Error(`Field "${fieldName}" not found in spec`)
      }
      return generateColumn(field, spec)
    })
    .join(",\n")

  return `export const columns: ColumnDef<${capitalize(spec.entity)}>[] = [
${columns}
]`
}

function generateColumn(field: Field, spec: ModuleSpec): string {
  const accessor = `  {
    accessorKey: "${field.name}",
    header: "${toLabel(field.name)}",`
  
  const cell = generateCellRenderer(field, spec)
  const filterFn = generateFilterFn(field, spec)
  
  return `${accessor}
    ${cell}${filterFn}
  }`
}

function generateCellRenderer(field: Field, spec: ModuleSpec): string {
  // Special renderer for name fields with avatar
  if (field.name === "name" || field.name.includes("_name")) {
    return `cell: ({ row }) => {
      const value = row.getValue("${field.name}") as string
      const initials = value
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
      
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{value}</span>
        </div>
      )
    },`
  }
  
  // Status badge for enum fields
  if (field.type === "enum") {
    return `cell: ({ row }) => {
      const value = row.getValue("${field.name}") as string
      return (
        <StatusBadge variant={${spec.entity}StatusVariants[value] || "default"}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </StatusBadge>
      )
    },`
  }
  
  // Date formatting
  if (field.type === "date" || field.type === "datetime") {
    return `cell: ({ row }) => {
      const value = row.getValue("${field.name}") as string
      if (!value) return null
      return format(new Date(value), "${field.type === "date" ? "MMM d, yyyy" : "MMM d, yyyy HH:mm"}")
    },`
  }
  
  // Reference fields (show linked entity name)
  if (field.ref) {
    return `cell: ({ row }) => {
      const value = row.getValue("${field.name}") as string
      // TODO: Fetch and display referenced entity name
      return <span className="text-muted-foreground">{value}</span>
    },`
  }
  
  // Boolean fields
  if (field.type === "boolean") {
    return `cell: ({ row }) => {
      const value = row.getValue("${field.name}") as boolean
      return value ? "✓" : "✗"
    },`
  }
  
  // Computed or numeric fields
  if (field.computed || field.type === "number") {
    return `cell: ({ row }) => {
      const value = row.getValue("${field.name}")
      return <span className="font-mono">{value}</span>
    },`
  }
  
  // Default: plain text
  return `cell: ({ row }) => row.getValue("${field.name}"),`
}

function generateFilterFn(field: Field, spec: ModuleSpec): string {
  // Add filter function for filterable columns
  if (spec.table.filters.includes(field.name)) {
    if (field.type === "enum") {
      return `,
    filterFn: (row, id, value) => {
      if (!value || value.length === 0) return true
      return value.includes(row.getValue(id))
    }`
    }
    
    return `,
    filterFn: (row, id, value) => {
      if (!value) return true
      return String(row.getValue(id))
        .toLowerCase()
        .includes(String(value).toLowerCase())
    }`
  }
  
  return ""
}

function generateStatusVariants(spec: ModuleSpec): string {
  const enumFields = spec.fields.filter((f) => f.type === "enum")
  
  if (enumFields.length === 0) {
    return ""
  }
  
  // Generate variant mappings for each enum field
  const variants = enumFields.map((field) => {
    const mappings = field.values!.map((value) => {
      const variant = getVariantForValue(value)
      return `  "${value}": "${variant}"`
    }).join(",\n")
    
    return `const ${spec.entity}${capitalize(field.name)}Variants: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
${mappings}
}`
  }).join("\n\n")
  
  // Create a general status variants export (use the first enum, typically "status")
  const statusField = enumFields.find((f) => f.name === "status") || enumFields[0]
  
  return `${variants}

/**
 * Default status variants for ${spec.label}
 */
export const ${spec.entity}StatusVariants = ${spec.entity}${capitalize(statusField.name)}Variants`
}

function getVariantForValue(value: string): string {
  const lower = value.toLowerCase()
  
  // Success states
  if (["active", "completed", "closed", "approved", "success", "done"].includes(lower)) {
    return "success"
  }
  
  // Warning states
  if (["pending", "onboarding", "offboarding", "warning", "review"].includes(lower)) {
    return "warning"
  }
  
  // Info states
  if (["mitigating", "in_progress", "processing", "info", "accepted"].includes(lower)) {
    return "info"
  }
  
  // Danger states
  if (["inactive", "rejected", "failed", "critical", "high", "open", "error"].includes(lower)) {
    return "danger"
  }
  
  // Medium priority/risk
  if (["medium"].includes(lower)) {
    return "warning"
  }
  
  // Low priority/risk
  if (["low"].includes(lower)) {
    return "success"
  }
  
  return "default"
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

