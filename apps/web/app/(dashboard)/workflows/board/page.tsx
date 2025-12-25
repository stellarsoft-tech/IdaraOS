"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { 
  LayoutGrid,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AccessDenied } from "@/components/primitives/protected"
import { useCanAccess } from "@/lib/rbac/context"
import { WorkflowKanban } from "@/components/workflows"
import { 
  useWorkflowInstancesList,
  useWorkflowInstanceDetail,
  useUpdateWorkflowStep,
} from "@/lib/api/workflows"
import { toast } from "sonner"

export default function WorkflowBoardPage() {
  const canAccess = useCanAccess("workflows.board")
  
  // State
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("")
  
  // Fetch active instances
  const { data: instances = [], isLoading: instancesLoading } = useWorkflowInstancesList({
    status: "in_progress,pending",
  })
  
  // Fetch selected instance detail
  const { data: instanceDetail, isLoading: detailLoading } = useWorkflowInstanceDetail(
    selectedInstanceId || ""
  )
  
  const updateStepMutation = useUpdateWorkflowStep()
  
  // Auto-select first instance
  useMemo(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id)
    }
  }, [instances, selectedInstanceId])
  
  const handleCompleteStep = async (stepId: string) => {
    try {
      await updateStepMutation.mutateAsync({
        id: stepId,
        data: { status: "completed" },
      })
      toast.success("Step completed")
    } catch {
      toast.error("Failed to complete step")
    }
  }
  
  const handleStartStep = async (stepId: string) => {
    try {
      await updateStepMutation.mutateAsync({
        id: stepId,
        data: { status: "in_progress" },
      })
      toast.success("Step started")
    } catch {
      toast.error("Failed to start step")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Board">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view the workflow board." 
        />
      </PageShell>
    )
  }
  
  const isLoading = instancesLoading || (selectedInstanceId && detailLoading)
  
  return (
    <PageShell
      title="Workflow Board"
      description="Kanban board view for managing workflow tasks."
    >
      <div className="space-y-6">
        {/* Instance Selector */}
        <div className="flex items-center gap-4">
          <Select 
            value={selectedInstanceId} 
            onValueChange={setSelectedInstanceId}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a workflow..." />
            </SelectTrigger>
            <SelectContent>
              {instances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id}>
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>{instance.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {instance.completedSteps}/{instance.totalSteps}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedInstanceId && (
            <Button variant="outline" asChild>
              <Link href={`/workflows/instances/${selectedInstanceId}`}>
                View Details
              </Link>
            </Button>
          )}
        </div>
        
        {/* Board */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-8 w-32" />
                <div className="space-y-2 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 min-h-[300px]">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No active workflows</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start a workflow from a template to see it on the board.
            </p>
            <Button asChild>
              <Link href="/workflows/templates">View Templates</Link>
            </Button>
          </div>
        ) : !instanceDetail ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a workflow</h3>
            <p className="text-sm text-muted-foreground">
              Choose a workflow from the dropdown to view its tasks.
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <WorkflowKanban
                instance={instanceDetail}
                onStepClick={(_step) => {
                  // Could open step details dialog
                }}
                onCompleteStep={handleCompleteStep}
                onStartStep={handleStartStep}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  )
}

