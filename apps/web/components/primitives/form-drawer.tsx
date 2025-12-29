"use client"

import * as React from "react"
import { useForm, FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Lock, RefreshCw } from "lucide-react"

/**
 * Sync indicator types for bidirectional sync
 */
export type SyncIndicatorType = "intune" | "entra" | "readonly" | "bidirectional"

/**
 * Field definition for forms (simplified format)
 */
export interface FormFieldDef {
  name: string
  label: string
  component: "input" | "textarea" | "select" | "async-select" | "switch" | "date" | "date-picker" | "datetime-picker"
  placeholder?: string
  required?: boolean
  helpText?: string
  type?: string // for input: text, email, password, number, tel, etc.
  options?: Array<{ value: string; label: string }>
  loadOptions?: (search: string) => Promise<Array<{ value: string; label: string }>>
  disabled?: boolean
  // Sync indicator - shows where data comes from or syncs to
  syncIndicator?: SyncIndicatorType
  // For bidirectional sync, the Entra field name this maps to (e.g., "officeLocation", "mobilePhone")
  entraFieldName?: string
}

/**
 * Field configuration (for config-based format)
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
  // Sync indicator - shows where data comes from or syncs to
  syncIndicator?: SyncIndicatorType
  // For bidirectional sync, the Entra field name this maps to (e.g., "officeLocation", "mobilePhone")
  entraFieldName?: string
}

export type FormConfig = Record<string, FieldConfig>

/**
 * FormDrawer props - supports two patterns:
 * 1. Simple: fields as array of FormFieldDef objects
 * 2. Config-based: fields as string[] with separate config object
 */
export interface FormDrawerProps<T = Record<string, unknown>> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  // Pattern 1: Simple - array of field definitions
  fields: FormFieldDef[] | string[]
  // Pattern 2: Config-based (optional)
  config?: FormConfig
  schema?: z.ZodType<FieldValues>
  defaultValues?: Record<string, unknown>
  mode?: "create" | "edit"
  onSubmit: (data: T) => Promise<void> | void
  submitLabel?: string
  isSubmitting?: boolean
  loading?: boolean // alias for isSubmitting
  // Disable specific fields (array of field names)
  disabledFields?: string[]
  // Disable all fields (e.g., for synced records)
  readOnly?: boolean
  // Info banner to show above form
  infoBanner?: React.ReactNode
  // Callback when a field value changes - can return new values to set on other fields
  onFieldChange?: (fieldName: string, value: unknown, setValue: (name: string, value: unknown) => void) => void
}

/**
 * Sheet/Drawer with form for create/edit operations
 */
