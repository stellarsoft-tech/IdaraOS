"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

interface BreadcrumbContextValue {
  /** Custom label to display for the current detail page */
  detailLabel: string | null
  /** Custom label to display for the parent segment (e.g., entity name when on a sub-page) */
  parentLabel: string | null
  /** Set a custom label for the current detail page (e.g., person name) */
  setDetailLabel: (label: string | null) => void
  /** Set a custom label for the parent segment */
  setParentLabel: (label: string | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [detailLabel, setDetailLabelState] = useState<string | null>(null)
  const [parentLabel, setParentLabelState] = useState<string | null>(null)

  const setDetailLabel = useCallback((label: string | null) => {
    setDetailLabelState(label)
  }, [])

  const setParentLabel = useCallback((label: string | null) => {
    setParentLabelState(label)
  }, [])

  return (
    <BreadcrumbContext.Provider value={{ detailLabel, setDetailLabel, parentLabel, setParentLabel }}>
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

/**
 * Hook to use in sub-pages to set both the parent and current breadcrumb labels
 * For example: /templates/[id]/designer where [id] should show template name
 * and "designer" should show "Designer"
 */
export function useBreadcrumbLabels(parentLabel: string | null | undefined, detailLabel: string | null | undefined) {
  const { setDetailLabel, setParentLabel } = useBreadcrumb()
  
  useEffect(() => {
    setParentLabel(parentLabel ?? null)
    setDetailLabel(detailLabel ?? null)
    return () => {
      setParentLabel(null)
      setDetailLabel(null)
    }
  }, [parentLabel, detailLabel, setParentLabel, setDetailLabel])
}

