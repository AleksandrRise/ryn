"use client"

import { AuditEventCard } from "./audit-event-card"

interface AuditTimelineProps {
  selectedEventType: string
  dateRange: { start: string; end: string }
}

interface AuditEvent {
  id: number
  type: "scan" | "violation" | "fix"
  timestamp: string
  description: string
  details: Record<string, any>
}

// Mock data
const mockEvents: AuditEvent[] = [
  {
    id: 1,
    type: "scan",
    timestamp: new Date().toISOString(),
    description: "Full project scan completed",
    details: {
      filesScanned: 147,
      violationsFound: 18,
      duration: "2.3s",
    },
  },
  {
    id: 2,
    type: "fix",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    description: "Applied fix for CC6.7 violation",
    details: {
      filePath: "config/settings.py",
      lineNumber: 47,
      fixType: "Environment variable migration",
    },
  },
  {
    id: 3,
    type: "violation",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    description: "Critical violation detected: Hardcoded API key",
    details: {
      severity: "critical",
      controlId: "CC6.7",
      filePath: "config/settings.py",
    },
  },
  {
    id: 4,
    type: "scan",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    description: "Incremental scan on file change",
    details: {
      filesScanned: 1,
      violationsFound: 0,
      duration: "0.4s",
    },
  },
  {
    id: 5,
    type: "fix",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    description: "Applied fix for CC7.2 violation",
    details: {
      filePath: "auth/login.py",
      lineNumber: 89,
      fixType: "Added logging for authentication events",
    },
  },
]

export function AuditTimeline({ selectedEventType, dateRange }: AuditTimelineProps) {
  const filteredEvents = mockEvents.filter((event) => {
    if (selectedEventType !== "all" && event.type !== selectedEventType) {
      return false
    }
    // Date range filtering would go here
    return true
  })

  if (filteredEvents.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <p className="text-muted-foreground">No audit events found matching your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filteredEvents.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
            {index < filteredEvents.length - 1 && <div className="w-px h-full bg-border mt-2" />}
          </div>

          {/* Event card */}
          <div className="flex-1 pb-8">
            <AuditEventCard event={event} />
          </div>
        </div>
      ))}
    </div>
  )
}
