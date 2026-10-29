"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Library, Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useInstallTrainingLibrary, useTrainingLibrary } from "@/lib/api/security-training"
import { trainingCategoryLabels } from "@/lib/security/training"

interface TrainingLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Lets an admin install ready-made security awareness courses into their organization
 */
export function TrainingLibraryDialog({ open, onOpenChange }: TrainingLibraryDialogProps) {
  const { data, isLoading } = useTrainingLibrary()
  const install = useInstallTrainingLibrary()
  const library = data?.data ?? []
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Preselect everything not yet installed whenever the dialog opens
  useEffect(() => {
    if (open) {
      setSelected(new Set(library.filter((c) => !c.installed).map((c) => c.key)))
    }
  }, [open, data]) // eslint-disable-line react-hooks/exhaustive-deps -- reset only on open/data change

  const toggle = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleInstall = async () => {
    try {
      const result = await install.mutateAsync(Array.from(selected))
      const count = result.data.installed.length
      toast.success(`Installed ${count} course${count === 1 ? "" : "s"}. They are published and ready to assign.`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to install starter courses")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Starter Courses
          </DialogTitle>
          <DialogDescription>
            Ready-made courses, each with a narrated animated lesson and 10 quiz questions.
            Installed courses are published immediately. You can edit them afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          {library.map((course) => (
            <label
              key={course.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 has-[:disabled]:cursor-default has-[:disabled]:opacity-70"
            >
              <Checkbox
                checked={course.installed || selected.has(course.key)}
                disabled={course.installed}
                onCheckedChange={(checked) => toggle(course.key, checked === true)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{course.title}</span>
                  <Badge variant="outline">{trainingCategoryLabels[course.category]}</Badge>
                  {course.installed && (
                    <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Installed
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={selected.size === 0 || install.isPending}>
            {install.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Install {selected.size > 0 ? selected.size : ""} Course{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
