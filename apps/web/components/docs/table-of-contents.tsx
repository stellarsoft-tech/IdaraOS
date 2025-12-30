"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, List, X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Table of Contents heading item
 */
export interface TocHeading {
  id: string
  text: string
  level: number
}

/**
 * Table of Contents Props
 */
interface TableOfContentsProps {
  /** Container element to extract headings from */
  contentRef: React.RefObject<HTMLElement | null>
  /** Optional class name */
  className?: string
  /** Whether the ToC can be collapsed */
  collapsible?: boolean
  /** Default collapsed state */
  defaultCollapsed?: boolean
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void
}

/**
 * Extract headings from a container element
 */
function extractHeadings(container: HTMLElement): TocHeading[] {
  const headings: TocHeading[] = []
  const elements = container.querySelectorAll("h1, h2, h3, h4")
  
  elements.forEach((el, index) => {
    const text = el.textContent?.trim() || ""
    if (!text) return
    
    // Generate ID if not present
    let id = el.id
    if (!id) {
      id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
      el.id = id
    }
    
    const level = parseInt(el.tagName.charAt(1), 10)
    headings.push({ id, text, level })
  })
  
  return headings
}

/**
 * Table of Contents Component
 * Displays a scrollspy-enabled table of contents for document navigation
 */
export function TableOfContents({
  contentRef,
  className,
  collapsible = true,
  defaultCollapsed = false,
  onVisibilityChange,
}: TableOfContentsProps) {
  const [headings, setHeadings] = React.useState<TocHeading[]>([])
  const [activeId, setActiveId] = React.useState<string>("")
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const observerRef = React.useRef<IntersectionObserver | null>(null)

  // Extract headings when content changes
  React.useEffect(() => {
    if (!contentRef.current) return
    
    const updateHeadings = () => {
      const extracted = extractHeadings(contentRef.current!)
      setHeadings(extracted)
    }
    
    // Initial extraction
    updateHeadings()
    
    // Watch for DOM changes (for dynamic content)
    const mutationObserver = new MutationObserver(updateHeadings)
    mutationObserver.observe(contentRef.current, {
      childList: true,
      subtree: true,
    })
    
    return () => mutationObserver.disconnect()
  }, [contentRef])

  // Set up intersection observer for scrollspy
  React.useEffect(() => {
    if (!contentRef.current || headings.length === 0) return
    
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }
    
    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[]
    
    if (headingElements.length === 0) return
    
    // Track visible headings
    const visibleHeadings = new Set<string>()
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleHeadings.add(entry.target.id)
          } else {
            visibleHeadings.delete(entry.target.id)
          }
        })
        
        // Find the first visible heading in document order
        for (const heading of headings) {
          if (visibleHeadings.has(heading.id)) {
            setActiveId(heading.id)
            break
          }
        }
        
        // If no headings visible, find the closest one above viewport
        if (visibleHeadings.size === 0) {
          let closestAbove: string | null = null
          for (const heading of headings) {
            const el = document.getElementById(heading.id)
            if (el) {
              const rect = el.getBoundingClientRect()
              if (rect.top < 100) {
                closestAbove = heading.id
              }
            }
          }
          if (closestAbove) {
            setActiveId(closestAbove)
          }
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: [0, 1],
      }
    )
    
    headingElements.forEach((el) => {
      observerRef.current?.observe(el)
    })
    
    return () => {
      observerRef.current?.disconnect()
    }
  }, [headings, contentRef])

  // Scroll to heading and update URL
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      // Update URL with hash
      window.history.pushState(null, "", `#${id}`)
      // Scroll to element with small offset
      element.scrollIntoView({ behavior: "smooth", block: "start" })
      setActiveId(id)
    }
  }

  // Toggle collapse state
  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    onVisibilityChange?.(!newState)
  }

  if (headings.length === 0) {
    return null
  }

  // Find the minimum heading level to normalize indentation
  const minLevel = Math.min(...headings.map((h) => h.level))

  return (
    <nav
      className={cn(
        "relative",
        className
      )}
      aria-label="Table of contents"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">On this page</h2>
        {collapsible && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Show table of contents" : "Hide table of contents"}
          >
            {isCollapsed ? (
              <List className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* ToC List - scrollable only when content overflows */}
      {!isCollapsed && (
        <ul className="space-y-1 text-sm max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
            {headings.map((heading) => {
              const indent = heading.level - minLevel
              const isActive = activeId === heading.id
              
              return (
                <li key={heading.id}>
                  <button
                    onClick={() => scrollToHeading(heading.id)}
                    className={cn(
                      "w-full text-left py-1 px-2 rounded-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      isActive
                        ? "text-primary font-medium border-l-2 border-primary bg-primary/5"
                        : "text-muted-foreground border-l-2 border-transparent",
                    )}
                    style={{
                      paddingLeft: `${8 + indent * 12}px`,
                    }}
                  >
                    <span className="line-clamp-2">{heading.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
      )}
    </nav>
  )
}

/**
 * Mobile ToC trigger button
 */
interface TocTriggerProps {
  onClick: () => void
  isOpen: boolean
  className?: string
}

export function TocTrigger({ onClick, isOpen, className }: TocTriggerProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("gap-2", className)}
      aria-label={isOpen ? "Close table of contents" : "Open table of contents"}
    >
      <List className="h-4 w-4" />
      <span className="sr-only md:not-sr-only">Contents</span>
      <ChevronRight
        className={cn(
          "h-4 w-4 transition-transform",
          isOpen && "rotate-90"
        )}
      />
    </Button>
  )
}

