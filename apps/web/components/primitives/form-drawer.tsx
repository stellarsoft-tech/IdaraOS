"use client"

import * as React from "react"
import { useForm, FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { FormBuilder, FormConfig } from "./form-builder"
import { ScrollArea } from "@/components/ui/scroll-area"

/**
 * FormDrawer props
 */
export interface FormDrawerProps<TFieldValues extends FieldValues> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  schema: z.ZodType<TFieldValues>
  config: FormConfig
  fields: string[]
  defaultValues?: Partial<TFieldValues>
  mode?: "create" | "edit"
  onSubmit: (data: TFieldValues) => Promise<void> | void
  submitLabel?: string
  loading?: boolean
}

/**
 * Sheet/Drawer with FormBuilder for create/edit operations
 */
export function FormDrawer<TFieldValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  config,
  fields,
  defaultValues,
  mode = "create",
  onSubmit,
  submitLabel,
  loading = false,
}: FormDrawerProps<TFieldValues>) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  const form = useForm<TFieldValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
  })
  
  // Reset form when drawer opens with new default values
  React.useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues as any)
    }
  }, [open, defaultValues, form])
  
  const handleSubmit = async (data: TFieldValues) => {
    try {
      setIsSubmitting(true)
      await onSubmit(data)
      
      toast.success(
        mode === "create" 
          ? `${title} created successfully` 
          : `${title} updated successfully`
      )
      
      // Close drawer and reset form
      onOpenChange(false)
      form.reset()
    } catch (error) {
      toast.error(
        error instanceof Error 
          ? error.message 
          : `Failed to ${mode === "create" ? "create" : "update"} ${title.toLowerCase()}`
      )
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleCancel = () => {
    if (form.formState.isDirty) {
      const confirmClose = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      )
      if (!confirmClose) return
    }
    onOpenChange(false)
    form.reset()
  }
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] w-full p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        
        <ScrollArea className="flex-1 px-6">
          <FormBuilder
            form={form}
            config={config}
            fields={fields}
            mode={mode}
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
            onCancel={handleCancel}
            loading={loading || isSubmitting}
            className="pb-6"
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

