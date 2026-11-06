"use client"

import { useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useImportVault } from "@/lib/api/security-my-vault"

export function VaultImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [csv, setCsv] = useState("")
  const importVault = useImportVault()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCsv(await f.text())
    e.target.value = ""
  }

  const run = async () => {
    if (!csv.trim()) return
    try {
      const res = await importVault.mutateAsync(csv)
      toast.success(`Imported ${res.data.imported} item${res.data.imported === 1 ? "" : "s"}`)
      setCsv("")
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>
            Paste or upload a CSV export from Keeper, Bitwarden, LastPass or 1Password. Columns (folder, title, login,
            password, website, notes) are detected automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Upload className="h-4 w-4" /> Choose a .csv file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={8}
            placeholder={"Folder,Title,Login,Password,Website Address,Notes\n…"}
            className="font-mono text-xs"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!csv.trim() || importVault.isPending}>
            {importVault.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
