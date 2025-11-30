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
import { Loader2 } from "lucide-react"

/**
 * Field definition for forms (simplified format)
 */
export interface FormFieldDef {
  name: string
  label: string
  component: "input" | "textarea" | "select" | "switch" | "date" | "date-picker" | "datetime-picker"
  placeholder?: string
  required?: boolean
  helpText?: string
  type?: string // for input: text, email, password, number, tel, etc.
  options?: Array<{ value: string; label: string }>
  disabled?: boolean
}

/**
 * Field configuration (for config-based format)
 */
export interface FieldConfig {
  component: "input" | "textarea" | "select" | "switch" | "date-picker" | "datetime-picker"
  label: string
  placeholder?: string
  required?: boolean
  helpText?: string
  type?: string
  options?: Array<{ value: string; label: string }>
  disabled?: boolean
  hidden?: boolean
}

export type FormConfig = Record<string, FieldConfig>

/**
 * FormDrawer props - supports two patterns:
 * 1. Simple: fields as array of FormFieldDef objects
 * 2. Config-based: fields as string[] with separate config object
 */
export interface FormDrawerProps {
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
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
  submitLabel?: string
  isSubmitting?: boolean
  loading?: boolean // alias for isSubmitting
}

/**
 * Sheet/Drawer with form for create/edit operations
 */
export function FormDrawer({
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
}: FormDrawerProps) {
  const form = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: defaultValues || {},
  })

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
          return {
            name: fieldName,
            label: fieldConfig.label,
            component: fieldConfig.component === "date-picker" ? "date" : fieldConfig.component,
            placeholder: fieldConfig.placeholder,
            required: fieldConfig.required,
            helpText: fieldConfig.helpText,
            type: fieldConfig.type,
            options: fieldConfig.options,
            disabled: fieldConfig.disabled,
          } as FormFieldDef
        })
    }
    // Already in FormFieldDef[] format
    return fields as FormFieldDef[]
  }, [fields, config])

  // Reset form when drawer opens with new default values
  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues || {})
    }
  }, [open, defaultValues, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data)
  })

  const handleClose = () => {
    onOpenChange(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-[540px] w-full p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4 pb-6">
              {normalizedFields.map((fieldDef) => (
                <FormField
                  key={fieldDef.name}
                  control={form.control}
                  name={fieldDef.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {fieldDef.label}
                        {fieldDef.required && <span className="text-destructive ml-1">*</span>}
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

              <div className="flex items-center gap-2 pt-4">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitLabel || defaultSubmitLabel}
                </Button>
                <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Render form control based on field definition
 */
function renderFormControl(
  field: { value: unknown; onChange: (value: unknown) => void; onBlur: () => void; name: string; ref: React.Ref<unknown> },
  fieldDef: FormFieldDef
): React.ReactNode {
  switch (fieldDef.component) {
    case "input":
      return (
        <Input
          type={fieldDef.type || "text"}
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          {...field}
          value={(field.value as string) || ""}
        />
      )

    case "textarea":
      return (
        <Textarea
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          rows={4}
          {...field}
          value={(field.value as string) || ""}
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
          {...field}
          value={(field.value as string) || ""}
        />
      )

    case "datetime-picker":
      return (
        <Input
          type="datetime-local"
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          {...field}
          value={(field.value as string) || ""}
        />
      )

    default:
      return (
        <Input
          placeholder={fieldDef.placeholder}
          disabled={fieldDef.disabled}
          {...field}
          value={(field.value as string) || ""}
        />
      )
  }
}
