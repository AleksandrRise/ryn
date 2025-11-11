"use client"

import { useState } from "react"
import { ScanSearch, ShieldAlert, Check, ChevronDown, ChevronUp } from "lucide-react"

interface AuditEvent {
  id: number
  type: "scan" | "violation" | "fix"
  timestamp: string
  description: string
  details: Record<string, any>
}

interface AuditEventCardProps {
  event: AuditEvent
}

export function AuditEventCard({ event }: AuditEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const iconConfig = {
    scan: { icon: ScanSearch, color: "text-primary", bg: "bg-primary-bg" },
    violation: { icon: ShieldAlert, color: "text-danger", bg: "bg-danger-bg" },
    fix: { icon: Check, color: "text-success", bg: "bg-success-bg" },
  }

  const { icon: Icon, color, bg } = iconConfig[event.type]

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 60) return `${minutes} minutes ago`
    if (hours < 24) return `${hours} hours ago`
    return date.toLocaleString()
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{event.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(event.timestamp)}</p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border">
            <dl className="space-y-2">
              {Object.entries(event.details).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</dt>
                  <dd className="text-foreground font-medium font-mono">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
