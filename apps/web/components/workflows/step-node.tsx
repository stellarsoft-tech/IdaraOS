"use client"

import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { 
  CheckSquare, 
  Bell, 
  GitBranch, 
  Layers,
  User,
  Users,
  UserCheck,
  UserPlus
} from "lucide-react"

export interface StepNodeData extends Record<string, unknown> {
  id: string
  name: string
  description?: string
  stepType: "task" | "notification" | "gateway" | "group"
  assigneeType: "specific_user" | "role" | "dynamic_manager" | "dynamic_creator" | "unassigned"
  assigneeConfig?: Record<string, unknown>
  defaultAssigneeId?: string | null
  defaultAssignee?: { id: string; name: string; email: string } | null
  dueOffsetDays?: number
  isRequired: boolean
  isSelected?: boolean
  metadata?: Record<string, unknown>
}

const stepTypeConfig: Record<StepNodeData["stepType"], {
  icon: typeof CheckSquare
  className: string
  headerClassName: string
  label: string
}> = {
  task: {
    icon: CheckSquare,
    className: "border-blue-500/50 bg-card shadow-blue-500/10",
    headerClassName: "text-blue-600 dark:text-blue-400",
    label: "Task",
  },
  notification: {
    icon: Bell,
    className: "border-amber-500/50 bg-card shadow-amber-500/10",
    headerClassName: "text-amber-600 dark:text-amber-400",
    label: "Notification",
  },
  gateway: {
    icon: GitBranch,
    className: "border-purple-500/50 bg-card shadow-purple-500/10",
    headerClassName: "text-purple-600 dark:text-purple-400",
    label: "Gateway",
  },
  group: {
    icon: Layers,
    className: "border-border bg-card",
    headerClassName: "text-muted-foreground",
    label: "Group",
  },
}

const assigneeTypeConfig: Record<StepNodeData["assigneeType"], {
  icon: typeof User
  label: string
}> = {
  specific_user: {
    icon: User,
    label: "Specific User",
  },
  role: {
    icon: Users,
    label: "Role",
  },
  dynamic_manager: {
    icon: UserCheck,
    label: "Manager",
  },
  dynamic_creator: {
    icon: UserPlus,
    label: "Creator",
  },
  unassigned: {
    icon: User,
    label: "Unassigned",
  },
}

interface StepNodeProps {
  data: StepNodeData
  selected?: boolean
}

function StepNodeComponent({ data, selected }: StepNodeProps) {
  const typeConfig = stepTypeConfig[data.stepType]
  const assigneeConfig = assigneeTypeConfig[data.assigneeType]
  const TypeIcon = typeConfig.icon
  const AssigneeIcon = assigneeConfig.icon
  
  return (
    <div
      className={cn(
        "relative rounded-lg border-2 shadow-md transition-all min-w-[180px] max-w-[240px]",
        typeConfig.className,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        !data.isRequired && "border-dashed opacity-80"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <TypeIcon className={cn("h-4 w-4 shrink-0", typeConfig.headerClassName)} />
        <span className={cn("text-xs font-medium uppercase tracking-wide", typeConfig.headerClassName)}>
          {typeConfig.label}
        </span>
        {!data.isRequired && (
          <span className="text-xs text-muted-foreground ml-auto">(Optional)</span>
        )}
      </div>
      
      {/* Content */}
      <div className="px-3 py-2">
        <h3 className="font-medium text-sm text-foreground line-clamp-2">
          {data.name}
        </h3>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {data.description}
          </p>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/50 rounded-b-[calc(0.5rem-2px)]">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <AssigneeIcon className="h-3 w-3" />
          <span>{assigneeConfig.label}</span>
        </div>
        {data.dueOffsetDays !== undefined && data.dueOffsetDays > 0 && (
          <span className="text-xs text-muted-foreground">
            +{data.dueOffsetDays}d
          </span>
        )}
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  )
}

export const StepNode = memo(StepNodeComponent)

/**
 * Node types object for React Flow
 */
export const workflowNodeTypes = {
  step: StepNode,
}

/**
 * Default node data
 */
export const defaultStepNodeData: Partial<StepNodeData> = {
  stepType: "task",
  assigneeType: "unassigned",
  isRequired: true,
}
