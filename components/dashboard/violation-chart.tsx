"use client"

import { memo, useMemo } from "react"
import { ShieldAlert, AlertTriangle, AlertCircle, Info } from "lucide-react"

export const ViolationChart = memo(function ViolationChart() {
  // Mock data
  const violations = {
    critical: 3,
    high: 5,
    medium: 8,
    low: 2,
  }

  const total = Object.values(violations).reduce((sum, count) => sum + count, 0)

  const severityConfig = useMemo(() => [
    {
      key: "critical",
      label: "Critical",
      count: violations.critical,
      color: "bg-danger",
      icon: ShieldAlert,
    },
    {
      key: "high",
      label: "High",
      count: violations.high,
      color: "bg-warning",
      icon: AlertTriangle,
    },
    {
      key: "medium",
      label: "Medium",
      count: violations.medium,
      color: "bg-primary",
      icon: AlertCircle,
    },
    {
      key: "low",
      label: "Low",
      count: violations.low,
      color: "bg-muted-foreground",
      icon: Info,
    },
  ], [violations.critical, violations.high, violations.medium, violations.low])

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Violations by Severity</h3>

      <div className="space-y-3">
        {severityConfig.map((severity) => {
          const Icon = severity.icon
          const percentage = total > 0 ? (severity.count / total) * 100 : 0

          return (
            <div key={severity.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{severity.label}</span>
                </div>
                <span className="font-medium text-foreground">{severity.count}</span>
              </div>
              <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full ${severity.color} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Violations</span>
          <span className="text-foreground font-medium">{total}</span>
        </div>
      </div>
    </div>
  )
})