export function FormDrawer<T = Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  description,
  fields,
  config,
  schema,
  defaultValues,
  mode = "create",
  onSubmit,
  submitLabel,
  isSubmitting = false,
  loading = false,
  disabledFields = [],
  readOnly = false,
  infoBanner,
  onFieldChange,
}: FormDrawerProps<T>) {
  const form = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: defaultValues || {},
  })

  // Watch all fields and trigger onFieldChange callback
  React.useEffect(() => {
    if (!onFieldChange) return

    const subscription = form.watch((formValues, { name }) => {
      if (name) {
        onFieldChange(name, formValues[name], (fieldName, value) => {
          form.setValue(fieldName, value)
        })
      }
    })
    return () => subscription.unsubscribe()
  }, [form, onFieldChange])

  const submitting = isSubmitting || loading

  // Determine the default submit label based on mode
  const defaultSubmitLabel = mode === "create" ? "Create" : "Save"

  // Normalize fields to FormFieldDef[]
  const normalizedFields: FormFieldDef[] = React.useMemo(() => {
    // Check if fields is an array of strings (config-based pattern)
    if (fields.length > 0 && typeof fields[0] === "string") {
      if (!config) {
        console.error("FormDrawer: config is required when fields is an array of strings")
        return []
      }
      return (fields as string[])
        .filter((fieldName) => {
          const fieldConfig = config[fieldName]
          return fieldConfig && !fieldConfig.hidden
        })
        .map((fieldName) => {
          const fieldConfig = config[fieldName]
          // Apply readOnly or check disabledFields array
          const isDisabled = readOnly || disabledFields.includes(fieldName) || fieldConfig.disabled
          return {
            name: fieldName,
            label: fieldConfig.label,
            component: fieldConfig.component === "date-picker" ? "date" : fieldConfig.component,
            placeholder: fieldConfig.placeholder,
            required: fieldConfig.required,
            helpText: fieldConfig.helpText,
            type: fieldConfig.type,
            options: fieldConfig.options,
            loadOptions: fieldConfig.loadOptions, // Include async loader
            disabled: isDisabled,
            syncIndicator: fieldConfig.syncIndicator,
          } as FormFieldDef
        })
    }
    // Already in FormFieldDef[] format - apply readOnly or disabledFields
    return (fields as FormFieldDef[]).map(field => ({
      ...field,
      disabled: readOnly || disabledFields.includes(field.name) || field.disabled,
    }))
  }, [fields, config, readOnly, disabledFields])

  // Reset form when drawer opens with new default values
  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues || {})
    }
  }, [open, defaultValues, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data as T)
  })

  const handleClose = () => {
    onOpenChange(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-[540px] w-full p-0 flex flex-col h-full">
        <SheetHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  {infoBanner && (
                    <div className="mb-4">
                      {infoBanner}
                    </div>
                  )}
                  <div className="space-y-4">
                    {normalizedFields.map((fieldDef) => (
                      <FormField
                        key={fieldDef.name}
                        control={form.control}
                        name={fieldDef.name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5">
                              {fieldDef.label}
                              {fieldDef.required && <span className="text-destructive">*</span>}
                              {fieldDef.syncIndicator && (
                                <SyncIndicator type={fieldDef.syncIndicator} entraFieldName={fieldDef.entraFieldName} />
                              )}
                            </FormLabel>
                            <FormControl>
                              {renderFormControl(field, fieldDef)}
                            </FormControl>
                            {fieldDef.helpText && (
                              <FormDescription>{fieldDef.helpText}</FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t bg-background px-6 py-4">
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitLabel || defaultSubmitLabel}
                </Button>
                <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Sync indicator component - shows visual cue for synced fields
 */
function SyncIndicator({ type, entraFieldName }: { type: SyncIndicatorType; entraFieldName?: string }) {
  // Build tooltip text based on type and optional field name
  const getTooltip = () => {
    switch (type) {
      case "intune":
        return entraFieldName 
          ? `Synced from Microsoft Intune: ${entraFieldName} (read-only)`
          : "Synced from Microsoft Intune (read-only)"
      case "entra":
        return entraFieldName
          ? `Synced from Microsoft Entra ID: ${entraFieldName} (read-only)`
          : "Synced from Microsoft Entra ID (read-only)"
      case "readonly":
        return "This field is managed by external sync"
      case "bidirectional":
        return entraFieldName
          ? `Syncs with Microsoft Entra ID: ${entraFieldName}`
          : "Changes will sync back to the source system"
    }
  }

  const config = {
    intune: {
      icon: Lock,
      className: "text-blue-500",
    },
    entra: {
      icon: Lock,
      className: "text-purple-500",
    },
    readonly: {
      icon: Lock,
      className: "text-muted-foreground",
    },
    bidirectional: {
      icon: RefreshCw,
      className: "text-green-500",
    },
  }

  const { icon: Icon, className } = config[type]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Icon className={`h-3.5 w-3.5 ${className}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          {getTooltip()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Async Select Field Component - loads options and renders a Select dropdown
 */
function AsyncSelectField({
  fieldDef,
  fieldProps,
}: {
  fieldDef: FormFieldDef
  fieldProps: { value: unknown; onChange: (value: unknown) => void; onBlur: () => void; name: string }
}) {
  const [options, setOptions] = React.useState<Array<{ value: string; label: string; sublabel?: string }>>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasLoaded, setHasLoaded] = React.useState(false)

  // Load options on mount
  React.useEffect(() => {
    if (!fieldDef.loadOptions || hasLoaded) return
    
    setIsLoading(true)
    fieldDef.loadOptions("")
      .then((opts) => {
        setOptions(opts)
        setHasLoaded(true)
      })
      .catch((err) => {
        console.error("Failed to load options:", err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [fieldDef.loadOptions, hasLoaded])

  const currentValue = fieldProps.value as string | undefined

  return (
    <Select
      value={currentValue || ""}
      onValueChange={(value) => fieldProps.onChange(value || null)}
      disabled={fieldDef.disabled || isLoading}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={isLoading ? "Loading..." : fieldDef.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 && !isLoading ? (
          <SelectItem value="__none__" disabled>
            No options available
          </SelectItem>
        ) : (
          options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex flex-col items-start">
                <span>{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

/**
 * Render form control based on field definition
 */
function renderFormControl(
  field: { value: unknown; onChange: (value: unknown) => void; onBlur: () => void; name: string; ref: React.Ref<unknown> },
  fieldDef: FormFieldDef
): React.ReactNode {
  // Destructure to exclude ref for components that don't accept it
  const { ref: _ref, ...fieldProps } = field
  
  switch (fieldDef.component) {
    case "input":
      return (
        <Input
          type={fieldDef.type || "text"}
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          name={fieldProps.name}
          value={(fieldProps.value as string) || ""}
          onChange={(e) => fieldProps.onChange(e.target.value)}
          onBlur={fieldProps.onBlur}
        />
      )

    case "textarea":
      return (
        <Textarea
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          rows={4}
          name={fieldProps.name}
          value={(fieldProps.value as string) || ""}
          onChange={(e) => fieldProps.onChange(e.target.value)}
          onBlur={fieldProps.onBlur}
        />
      )

    case "select":
      return (
        <Select
          onValueChange={field.onChange}
          value={(field.value as string) || ""}
          disabled={fieldDef.disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={fieldDef.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {fieldDef.options?.map((option) => (
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
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            disabled={fieldDef.disabled}
          />
          <span className="text-sm text-muted-foreground">
            {field.value ? "Enabled" : "Disabled"}
          </span>
        </div>
      )

    case "date":
    case "date-picker":
      return (
        <Input
          type="date"
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          name={fieldProps.name}
          value={(fieldProps.value as string) || ""}
          onChange={(e) => fieldProps.onChange(e.target.value)}
          onBlur={fieldProps.onBlur}
        />
      )

    case "datetime-picker":
      return (
        <Input
          type="datetime-local"
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          name={fieldProps.name}
          value={(fieldProps.value as string) || ""}
          onChange={(e) => fieldProps.onChange(e.target.value)}
          onBlur={fieldProps.onBlur}
        />
      )

    case "async-select":
      return (
        <AsyncSelectField
          fieldDef={fieldDef}
          fieldProps={fieldProps}
        />
      )

    default:
      return (
        <Input
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          name={fieldProps.name}
          value={(fieldProps.value as string) || ""}
          onChange={(e) => fieldProps.onChange(e.target.value)}
          onBlur={fieldProps.onBlur}
        />
      )
  }
}
