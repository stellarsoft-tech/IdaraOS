"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { 
  ArrowLeft, 
  Shield, 
  Plus, 
  Trash2, 
  Search,
  Filter,
  CheckCircle,
  Link2,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  useSecurityControl, 
  useStandardControls,
  useAddControlMapping,
  useRemoveControlMapping,
  type StandardControl,
  type ControlMapping,
} from "@/lib/api/security"
import { toast } from "sonner"

const frameworkLabels: Record<string, string> = {
  "iso-27001": "ISO 27001",
  "soc-2": "SOC 2",
}

function MappingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  )
}

function StandardControlCard({ 
  control, 
  isSelected,
  onSelect 
}: { 
  control: StandardControl
  isSelected: boolean
  onSelect: (control: StandardControl) => void
}) {
  return (
    <div 
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        isSelected 
          ? "border-primary bg-primary/5" 
          : "hover:bg-muted/50"
      }`}
      onClick={() => onSelect(control)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold">{control.controlId}</span>
            <Badge variant="outline" className="text-xs">
              {frameworkLabels[control.frameworkCode] || control.frameworkCode}
            </Badge>
          </div>
          <p className="font-medium text-sm">{control.title}</p>
          {control.category && (
            <p className="text-xs text-muted-foreground mt-1">{control.category}</p>
          )}
        </div>
        {isSelected && (
          <CheckCircle className="h-5 w-5 text-primary" />
        )}
      </div>
    </div>
  )
}

function MappingRow({ 
  mapping, 
  onRemove,
  isRemoving,
}: { 
  mapping: ControlMapping
  onRemove: () => void
  isRemoving: boolean
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-semibold">{mapping.standardControl?.controlId}</span>
            <Badge variant="outline" className="text-xs">
              {frameworkLabels[mapping.standardControl?.frameworkCode || ""] || mapping.standardControl?.frameworkCode}
            </Badge>
            {mapping.coverageLevel && (
              <Badge variant={mapping.coverageLevel === "full" ? "default" : "secondary"}>
                {mapping.coverageLevel}
              </Badge>
            )}
          </div>
          <p className="text-sm">{mapping.standardControl?.title}</p>
          {mapping.notes && (
            <p className="text-xs text-muted-foreground mt-1">{mapping.notes}</p>
          )}
        </div>
      </div>
      <Protected module="security.controls" action="edit">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRemove}
          disabled={isRemoving}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </Protected>
    </div>
  )
}

export default function ControlMappingsPage() {
  const params = useParams()
  const id = params.id as string
  
  const { data: controlData, isLoading: controlLoading } = useSecurityControl(id)
  const { data: standardControlsData, isLoading: standardControlsLoading } = useStandardControls()
  const addMapping = useAddControlMapping()
  const removeMapping = useRemoveControlMapping()
  
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState<string | null>(null)
  const [selectedStandardControl, setSelectedStandardControl] = useState<StandardControl | null>(null)
  const [coverageLevel, setCoverageLevel] = useState<string>("full")
  const [notes, setNotes] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all")
  
  const control = controlData?.data
  const mappings = control?.mappings || []
  const standardControls = standardControlsData?.data || []
  
  const isLoading = controlLoading || standardControlsLoading
  
  // Get mapped standard control IDs
  const mappedStandardControlIds = useMemo(() => 
    new Set(mappings.map(m => m.standardControlId)),
    [mappings]
  )
  
  // Filter available standard controls (not already mapped)
  const availableControls = useMemo(() => {
    return standardControls.filter(sc => {
      // Exclude already mapped
      if (mappedStandardControlIds.has(sc.id)) return false
      
      // Apply framework filter
      if (frameworkFilter !== "all" && sc.frameworkCode !== frameworkFilter) return false
      
      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          sc.controlId.toLowerCase().includes(query) ||
          sc.title.toLowerCase().includes(query) ||
          sc.category?.toLowerCase().includes(query) ||
          sc.description?.toLowerCase().includes(query)
        )
      }
      
      return true
    })
  }, [standardControls, mappedStandardControlIds, frameworkFilter, searchQuery])
  
  // Get unique frameworks from standard controls
  const frameworks = useMemo(() => {
    const unique = new Set(standardControls.map(sc => sc.frameworkCode))
    return Array.from(unique)
  }, [standardControls])
  
  const handleAddMapping = async () => {
    if (!selectedStandardControl) return
    
    try {
      await addMapping.mutateAsync({
        controlId: id,
        standardControlId: selectedStandardControl.id,
        coverageLevel,
        notes: notes || undefined,
      })
      toast.success(`Mapped to ${selectedStandardControl.controlId}`)
      setAddDialogOpen(false)
      setSelectedStandardControl(null)
      setCoverageLevel("full")
      setNotes("")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add mapping"
      toast.error(message)
    }
  }
  
  const handleRemoveMapping = async (mappingId: string) => {
    try {
      await removeMapping.mutateAsync({
        controlId: id,
        mappingId,
      })
      toast.success("Mapping removed")
      setRemoveDialogOpen(null)
    } catch {
      toast.error("Failed to remove mapping")
    }
  }
  
  if (isLoading) {
    return (
      <PageShell title="Control Mappings" description="Loading...">
        <MappingSkeleton />
      </PageShell>
    )
  }
  
  if (!control) {
    return (
      <PageShell title="Control Not Found" description="">
        <Card className="py-12">
          <CardContent className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Control not found</h3>
            <Button asChild>
              <Link href="/security/controls">Back to Controls</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title={`${control.controlId} - Framework Mappings`}
      description={`Map "${control.title}" to standard framework controls`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/security/controls/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Control
            </Link>
          </Button>
          <Protected module="security.controls" action="edit">
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Mapping
            </Button>
          </Protected>
        </div>
      }
    >
      {/* Current Mappings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Current Mappings
              </CardTitle>
              <CardDescription>
                This control satisfies {mappings.length} standard control{mappings.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mappings.length > 0 ? (
            <div className="space-y-3">
              {mappings.map(mapping => (
                <MappingRow
                  key={mapping.id}
                  mapping={mapping}
                  onRemove={() => setRemoveDialogOpen(mapping.id)}
                  isRemoving={removeMapping.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-4">
                No framework mappings yet
              </p>
              <Protected module="security.controls" action="edit">
                <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Mapping
                </Button>
              </Protected>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Framework Coverage Summary */}
      {mappings.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Framework Coverage</CardTitle>
            <CardDescription>
              Summary of which frameworks this control covers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(
                mappings.reduce((acc, m) => {
                  const fw = m.standardControl?.frameworkCode || "unknown"
                  if (!acc[fw]) acc[fw] = []
                  acc[fw].push(m)
                  return acc
                }, {} as Record<string, ControlMapping[]>)
              ).map(([fw, fwMappings]) => (
                <Card key={fw} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {frameworkLabels[fw] || fw}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {fwMappings.length} control{fwMappings.length !== 1 ? "s" : ""} mapped
                        </p>
                      </div>
                      <Badge variant="secondary">{fwMappings.length}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Mapping Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Framework Mapping</DialogTitle>
            <DialogDescription>
              Select a standard control that {control.controlId} satisfies
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-3 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search controls..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frameworks</SelectItem>
                {frameworks.map(fw => (
                  <SelectItem key={fw} value={fw}>
                    {frameworkLabels[fw] || fw}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-auto border rounded-md p-2 space-y-2 min-h-[200px] max-h-[300px]">
            {availableControls.length > 0 ? (
              availableControls.slice(0, 50).map(sc => (
                <StandardControlCard
                  key={sc.id}
                  control={sc}
                  isSelected={selectedStandardControl?.id === sc.id}
                  onSelect={setSelectedStandardControl}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || frameworkFilter !== "all" 
                  ? "No matching controls found" 
                  : "All controls are already mapped"}
              </div>
            )}
            {availableControls.length > 50 && (
              <p className="text-xs text-center text-muted-foreground py-2">
                Showing 50 of {availableControls.length} controls. Use search to narrow down.
              </p>
            )}
          </div>

          {selectedStandardControl && (
            <div className="space-y-4 pt-4 border-t">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium">Selected: {selectedStandardControl.controlId}</p>
                <p className="text-xs text-muted-foreground">{selectedStandardControl.title}</p>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Coverage Level</Label>
                  <Select value={coverageLevel} onValueChange={setCoverageLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Coverage</SelectItem>
                      <SelectItem value="partial">Partial Coverage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Add notes about this mapping..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddMapping} 
              disabled={!selectedStandardControl || addMapping.isPending}
            >
              {addMapping.isPending ? "Adding..." : "Add Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Mapping Confirmation */}
      <AlertDialog open={!!removeDialogOpen} onOpenChange={() => setRemoveDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this mapping? The standard control will no longer be associated with {control.controlId}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeDialogOpen && handleRemoveMapping(removeDialogOpen)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}

