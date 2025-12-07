"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

interface BreadcrumbContextValue {
  /** Custom label to display for the current detail page */
  detailLabel: string | null
  /** Set a custom label for the current detail page (e.g., person name) */
  setDetailLabel: (label: string | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [detailLabel, setDetailLabelState] = useState<string | null>(null)

  const setDetailLabel = useCallback((label: string | null) => {
    setDetailLabelState(label)
  }, [])

  return (
    <BreadcrumbContext.Provider value={{ detailLabel, setDetailLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext)
  if (!context) {
    throw new Error("useBreadcrumb must be used within a BreadcrumbProvider")
  }
  return context
}

/**
 * Hook to use in detail pages to set the breadcrumb label
 * Automatically clears the label when the component unmounts
 */
export function useBreadcrumbLabel(label: string | null | undefined) {
  const { setDetailLabel } = useBreadcrumb()
  
  // Set label on mount/change, clear on unmount
  useEffect(() => {
    setDetailLabel(label ?? null)
    return () => setDetailLabel(null)
  }, [label, setDetailLabel])
}

