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
  dueOffsetDays?: number
  isRequired: boolean
  isSelected?: boolean
  metadata?: Record<string, unknown>
}

const stepTypeConfig: Record<StepNodeData["stepType"], {
  icon: typeof CheckSquare
  className: string
  label: string
}> = {
  task: {
    icon: CheckSquare,
    className: "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950",
    label: "Task",
  },
  notification: {
    icon: Bell,
    className: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950",
    label: "Notification",
  },
  gateway: {
    icon: GitBranch,
    className: "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-950",
    label: "Gateway",
  },
  group: {
    icon: Layers,
    className: "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
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
        "relative rounded-lg border-2 shadow-sm transition-all min-w-[180px] max-w-[240px]",
        typeConfig.className,
        selected && "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900",
        !data.isRequired && "border-dashed opacity-80"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white dark:!border-slate-900"
      />
      
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-inherit">
        <TypeIcon className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {typeConfig.label}
        </span>
        {!data.isRequired && (
          <span className="text-xs text-slate-400 ml-auto">(Optional)</span>
        )}
      </div>
      
      {/* Content */}
      <div className="px-3 py-2">
        <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
          {data.name}
        </h3>
        {data.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {data.description}
          </p>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-inherit bg-white/50 dark:bg-black/20 rounded-b-lg">
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <AssigneeIcon className="h-3 w-3" />
          <span>{assigneeConfig.label}</span>
        </div>
        {data.dueOffsetDays !== undefined && data.dueOffsetDays > 0 && (
          <span className="text-xs text-slate-400">
            +{data.dueOffsetDays}d
          </span>
        )}
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white dark:!border-slate-900"
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
