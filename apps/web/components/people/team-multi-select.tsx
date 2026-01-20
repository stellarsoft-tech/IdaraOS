"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Simplified team interface for multi-select
export interface TeamSelectOption {
  id: string
  name: string
  parentTeamId?: string | null
  memberCount?: number
}

export interface TeamMultiSelectProps {
  teams: TeamSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

/**
 * TeamMultiSelect - Multi-select for teams with hierarchical display
 * Allows selecting multiple teams for a role
 */
export function TeamMultiSelect({
  teams,
  value,
  onChange,
  disabled,
  placeholder = "Select teams...",
  className,
}: TeamMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  // Build hierarchical structure
  const { flatList, teamMap } = useMemo(() => {
    const map = new Map(teams.map(t => [t.id, t]))
    
    // Build tree structure
    const rootTeams: TeamSelectOption[] = []
    const childrenMap = new Map<string | null | undefined, TeamSelectOption[]>()
    
    for (const team of teams) {
      const parentId = team.parentTeamId
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, [])
      }
      childrenMap.get(parentId)!.push(team)
      
      if (!parentId || !map.has(parentId)) {
        rootTeams.push(team)
      }
    }
    
    // Sort children by name
    for (const children of childrenMap.values()) {
      children.sort((a, b) => a.name.localeCompare(b.name))
    }
    
    // Flatten tree with depth info
    const flat: Array<{ team: TeamSelectOption; depth: number }> = []
    
    function traverse(team: TeamSelectOption, depth: number) {
      flat.push({ team, depth })
      const children = childrenMap.get(team.id) || []
      for (const child of children) {
        traverse(child, depth + 1)
      }
    }
    
    rootTeams.sort((a, b) => a.name.localeCompare(b.name))
    for (const root of rootTeams) {
      traverse(root, 0)
    }
    
    return { flatList: flat, teamMap: map }
  }, [teams])

  // Filter based on search
  const filteredList = useMemo(() => {
    if (!search) return flatList
    const searchLower = search.toLowerCase()
    return flatList.filter(({ team }) => 
      team.name.toLowerCase().includes(searchLower)
    )
  }, [flatList, search])

  // Get selected team names for display
  const selectedTeams = useMemo(() => {
    return value.map(id => teamMap.get(id)).filter((t): t is TeamSelectOption => !!t)
  }, [value, teamMap])

  const handleSelect = (teamId: string) => {
    if (value.includes(teamId)) {
      onChange(value.filter(id => id !== teamId))
    } else {
      onChange([...value, teamId])
    }
  }

  const handleRemove = (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(id => id !== teamId))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between min-h-[2.5rem] h-auto",
            !value.length && "text-muted-foreground",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {selectedTeams.length > 0 ? (
              selectedTeams.map(team => (
                <Badge
                  key={team.id}
                  variant="secondary"
                  className="mr-1 mb-0.5"
                >
                  {team.name}
                  <button
                    type="button"
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={(e) => handleRemove(team.id, e)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search teams..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No teams found.</CommandEmpty>
            <CommandGroup>
              {filteredList.map(({ team, depth }) => (
                <CommandItem
                  key={team.id}
                  value={team.id}
                  onSelect={() => handleSelect(team.id)}
                  className="flex items-center gap-2"
                >
                  <div 
                    className="flex items-center gap-2 flex-1"
                    style={{ paddingLeft: `${depth * 16}px` }}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded flex items-center justify-center flex-shrink-0",
                      depth === 0 ? "bg-primary text-primary-foreground" : "bg-primary/10"
                    )}>
                      <Users className={cn("h-3 w-3", depth > 0 && "text-primary")} />
                    </div>
                    <span className="truncate">{team.name}</span>
                    {(team.memberCount ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-xs font-mono ml-auto">
                        {team.memberCount}
                      </Badge>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value.includes(team.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
