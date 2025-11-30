"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

/**
 * Tab definition
 */
export interface ResourceTab {
  id: string
  label: string
  content: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

/**
 * ResourceLayout props
 */
export interface ResourceLayoutProps {
  tabs: ResourceTab[]
  defaultTab?: string
  toolbar?: React.ReactNode
  className?: string
  onTabChange?: (tabId: string) => void
}

/**
 * Standard resource layout with tabs (Overview, List, Detail, History, etc.)
 */
export function ResourceLayout({
  tabs,
  defaultTab,
  toolbar,
  className,
  onTabChange,
}: ResourceLayoutProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id || "")
  
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    onTabChange?.(value)
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between gap-4 border-b">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                disabled={tab.disabled}
                className="gap-2"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* Toolbar */}
          {toolbar && <div className="flex items-center gap-2 pb-2">{toolbar}</div>}
        </div>
        
        {/* Tab Content */}
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

