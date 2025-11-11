"use client"

import { ScanSearch, Check, ShieldAlert } from "lucide-react"

export function RecentActivity() {
  // Mock data
  const activities = [
    {
      id: 1,
      type: "scan",
      message: "Scan completed",
      timestamp: "2 minutes ago",
      icon: ScanSearch,
    },
    {
      id: 2,
      type: "fix",
      message: "Fixed CC6.7 violation",
      timestamp: "15 minutes ago",
      icon: Check,
    },
    {
      id: 3,
      type: "violation",
      message: "New critical violation detected",
      timestamp: "1 hour ago",
      icon: ShieldAlert,
    },
  ]

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Activity</h3>

      <div className="space-y-3">
        {activities.map((activity) => {
          const Icon = activity.icon

          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="mt-0.5">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{activity.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.timestamp}</p>
              </div>
            </div>
          )
        })}
      </div>

      <button className="w-full mt-4 pt-4 border-t border-border text-sm text-primary hover:text-primary-hover transition-colors">
        View All Activity
      </button>
    </div>
  )
}
