"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
  Column,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

/**
 * Table state for server-side mode
 */
export interface TableState {
  page: number
  pageSize: number
  sorting: SortingState
  filters: ColumnFiltersState
  columnVisibility: VisibilityState
  selection: RowSelectionState
}

/**
 * Facet configuration for a column
 */
export interface FacetConfig {
  type: "enum" | "boolean" | "text" | "date" | "number"
  options?: Array<{ label: string; value: string }>
}

/**
 * DataTable props
 */
export interface DataTableProps<TData> {
  // Core data
  columns: ColumnDef<TData>[]
  data: TData[]
  
  // Server-side mode
  serverMode?: boolean
  totalCount?: number
  state?: Partial<TableState>
  onStateChange?: (state: TableState) => void
  
  // Client-side features
  searchKey?: keyof TData
  searchPlaceholder?: string
  
  // Row interaction
  getRowId?: (row: TData) => string
  onRowClick?: (row: TData) => void
  
  // Faceted filters configuration
  facetedFilters?: Record<string, FacetConfig>
  
  // Slots
  toolbar?: React.ReactNode
  bulkActions?: React.ReactNode
  
  // Features
  enableVirtualization?: boolean
  enableColumnFilters?: boolean
  enableSorting?: boolean
  enableSelection?: boolean
  enableColumnVisibility?: boolean
  enableExport?: boolean
  
  // Initial column visibility (to hide columns by default)
  initialColumnVisibility?: VisibilityState
  
  // Loading state
  loading?: boolean
  
  // Empty state
  emptyState?: React.ReactNode
}

/**
 * Column Header with Sorting and Filtering
 */
