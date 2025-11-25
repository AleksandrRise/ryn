"use client"

import Link from "next/link"
import type { AuditEvent } from "@/lib/types/audit"
import { formatRelativeTime } from "@/lib/utils/date"

interface RecentActivityListProps {
  events: AuditEvent[]
}

const DISPLAY_MAP: Record<string, { icon: string; color: string }> = {
  scan_completed: { icon: "scan", color: "bg-blue-500" },
  fix_applied: { icon: "fix", color: "bg-green-500" },
  violation_detected: { icon: "violation", color: "bg-red-500" },
  violation_dismissed: { icon: "violation", color: "bg-yellow-500" },
}

export function RecentActivityList({ events }: RecentActivityListProps) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Recent Activity</h3>
        <Link href="/audit" className="text-xs text-white/60 hover:text-white transition-colors">
          View All
        </Link>
      </div>
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-4">
            <i className="las la-inbox text-2xl text-white/20 mb-2"></i>
            <p className="text-sm text-white/40">No recent activity</p>
          </div>
        ) : (
          events.map((event) => {
            const mapped = DISPLAY_MAP[event.eventType] || DISPLAY_MAP.scan_completed
            return (
              <div key={event.id} className="group cursor-pointer">
                <div className="flex items-start gap-3 pb-4 border-b border-white/5 last:border-0">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${mapped.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 group-hover:text-white transition-colors truncate">
                      {event.description}
                    </p>
                    <p className="text-xs text-white/40 mt-1">{formatRelativeTime(event.createdAt)}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
