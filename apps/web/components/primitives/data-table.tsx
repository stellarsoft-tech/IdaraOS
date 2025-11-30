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
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

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
  
  // Loading state
  loading?: boolean
  
  // Empty state
  emptyState?: React.ReactNode
}

/**
 * Feature-complete DataTable component with server-side support
 */
export function DataTable<TData>({
  columns,
  data,
  serverMode = false,
  totalCount,
  state: externalState,
  onStateChange,
  searchKey,
  searchPlaceholder = "Search...",
  getRowId,
  onRowClick,
  toolbar,
  bulkActions,
  enableVirtualization = false,
  enableColumnFilters = true,
  enableSorting = true,
  enableSelection = false,
  enableColumnVisibility = true,
  enableExport = true,
  loading = false,
  emptyState,
}: DataTableProps<TData>) {
  // Internal state (used when not in server mode)
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [internalFilters, setInternalFilters] = React.useState<ColumnFiltersState>([])
  const [internalVisibility, setInternalVisibility] = React.useState<VisibilityState>({})
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
    const headers = table.getFlatHeaders().map((h) => h.column.columnDef.header as string)
    const rows = table.getFilteredRowModel().rows.map((row) =>
      row.getVisibleCells().map((cell) => {
        const value = cell.getValue()
        return typeof value === "object" ? JSON.stringify(value) : value
      })
    )
    
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")
    
    const blob = new Blob([csv], { type: "text/csv" })
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
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
      
      {/* Active filters */}
      {columnFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {columnFilters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
            >
              <span className="font-medium">{filter.id}:</span>
              <span>{String(filter.value)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 px-1"
                onClick={() => table.getColumn(filter.id)?.setFilterValue(undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            Clear all
          </Button>
        </div>
      )}
      
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
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                        className={onRowClick ? "cursor-pointer" : ""}
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
                    className={onRowClick ? "cursor-pointer" : ""}
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
          Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, totalRows)} of{" "}
          {totalRows} results
          {hasSelection && ` (${Object.keys(rowSelection).length} selected)`}
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

