"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Expand, Maximize2, Minimize2, Move, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"

/**
 * Mermaid Diagram Props
 */
interface MermaidDiagramProps {
  chart: string
  title?: string
  className?: string
}

/**
 * Transform state for pan/zoom
 */
interface TransformState {
  scale: number
  translateX: number
  translateY: number
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const SCALE_STEP = 0.25

/**
 * Mermaid Diagram Component
 * Renders mermaid diagrams with pan, zoom, and fullscreen capabilities
 */
export function MermaidDiagram({ chart, title, className }: MermaidDiagramProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [svgContent, setSvgContent] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  
  // Get current theme
  const { resolvedTheme } = useTheme()
  const isDarkMode = resolvedTheme === "dark"
  
  // Transform state for pan/zoom
  const [transform, setTransform] = React.useState<TransformState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  })
  
  // Dragging state
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  
  // Load mermaid dynamically and render
  React.useEffect(() => {
    let mounted = true
    
    async function renderMermaid() {
      try {
        setIsLoading(true)
        setError(null)
        
        // Dynamically import mermaid (loaded from CDN or npm)
        const mermaid = (await import("mermaid")).default
        
        // Initialize mermaid with config - use dark theme when in dark mode
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? "dark" : "neutral",
          securityLevel: "loose",
          fontFamily: "inherit",
          themeVariables: isDarkMode ? {
            primaryColor: "#1e293b",
            primaryTextColor: "#f1f5f9",
            primaryBorderColor: "#475569",
            lineColor: "#94a3b8",
            secondaryColor: "#334155",
            tertiaryColor: "#1e293b",
            background: "#0f172a",
            mainBkg: "#1e293b",
            secondBkg: "#334155",
            nodeBorder: "#475569",
            clusterBkg: "#1e293b",
            clusterBorder: "#475569",
            titleColor: "#f1f5f9",
            edgeLabelBackground: "#1e293b",
            actorBorder: "#475569",
            actorBkg: "#1e293b",
            actorTextColor: "#f1f5f9",
            actorLineColor: "#94a3b8",
            noteBkgColor: "#334155",
            noteTextColor: "#f1f5f9",
            noteBorderColor: "#475569",
            signalColor: "#94a3b8",
            signalTextColor: "#f1f5f9",
          } : undefined,
        })
        
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
        
        // Render the diagram
        const { svg } = await mermaid.render(id, chart)
        
        if (mounted) {
          setSvgContent(svg)
          setIsLoading(false)
        }
      } catch (err) {
        if (mounted) {
          console.error("Mermaid rendering error:", err)
          setError(err instanceof Error ? err.message : "Failed to render diagram")
          setIsLoading(false)
        }
      }
    }
    
    renderMermaid()
    
    return () => {
      mounted = false
    }
  }, [chart, isDarkMode])
  
  // Reset transform
  const resetTransform = React.useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 })
  }, [])
  
  // Zoom in
  const zoomIn = React.useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + SCALE_STEP, MAX_SCALE),
    }))
  }, [])
  
  // Zoom out
  const zoomOut = React.useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - SCALE_STEP, MIN_SCALE),
    }))
  }, [])
  
  // Handle wheel zoom
  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale + delta, MIN_SCALE), MAX_SCALE),
    }))
  }, [])
  
  // Handle mouse down for dragging
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY })
    }
  }, [transform.translateX, transform.translateY])
  
  // Handle mouse move for dragging
  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        translateX: e.clientX - dragStart.x,
        translateY: e.clientY - dragStart.y,
      }))
    }
  }, [isDragging, dragStart])
  
  // Handle mouse up to stop dragging
  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false)
  }, [])
  
  // Handle mouse leave to stop dragging
  const handleMouseLeave = React.useCallback(() => {
    setIsDragging(false)
  }, [])
  
  // Diagram content renderer
  const renderDiagram = (inFullscreen: boolean = false) => (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-muted/30 rounded-lg border overflow-hidden",
        inFullscreen ? "h-full" : "min-h-[300px]",
        isDragging && "cursor-grabbing"
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-md border p-1 print:hidden">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={zoomOut}
                disabled={transform.scale <= MIN_SCALE}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          
          <span className="text-xs text-muted-foreground px-1 min-w-[40px] text-center">
            {Math.round(transform.scale * 100)}%
          </span>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={zoomIn}
                disabled={transform.scale >= MAX_SCALE}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={resetTransform}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset view</TooltipContent>
          </Tooltip>
          
          {!inFullscreen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsFullscreen(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
      
      {/* Pan indicator */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 text-xs text-muted-foreground bg-background/60 backdrop-blur-sm rounded px-2 py-1 print:hidden">
        <Move className="h-3 w-3" />
        <span>Drag to pan</span>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span>Rendering diagram...</span>
          </div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
          <div className="text-center p-4">
            <p className="text-destructive font-medium">Failed to render diagram</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <pre className="mt-4 text-xs text-left bg-muted p-2 rounded max-h-[200px] overflow-auto">
              {chart}
            </pre>
          </div>
        </div>
      )}
      
      {/* SVG content */}
      {!isLoading && !error && (
        <div
          ref={svgRef}
          className={cn(
            "w-full h-full flex items-center justify-center p-4",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  )
  
  return (
    <div className={cn("my-6", className)}>
      {/* Title */}
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      )}
      
      {/* Inline diagram */}
      {renderDiagram(false)}
      
      {/* Fullscreen dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent 
          showCloseButton={false}
          className="!max-w-none !w-screen !h-screen !max-h-screen !p-0 !rounded-none !border-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !gap-0"
        >
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{title || "Diagram"}</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 className="mr-2 h-4 w-4" />
                Exit Fullscreen
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 p-4 overflow-hidden">
            {renderDiagram(true)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

