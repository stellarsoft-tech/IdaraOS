"use client"

import { useMemo } from "react"
import { Users, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  HierarchyTreeView, 
  type HierarchyItem,
  type HierarchyTreeConfig,
} from "@/components/primitives/hierarchy-tree-view"
import { type Team } from "@/lib/api/teams"

export interface TeamTreeViewProps {
  teams: Team[]
  selectedTeamId?: string | null
  onSelect?: (team: Team) => void
  onAdd?: (parentTeamId?: string | null) => void
  onEdit?: (team: Team) => void
  onDelete?: (team: Team) => void
  canEdit?: boolean
  canDelete?: boolean
  isLoading?: boolean
  className?: string
}

/**
 * Adapter interface to map Team to HierarchyItem
 * The generic tree requires `parentId` but Team uses `parentTeamId`
 */
interface TeamTreeItem extends HierarchyItem {
  originalTeam: Team
}

/**
 * TeamTreeView - Tree view component for teams
 * Wraps the generic HierarchyTreeView with team-specific rendering
 */
export function TeamTreeView({
  teams,
  selectedTeamId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  isLoading,
  className,
}: TeamTreeViewProps) {
  // Map Team[] to HierarchyItem[]
  const items: TeamTreeItem[] = useMemo(() => 
    teams.map(team => ({
      id: team.id,
      name: team.name,
      description: team.description,
      parentId: team.parentTeamId, // Map parentTeamId -> parentId
      sortOrder: team.sortOrder,
      originalTeam: team,
    })),
    [teams]
  )
  
  // Configuration for team-specific rendering
  const config: HierarchyTreeConfig<TeamTreeItem> = useMemo(() => ({
    labels: {
      itemName: "team",
      addChild: "Add Sub-Team",
      editItem: "Edit Team",
      deleteItem: "Delete Team",
      addRoot: "Add Team",
      emptyTitle: "No teams defined",
      emptyDescription: "Create teams to organize your people.",
      addFirstButton: "Add First Team",
    },
    emptyIcon: <Users className="h-10 w-10 text-muted-foreground mb-3" />,
    
    // Render team-specific icon
    renderIcon: (item, depth) => (
      <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Users className="h-3.5 w-3.5 text-primary" />
      </div>
    ),
    
    // Render badges (top-level indicator, lead, member count)
    renderBadges: (item) => (
      <>
        {item.originalTeam.parentTeamId === null && (
          <Badge variant="outline" className="text-xs">Top</Badge>
        )}
        {item.originalTeam.lead && (
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            {item.originalTeam.lead.name.split(" ")[0]}
          </Badge>
        )}
        {item.originalTeam.memberCount > 0 && (
          <Badge variant="secondary" className="font-mono text-xs flex items-center gap-1">
            <Users className="h-3 w-3" />
            {item.originalTeam.memberCount}
          </Badge>
        )}
      </>
    ),
    
    // Check if team can be deleted (no members, no sub-teams)
    canDeleteItem: (item) => 
      item.originalTeam.childCount === 0 && item.originalTeam.memberCount === 0,
    
    // Sort by sortOrder, then name
    sortFn: (a, b) => {
      if (a.sortOrder !== b.sortOrder) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      return a.name.localeCompare(b.name)
    },
  }), [])
  
  // Event handlers that map back to Team
  const handleSelect = (item: TeamTreeItem) => {
    onSelect?.(item.originalTeam)
  }
  
  const handleEdit = (item: TeamTreeItem) => {
    onEdit?.(item.originalTeam)
  }
  
  const handleDelete = (item: TeamTreeItem) => {
    onDelete?.(item.originalTeam)
  }
  
  return (
    <HierarchyTreeView
      items={items}
      selectedId={selectedTeamId}
      onSelect={handleSelect}
      onAdd={onAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      canEdit={canEdit}
      canDelete={canDelete}
      isLoading={isLoading}
      className={className}
      config={config}
    />
  )
}
