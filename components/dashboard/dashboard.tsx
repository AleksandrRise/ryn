"use client"

import Link from "next/link"

export function Dashboard() {
  const complianceScore = 73
  const violations = {
    critical: 3,
    high: 5,
    medium: 8,
    low: 12,
  }

  const recentActivity = [
    { type: "scan", message: "Completed full scan", time: "2 minutes ago" },
    { type: "fix", message: "Applied fix to auth/views.py", time: "15 minutes ago" },
    { type: "violation", message: "New critical violation detected", time: "1 hour ago" },
    { type: "scan", message: "Started monitoring session", time: "3 hours ago" },
  ]

  return (
    <div className="px-8 py-12">
      <div className="mb-16 animate-fade-in-up">
        <h1 className="text-[72px] font-bold leading-none tracking-tighter mb-2">{complianceScore}% Compliant</h1>
        <p className="text-[14px] text-[#666]">28 violations found • Last scanned 2 minutes ago</p>
      </div>

      <div className="grid grid-cols-[1.5fr,1fr] gap-16">
        {/* Left column - Violations breakdown */}
        <div className="animate-fade-in-left delay-200">
          <h2 className="text-[13px] uppercase tracking-wider text-[#666] mb-6">Violations by Severity</h2>

          <div className="space-y-4">
            <div className="flex items-baseline justify-between py-3 border-b border-[#1a1a1a]">
              <span className="text-[14px]">Critical</span>
              <span className="text-[32px] font-bold text-[#ef4444] tabular-nums">{violations.critical}</span>
            </div>
            <div className="flex items-baseline justify-between py-3 border-b border-[#1a1a1a]">
              <span className="text-[14px]">High</span>
              <span className="text-[32px] font-bold text-[#f97316] tabular-nums">{violations.high}</span>
            </div>
            <div className="flex items-baseline justify-between py-3 border-b border-[#1a1a1a]">
              <span className="text-[14px]">Medium</span>
              <span className="text-[32px] font-bold text-[#eab308] tabular-nums">{violations.medium}</span>
            </div>
            <div className="flex items-baseline justify-between py-3 border-b border-[#1a1a1a]">
              <span className="text-[14px]">Low</span>
              <span className="text-[32px] font-bold text-[#525252] tabular-nums">{violations.low}</span>
            </div>
          </div>

          <Link href="/scan" className="inline-block mt-8 text-[13px] text-white hover:underline">
            View all violations →
          </Link>
        </div>

        {/* Right column - Recent activity */}
        <div className="animate-fade-in-right delay-300">
          <h2 className="text-[13px] uppercase tracking-wider text-[#666] mb-6">Recent Activity</h2>

          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={`${activity.type}-${activity.time}`} className="border-b border-[#0a0a0a] pb-4">
                <p className="text-[13px] mb-1">{activity.message}</p>
                <p className="text-[11px] text-[#404040]">{activity.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