function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  enableSorting,
  enableFiltering,
  data,
  filterType,
  filterOptions,
}: {
  column: Column<TData, TValue>
  title: string
  enableSorting?: boolean
  enableFiltering?: boolean
  data?: TData[]
  filterType?: "text" | "enum" | "date" | "number"
  filterOptions?: Array<{ label: string; value: string }>
}) {
  const [isHovered, setIsHovered] = React.useState(false)
  const sortedState = column.getIsSorted()
  const isFiltered = column.getIsFiltered()
  
  // Use provided options or extract unique values from dataset for enum filters
  const uniqueValues = React.useMemo(() => {
    if (filterType !== "enum") return []
    
    // If options are explicitly provided, use them with count from data
    if (filterOptions && filterOptions.length > 0) {
      // Count occurrences for each option from the data
      const counts = new Map<string, number>()
      if (data) {
        data.forEach((row) => {
          // Try to get value using column accessor
          const cellValue = column.accessorFn 
            ? (column.accessorFn as (row: TData) => unknown)(row)
            : (row as Record<string, unknown>)[column.id]
          if (cellValue !== null && cellValue !== undefined) {
            const key = String(cellValue)
            counts.set(key, (counts.get(key) || 0) + 1)
          }
        })
      }
      return filterOptions.map(opt => ({
        label: opt.label,
        value: opt.value,
        count: counts.get(opt.value) || 0,
      }))
    }
    
    // Auto-detect from data
    if (!data) return []
    
    const values = new Map<string, number>()
    data.forEach((row) => {
      // Try to get value using column accessor
      const cellValue = column.accessorFn 
        ? (column.accessorFn as (row: TData) => unknown)(row)
        : (row as Record<string, unknown>)[column.id]
      if (cellValue !== null && cellValue !== undefined) {
        const key = String(cellValue)
        values.set(key, (values.get(key) || 0) + 1)
      }
    })
    
    return Array.from(values.entries())
      .map(([value, count]) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
        value,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [data, column, filterType, filterOptions])
  
  // Handle sort cycling: none → asc → desc → none
  const handleSort = () => {
    if (!enableSorting || !column.getCanSort()) return
    
    if (!sortedState) {
      column.toggleSorting(false) // Set to asc
    } else if (sortedState === "asc") {
      column.toggleSorting(true) // Set to desc
    } else {
      column.clearSorting() // Clear sort
    }
  }
  
  // Local search input for filtering dropdown options (always a string)
  const [filterValue, setFilterValue] = React.useState("")
  const [selectedOptions, setSelectedOptions] = React.useState<Set<string>>(
    new Set(column.getFilterValue() as string[])
  )
  
  // Initialize dateRange from column filter value
  const filterValueForDate = column.getFilterValue() as string[] | undefined
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>(() => {
    if (filterValueForDate && Array.isArray(filterValueForDate)) {
      return {
        from: filterValueForDate[0] ? new Date(filterValueForDate[0]) : undefined,
        to: filterValueForDate[1] ? new Date(filterValueForDate[1]) : undefined,
      }
    }
    return {}
  })
  
  // Debounced text filter
  React.useEffect(() => {
    if (filterType !== "text") return
    const timer = setTimeout(() => {
      column.setFilterValue(filterValue || undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [filterValue, column, filterType])
  
  // Render filter based on type
  const renderFilter = () => {
    // Date filter
    if (filterType === "date") {
      const hasDateFilter = dateRange.from || dateRange.to
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 w-full justify-start text-left font-normal",
                hasDateFilter && "border-primary"
              )}
            >
              <Calendar className={cn("mr-2 h-3.5 w-3.5", hasDateFilter && "text-primary")} />
              <span className="truncate text-xs">
                {dateRange.from 
                  ? dateRange.to 
                    ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                    : format(dateRange.from, "MMM d, yyyy")
                  : "Date range..."}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range: { from?: Date; to?: Date } | undefined) => {
                const newRange = { from: range?.from, to: range?.to }
                setDateRange(newRange)
                
                // Set filter value - TanStack Table will use our custom filterFn
                if (newRange.from && newRange.to) {
                  // Both dates selected - filter by range
                  column.setFilterValue([
                    newRange.from.toISOString().split('T')[0], // Just the date part
                    newRange.to.toISOString().split('T')[0]
                  ])
                } else if (newRange.from) {
                  // Only start date - filter from that date onwards
                  column.setFilterValue([newRange.from.toISOString().split('T')[0]])
                } else {
                  // No dates - clear filter
                  column.setFilterValue(undefined)
                }
              }}
              numberOfMonths={2}
            />
            {hasDateFilter && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full"
                  onClick={() => {
                    setDateRange({})
                    column.setFilterValue(undefined)
                  }}
                >
                  Clear dates
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )
    }
    
    // Number filter (just show disabled placeholder for now)
    if (filterType === "number") {
      return (
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start text-left font-normal opacity-50 cursor-not-allowed"
          disabled
        >
          <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate text-muted-foreground">N/A</span>
        </Button>
      )
    }
    
    // Enum filter
    if (filterType === "enum" && uniqueValues.length > 0) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 w-full justify-start text-left font-normal",
                isFiltered && "border-primary"
              )}
            >
              <Filter className={cn("mr-2 h-3.5 w-3.5", isFiltered && "text-primary")} />
              <span className="truncate">
                {selectedOptions.size > 0
                  ? `${selectedOptions.size} selected`
                  : "Filter..."}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <div className="p-2">
              <Input
                placeholder="Search..."
                className="h-8"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-[200px] overflow-auto">
              {uniqueValues
                .filter((opt) =>
                  opt.label.toLowerCase().includes(filterValue.toLowerCase())
                )
                .map((option) => {
                  const isSelected = selectedOptions.has(option.value)
                  return (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedOptions)
                        if (checked) {
                          newSelected.add(option.value)
                        } else {
                          newSelected.delete(option.value)
                        }
                        setSelectedOptions(newSelected)
                        column.setFilterValue(
                          newSelected.size > 0 ? Array.from(newSelected) : undefined
                        )
                      }}
                    >
                      <span className="flex-1">{option.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </div>
            {selectedOptions.size > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full"
                    onClick={() => {
                      setSelectedOptions(new Set())
                      column.setFilterValue(undefined)
                      setFilterValue("")
                    }}
                  >
                    Clear filter
                  </Button>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    
    // Default: Text filter
    return (
      <div className="relative">
        <Filter className={cn(
          "absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
          isFiltered ? "text-primary" : "text-muted-foreground"
        )} />
        <Input
          placeholder="Filter..."
          className={cn(
            "h-8 pl-7 pr-7",
            isFiltered && "border-primary"
          )}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-8 w-8 p-0 hover:bg-transparent"
            onClick={() => {
              setFilterValue("")
              column.setFilterValue(undefined)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  }
  
  return (
    <div className="flex flex-col gap-2">
      {/* Column Title with Sort */}
      {enableSorting && column.getCanSort() ? (
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-4 py-2 w-full text-left",
            "cursor-pointer select-none hover:bg-accent/50"
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleSort}
        >
          <span className="font-medium">{title}</span>
          {sortedState === "asc" && <ArrowUp className="h-4 w-4" />}
          {sortedState === "desc" && <ArrowDown className="h-4 w-4" />}
          {!sortedState && isHovered && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="font-medium">{title}</span>
        </div>
      )}
      
      {/* Column Filter - Always show if filtering enabled */}
      {enableFiltering && (
        <div className="px-3 pb-2">
          {renderFilter()}
        </div>
      )}
    </div>
  )
}


/**
 * Feature-complete DataTable component with server-side support
 */
export function DataTable<TData>({
  columns: initialColumns,
  data,
  serverMode = false,
  totalCount,
  state: externalState,
  onStateChange,
  searchKey,
  searchPlaceholder = "Search...",
  getRowId,
  onRowClick,
  facetedFilters,
  toolbar,
  bulkActions,
  enableVirtualization = false,
  enableColumnFilters = true,
  enableSorting = true,
  enableSelection = false,
  enableColumnVisibility = true,
  enableExport = true,
  initialColumnVisibility = {},
  loading = false,
  emptyState,
}: DataTableProps<TData>) {
  // Add sorting/filtering headers to columns
  const columns = React.useMemo(
    (): ColumnDef<TData>[] =>
      initialColumns.map((col): ColumnDef<TData> => {
        // Determine filter type from facetedFilters config or column properties
        const columnId = col.id || (col as { accessorKey?: string }).accessorKey
        
        // Actions column - show header with N/A filter
        if (columnId === "actions") {
          return {
            ...col,
            enableSorting: false,
            enableColumnFilter: false,
            header: () => (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="font-medium">Actions</span>
                </div>
                <div className="px-3 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-start text-left font-normal opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate text-muted-foreground">N/A</span>
                  </Button>
                </div>
              </div>
            ),
          } as ColumnDef<TData>
        }
        
        const facetConfig = facetedFilters?.[columnId as string]
        
        // Determine filter type - use type assertion to maintain full union type
        type FilterType = "text" | "enum" | "date" | "number"
        let filterType: FilterType = "text"
        if (facetConfig?.type && ["text", "enum", "date", "number"].includes(facetConfig.type)) {
          filterType = facetConfig.type as FilterType
        } else if (columnId === "assignedAssets" || columnId?.includes("count") || columnId?.includes("Count")) {
          filterType = "number"
        } else if (columnId?.includes("Date") || columnId?.includes("date") || columnId === "startDate" || columnId === "endDate") {
          filterType = "date"
        }
        
        // Determine the appropriate filter function
        const getColumnFilterFn = () => {
          // Date filter - custom range-based filter
          if (filterType === "date") {
            return (row: import("@tanstack/react-table").Row<TData>, columnId: string, filterValue: string[] | undefined) => {
              if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) {
                return true
              }
              
              const cellValue = (row.getValue(columnId) as string | Date | undefined)
              if (!cellValue) return false
              
              // Parse cell date - handle both Date objects and date strings
              let cellDate: Date
              if (cellValue instanceof Date) {
                cellDate = cellValue
              } else if (typeof cellValue === "string") {
                // Handle ISO strings, YYYY-MM-DD, or other date formats
                cellDate = new Date(cellValue)
              } else {
                return false
              }
              
              if (isNaN(cellDate.getTime())) return false
              
              // Parse filter dates
              const fromDateStr = filterValue[0]
              const toDateStr = filterValue[1]
              
              // Normalize dates to start of day for comparison
              const normalizeDate = (date: Date) => {
                const d = new Date(date)
                d.setHours(0, 0, 0, 0)
                return d
              }
              
              const normalizedCellDate = normalizeDate(cellDate)
              
              if (fromDateStr && toDateStr) {
                // Range filter: cell date must be between from and to (inclusive)
                const fromDate = new Date(fromDateStr)
                const toDate = new Date(toDateStr)
                if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return false
                
                const normalizedFrom = normalizeDate(fromDate)
                const normalizedTo = normalizeDate(toDate)
                return normalizedCellDate >= normalizedFrom && normalizedCellDate <= normalizedTo
              } else if (fromDateStr) {
                // Only from date: cell date must be >= from
                const fromDate = new Date(fromDateStr)
                if (isNaN(fromDate.getTime())) return false
                
                const normalizedFrom = normalizeDate(fromDate)
                return normalizedCellDate >= normalizedFrom
              } else if (toDateStr) {
                // Only to date: cell date must be <= to
                const toDate = new Date(toDateStr)
                if (isNaN(toDate.getTime())) return false
                
                const normalizedTo = normalizeDate(toDate)
                return normalizedCellDate <= normalizedTo
              }
              
              return true
            }
          }
          
          // Enum filter - array-based multi-select filter
          // Use original filterFn if provided, otherwise provide default enum filter
          if (filterType === "enum") {
            if ((col as { filterFn?: unknown }).filterFn) {
              return (col as { filterFn: unknown }).filterFn
            }
            // Default enum filter for multi-select
            return (row: import("@tanstack/react-table").Row<TData>, columnId: string, filterValue: string[] | undefined) => {
              if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) {
                return true
              }
              const cellValue = row.getValue(columnId)
              return filterValue.includes(String(cellValue))
            }
          }
          
          // Text filter - use original filterFn if provided, or use built-in "includesString"
          if ((col as { filterFn?: unknown }).filterFn) {
            return (col as { filterFn: unknown }).filterFn
          }
          
          // For text columns, use the built-in includesString filter
          return "includesString" as const
        }
        
        return {
          ...col,
          filterFn: getColumnFilterFn(),
          header: ({ column }) => {
            const title = typeof col.header === "string" ? col.header : String(columnId || "")
            return (
              <DataTableColumnHeader
                column={column}
                title={title}
                enableSorting={enableSorting}
                enableFiltering={enableColumnFilters}
                data={data}
                filterType={filterType}
                filterOptions={facetConfig?.options}
              />
            )
          },
        } as ColumnDef<TData>
      }),
    [initialColumns, enableSorting, enableColumnFilters, facetedFilters, data]
  )

  // Internal state (used when not in server mode)
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [internalFilters, setInternalFilters] = React.useState<ColumnFiltersState>([])
  const [internalVisibility, setInternalVisibility] = React.useState<VisibilityState>(initialColumnVisibility)
  const [internalSelection, setInternalSelection] = React.useState<RowSelectionState>({})
  const [internalPage, setInternalPage] = React.useState(0)
  const [internalPageSize, setInternalPageSize] = React.useState(10)
  const [globalFilter, setGlobalFilter] = React.useState("")
  
  // Use external or internal state
  const sorting = serverMode ? (externalState?.sorting || []) : internalSorting
  const columnFilters = serverMode ? (externalState?.filters || []) : internalFilters
  const columnVisibility = serverMode ? (externalState?.columnVisibility || {}) : internalVisibility
  const rowSelection = serverMode ? (externalState?.selection || {}) : internalSelection
  const pageIndex = serverMode ? (externalState?.page || 0) : internalPage
  const pageSize = serverMode ? (externalState?.pageSize || 10) : internalPageSize
  
  // Notify parent of state changes in server mode
  const notifyStateChange = React.useCallback(
    (updates: Partial<TableState>) => {
      if (serverMode && onStateChange) {
        onStateChange({
          page: pageIndex,
          pageSize,
          sorting,
          filters: columnFilters,
          columnVisibility,
          selection: rowSelection,
          ...updates,
        })
      }
    },
    [serverMode, onStateChange, pageIndex, pageSize, sorting, columnFilters, columnVisibility, rowSelection]
  )
  
  // Table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    pageCount: serverMode ? Math.ceil((totalCount || 0) / pageSize) : undefined,
    manualPagination: serverMode,
    manualSorting: serverMode,
    manualFiltering: serverMode,
    enableRowSelection: enableSelection,
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater
      if (serverMode) {
        notifyStateChange({ sorting: newSorting })
      } else {
        setInternalSorting(newSorting)
      }
    },
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater
      if (serverMode) {
        notifyStateChange({ filters: newFilters, page: 0 })
      } else {
        setInternalFilters(newFilters)
        setInternalPage(0)
      }
    },
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater
      if (serverMode) {
        notifyStateChange({ columnVisibility: newVisibility })
      } else {
        setInternalVisibility(newVisibility)
      }
    },
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === "function" ? updater(rowSelection) : updater
      if (serverMode) {
        notifyStateChange({ selection: newSelection })
      } else {
        setInternalSelection(newSelection)
      }
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: serverMode ? undefined : getFilteredRowModel(),
    getPaginationRowModel: serverMode ? undefined : getPaginationRowModel(),
    getSortedRowModel: serverMode ? undefined : getSortedRowModel(),
    getRowId,
  })
  
  // Virtualization
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()
  
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 50,
    getScrollElement: () => tableContainerRef.current,
    measureElement:
      typeof window !== "undefined" && navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 10,
    enabled: enableVirtualization && rows.length > 50,
  })
  
  const totalSize = rowVirtualizer.getTotalSize()
  const virtualItems = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0
  const paddingBottom = virtualItems.length > 0 ? totalSize - (virtualItems[virtualItems.length - 1]?.end || 0) : 0
  
  // CSV Export
  const exportToCSV = () => {
    const headers = table.getFlatHeaders().map((h) => {
      const header = h.column.columnDef.header
      return typeof header === "string" ? header : h.column.id
    })
    const rows = table.getFilteredRowModel().rows.map((row) =>
      row.getVisibleCells().map((cell) => {
        const value = cell.getValue()
        if (value === null || value === undefined) return ""
        if (typeof value === "object") return JSON.stringify(value)
        return String(value).replace(/"/g, '""') // Escape quotes
      })
    )
    
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Pagination helpers
  const totalRows = serverMode ? (totalCount || 0) : table.getFilteredRowModel().rows.length
  const totalPages = Math.ceil(totalRows / pageSize)
  const hasSelection = Object.keys(rowSelection).length > 0
  
  const handlePageChange = (newPage: number) => {
    if (serverMode) {
      notifyStateChange({ page: newPage })
    } else {
      setInternalPage(newPage)
      table.setPageIndex(newPage)
    }
  }
  
  const handlePageSizeChange = (newPageSize: number) => {
    if (serverMode) {
      notifyStateChange({ pageSize: newPageSize, page: 0 })
    } else {
      setInternalPageSize(newPageSize)
      setInternalPage(0)
      table.setPageSize(newPageSize)
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center gap-2">
            {/* Global search */}
            {searchKey && (
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={(table.getColumn(String(searchKey))?.getFilterValue() as string) ?? globalFilter}
                  onChange={(e) => {
                    const value = e.target.value
                    setGlobalFilter(value)
                    table.getColumn(String(searchKey))?.setFilterValue(value)
                  }}
                  className="pl-8"
                />
              </div>
            )}
            
            {/* Custom toolbar */}
            {toolbar}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Column visibility */}
            {enableColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Columns
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      const header = column.columnDef.header
                      const title = typeof header === "string" ? header : column.id
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        >
                          {title}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Export */}
            {enableExport && (
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>
        
        {/* Active Filters Summary - Show what's currently filtered */}
        {columnFilters.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetColumnFilters()}
              className="h-8 px-2"
            >
              Clear all ({columnFilters.length})
              <X className="ml-2 h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      
      
      {/* Bulk actions */}
      {hasSelection && bulkActions && (
        <div className="flex items-center gap-2 rounded-md border p-2">
          <span className="text-sm text-muted-foreground">
            {Object.keys(rowSelection).length} row(s) selected
          </span>
          {bulkActions}
        </div>
      )}
      
      {/* Table */}
      <div className="rounded-md border">
        <div
          ref={tableContainerRef}
          className="relative overflow-auto"
          style={{ maxHeight: enableVirtualization ? "600px" : undefined }}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }} className="px-0">
                      {header.isPlaceholder ? null : (
                        <div>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <Separator className="mt-2" />
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                // Loading skeletons
                Array.from({ length: pageSize }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {emptyState || "No results found."}
                  </TableCell>
                </TableRow>
              ) : enableVirtualization && rows.length > 50 ? (
                // Virtualized rows
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    return (
                      <TableRow
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={(node) => rowVirtualizer.measureElement(node)}
                        data-state={row.getIsSelected() && "selected"}
                        className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => onRowClick?.(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} />
                    </tr>
                  )}
                </>
              ) : (
                // Regular rows
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {hasSelection && `${Object.keys(rowSelection).length} of ${rows.length} row(s) selected. `}
          Showing {Math.min(pageIndex * pageSize + 1, totalRows)} to {Math.min((pageIndex + 1) * pageSize, totalRows)} of{" "}
          {totalRows} results
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => handlePageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(0)}
              disabled={pageIndex === 0 || loading}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pageIndex - 1)}
              disabled={pageIndex === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              {pageIndex + 1} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pageIndex + 1)}
              disabled={pageIndex >= totalPages - 1 || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={pageIndex >= totalPages - 1 || loading}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Re-export with better name
export { DataTable as DataTableAdvanced }

