"use client"

import * as React from "react"
import { UseFormReturn, FieldValues, Path } from "react-hook-form"
import { z } from "zod"

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

/**
 * Field configuration for form rendering
 */
export interface FieldConfig {
  component: "input" | "textarea" | "select" | "async-select" | "switch" | "date-picker" | "datetime-picker"
  label: string
  placeholder?: string
  required?: boolean
  helpText?: string
  type?: string
  options?: Array<{ value: string; label: string }>
  loadOptions?: (search: string) => Promise<Array<{ value: string; label: string }>>
  ref?: string
  disabled?: boolean
  hidden?: boolean
}

/**
 * Form configuration map
 */
export type FormConfig = Record<string, FieldConfig>

/**
 * FormBuilder props
 */
export interface FormBuilderProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>
  config: FormConfig
  fields: string[]
  mode?: "create" | "edit" | "readonly"
  onSubmit: (data: TFieldValues) => void | Promise<void>
  submitLabel?: string
  cancelLabel?: string
  onCancel?: () => void
  loading?: boolean
  className?: string
}

/**
 * Schema-driven form builder component
 */
export function FormBuilder<TFieldValues extends FieldValues>({
  form,
  config,
  fields,
  mode = "create",
  onSubmit,
  submitLabel,
  cancelLabel = "Cancel",
  onCancel,
  loading = false,
  className,
}: FormBuilderProps<TFieldValues>) {
  const isReadonly = mode === "readonly"
  const defaultSubmitLabel = mode === "create" ? "Create" : mode === "edit" ? "Save" : "Close"
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={className}>
        <div className="space-y-4">
          {fields.map((fieldName) => {
            const fieldConfig = config[fieldName]
            if (!fieldConfig || fieldConfig.hidden) return null
            
            return (
              <FormField
                key={fieldName}
                control={form.control}
                name={fieldName as Path<TFieldValues>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {fieldConfig.label}
                      {fieldConfig.required && !isReadonly && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      {renderField(field, fieldConfig, isReadonly)}
                    </FormControl>
                    {fieldConfig.helpText && !isReadonly && (
                      <FormDescription>{fieldConfig.helpText}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )
          })}
        </div>
        
        {!isReadonly && (
          <div className="flex items-center gap-2 mt-6">
            <Button type="submit" disabled={loading || isReadonly}>
              {loading ? "Saving..." : (submitLabel || defaultSubmitLabel)}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                {cancelLabel}
              </Button>
            )}
          </div>
        )}
      </form>
    </Form>
  )
}

/**
 * Render field based on configuration
 */
function renderField(
  field: any,
  config: FieldConfig,
  readonly: boolean
): React.ReactNode {
  const commonProps = {
    disabled: readonly || config.disabled,
    ...field,
  }
  
  // Readonly mode - display value as text
  if (readonly) {
    return <div className="text-sm py-2">{formatValue(field.value, config)}</div>
  }
  
  switch (config.component) {
    case "input":
      return (
        <Input
          type={config.type || "text"}
          placeholder={config.placeholder}
          {...commonProps}
        />
      )
    
    case "textarea":
      return (
        <Textarea
          placeholder={config.placeholder}
          rows={4}
          {...commonProps}
        />
      )
    
    case "select":
      return (
        <Select
          onValueChange={field.onChange}
          defaultValue={field.value}
          disabled={commonProps.disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={config.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {config.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    
    case "switch":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={commonProps.disabled}
          />
          <span className="text-sm text-muted-foreground">
            {field.value ? "Enabled" : "Disabled"}
          </span>
        </div>
      )
    
    case "async-select":
      // TODO: Implement async select with search
      return (
        <Input
          placeholder={config.placeholder || "Search..."}
          {...commonProps}
        />
      )
    
    case "date-picker":
      // TODO: Implement date picker
      return (
        <Input
          type="date"
          placeholder={config.placeholder}
          {...commonProps}
        />
      )
    
    case "datetime-picker":
      // TODO: Implement datetime picker
      return (
        <Input
          type="datetime-local"
          placeholder={config.placeholder}
          {...commonProps}
        />
      )
    
    default:
      return (
        <Input
          placeholder={config.placeholder}
          {...commonProps}
        />
      )
  }
}

/**
 * Format value for readonly display
 */
function formatValue(value: any, config: FieldConfig): string {
  if (value === null || value === undefined) {
    return "—"
  }
  
  if (config.component === "switch") {
    return value ? "Yes" : "No"
  }
  
  if (config.component === "select" && config.options) {
    const option = config.options.find((o) => o.value === value)
    return option?.label || String(value)
  }
  
  if (config.component === "date-picker" || config.component === "datetime-picker") {
    try {
      const date = new Date(value)
      return config.component === "date-picker"
        ? date.toLocaleDateString()
        : date.toLocaleString()
    } catch {
      return String(value)
    }
  }
  
  return String(value)
}

