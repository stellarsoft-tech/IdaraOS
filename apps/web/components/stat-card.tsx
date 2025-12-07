import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    label: string
  }
}

export function StatCard({ title, value, description, icon: Icon, iconColor, trend }: StatCardProps) {
  const defaultIconColor = "text-muted-foreground"
  const iconBgColor = iconColor 
    ? iconColor.replace("text-", "bg-").replace("/10", "/10")
    : "bg-muted"
  
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <div className={`h-8 w-8 rounded-lg ${iconBgColor} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${iconColor || defaultIconColor}`} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && (
          <p className={`text-xs ${trend.value >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend.value >= 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
      {/* Gradient accent */}
      {iconColor && (
        <div
          className={`absolute top-0 right-0 w-24 h-24 opacity-10 ${iconBgColor}`}
          style={{
            background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
          }}
        />
      )}
    </Card>
  )
}
