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
      color: "text-red-400",
      bg: "bg-red-500/15 border border-red-500/30",
      icon: ShieldAlert,
    },
    high: {
      label: "High",
      color: "text-orange-400",
      bg: "bg-orange-500/15 border border-orange-500/30",
      icon: AlertTriangle,
    },
    medium: {
      label: "Medium",
      color: "text-yellow-400",
      bg: "bg-yellow-500/15 border border-yellow-500/30",
      icon: AlertCircle,
    },
    low: {
      label: "Low",
      color: "text-white/60",
      bg: "bg-white/10 border border-white/15",
      icon: Info,
    },
  }

  const { label, color, bg, icon: Icon } = config[severity]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${bg}`}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={color}>{label}</span>
    </span>
  )
}
