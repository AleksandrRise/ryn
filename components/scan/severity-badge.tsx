"use client"

import { ShieldAlert, AlertTriangle, AlertCircle, Info } from "lucide-react"
import type { Severity } from "@/lib/types/violation"

interface SeverityBadgeProps {
  severity: Severity
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = {
    critical: {
      label: "Critical",
      color: "text-danger",
      bg: "bg-danger-bg",
      icon: ShieldAlert,
    },
    high: {
      label: "High",
      color: "text-warning",
      bg: "bg-warning-bg",
      icon: AlertTriangle,
    },
    medium: {
      label: "Medium",
      color: "text-primary",
      bg: "bg-primary-bg",
      icon: AlertCircle,
    },
    low: {
      label: "Low",
      color: "text-muted-foreground",
      bg: "bg-accent",
      icon: Info,
    },
  }

  const { label, color, bg, icon: Icon } = config[severity]

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bg}`}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  )
}
