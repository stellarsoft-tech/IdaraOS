"use client"

import { useMemo } from "react"
import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  HierarchyTreeSelect, 
  type HierarchySelectItem,
  type HierarchyTreeSelectConfig,
} from "@/components/primitives/hierarchy-tree-select"
import { type Team } from "@/lib/api/teams"

export interface TeamTreeSelectProps {
  teams: Team[]
  value: string | null
  onChange: (value: string | null) => void
  /** ID to exclude from selection (e.g., the team being edited can't be its own parent) */
  excludeId?: string | null
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Whether to show the "None" option. Defaults to true. Set to false for required fields. */
  allowNone?: boolean
  /** Label for the "None" option */
  noneOptionLabel?: string
  /** Message to show when there are no teams available */
  emptyMessage?: string
}

/**
 * Adapter interface to map Team to HierarchySelectItem
 */
interface TeamSelectItem extends HierarchySelectItem {
  originalTeam: Team
  memberCount: number
  childCount: number
}

/**
 * TeamTreeSelect - Hierarchical team selector
 * Shows teams in a tree structure for easier parent team selection
 */
export function TeamTreeSelect({
  teams,
  value,
  onChange,
  excludeId,
  disabled,
  placeholder = "Select parent team...",
  className,
  allowNone = true,
  noneOptionLabel = "None (Top-level team)",
  emptyMessage = "No teams available",
}: TeamTreeSelectProps) {
  // Map Team[] to HierarchySelectItem[]
  const items: TeamSelectItem[] = useMemo(() => 
    teams.map(team => ({
      id: team.id,
      name: team.name,
      parentId: team.parentTeamId,
      description: team.description,
      originalTeam: team,
      memberCount: team.memberCount,
      childCount: team.childCount,
    })),
    [teams]
  )
  
  // Configuration for team-specific rendering
  const config: HierarchyTreeSelectConfig<TeamSelectItem> = useMemo(() => ({
    labels: {
      title: "Select Team",
      placeholder,
      searchPlaceholder: "Search teams...",
      emptySearch: "No teams found",
      emptyState: emptyMessage,
      clear: "Clear",
      noneOption: noneOptionLabel,
    },
    allowNone,
    
    // Render team icon
    renderIcon: (item, depth) => (
      <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 ${
        item.parentId === null ? "bg-primary text-primary-foreground" : "bg-primary/10"
      }`}>
        <Users className={`h-3 w-3 ${item.parentId !== null ? "text-primary" : ""}`} />
      </div>
    ),
    
    // Render member count badge
    renderInfo: (item) => (
      item.memberCount > 0 ? (
        <Badge variant="secondary" className="text-xs font-mono ml-auto">
          {item.memberCount}
        </Badge>
      ) : null
    ),
    
    // Don't allow selecting teams that would create circular references
    canSelect: (item) => {
      if (!excludeId) return true
      // Check if selecting this item would create a cycle
      // A team can't be its own parent, and can't be a descendant of itself
      return item.id !== excludeId && !isDescendantOf(item.id, excludeId, teams)
    },
    
    // Sort by name
    sortFn: (a, b) => a.name.localeCompare(b.name),
  }), [placeholder, excludeId, teams, allowNone, noneOptionLabel, emptyMessage])
  
  return (
    <HierarchyTreeSelect
      items={items}
      value={value}
      onChange={onChange}
      excludeId={excludeId}
      disabled={disabled}
      className={className}
      config={config}
    />
  )
}

/**
 * Check if a team is a descendant of another team
 * Used to prevent circular references when selecting parent teams
 */
function isDescendantOf(
  potentialAncestorId: string, 
  descendantId: string, 
  teams: Team[]
): boolean {
  const teamMap = new Map(teams.map(t => [t.id, t]))
  
  let current = teamMap.get(descendantId)
  const visited = new Set<string>()
  
  while (current && current.parentTeamId) {
    if (visited.has(current.id)) break // Prevent infinite loop
    visited.add(current.id)
    
    if (current.parentTeamId === potentialAncestorId) {
      return true
    }
    current = teamMap.get(current.parentTeamId)
  }
  
  return false
}
