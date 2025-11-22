"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/lib/stores/project-store"
import { formatRelativeTime } from "@/lib/utils/date"

export function Dashboard() {
  const router = useRouter()
  const { selectedProject } = useProjectStore()
  const {
    isLoading,
    lastScan,
    severityCounts,
    totalScansCount,
    complianceScore,
    totalViolations,
    scanHistory,
  } = useDashboardData(selectedProject?.id)

  const handleRunScan = () => router.push("/scan")

  if (isLoading) {
    return (
      <div className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-white/70">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedProject) {
    return (
      <div className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <i className="las la-folder-open text-3xl text-white/30"></i>
          </div>
          <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
          <p className="text-sm text-white/50 mb-6">Select a project to view compliance metrics</p>
          <Button onClick={() => router.push("/scan")} size="sm">
            Select Project
          </Button>
        </div>
      </div>
    )
  }

  if (!lastScan && totalScansCount === 0) {
    return (
      <div className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <i className="las la-search text-3xl text-white/30"></i>
          </div>
          <h2 className="text-xl font-semibold mb-2">No Scans Yet</h2>
          <p className="text-sm text-white/50 mb-6">
            Run your first scan on <span className="text-white/80">{selectedProject.name}</span>
          </p>
          <Button onClick={handleRunScan} size="sm">
            Run First Scan
          </Button>
        </div>
      </div>
    )
  }

  const lastScanTimestamp = lastScan?.createdAt || lastScan?.startedAt
  const trend = scanHistory.length >= 2
    ? scanHistory[scanHistory.length - 1].violations - scanHistory[scanHistory.length - 2].violations
    : 0

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{selectedProject.name}</h1>
          {lastScanTimestamp && (
            <p className="text-xs text-white/40 mt-0.5">
              Last scan {formatRelativeTime(lastScanTimestamp)}
            </p>
          )}
        </div>
        <Button onClick={handleRunScan} size="sm">
          <i className="las la-play mr-1.5"></i>
          Run Scan
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Compliance Score */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/40 mb-1">Compliance</div>
          <div className="text-3xl font-bold tabular-nums">{complianceScore}%</div>
        </div>

        {/* Total Violations */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/40 mb-1">Violations</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{totalViolations}</span>
            {trend !== 0 && (
              <span className={`text-xs ${trend > 0 ? "text-red-400" : "text-green-400"}`}>
                {trend > 0 ? "+" : ""}{trend}
              </span>
            )}
          </div>
        </div>

        {/* Critical + High */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/40 mb-1">Critical & High</div>
          <div className="text-3xl font-bold tabular-nums text-red-400">
            {severityCounts.critical + severityCounts.high}
          </div>
        </div>

        {/* Total Scans */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/40 mb-1">Total Scans</div>
          <div className="text-3xl font-bold tabular-nums">{totalScansCount}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-4">
        {/* Chart */}
        <div className="col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/40 mb-4">Violation Trend</div>
          {scanHistory.length > 1 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scanHistory} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <defs>
                    <linearGradient id="violationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(239 68 68)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="rgb(239 68 68)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="violations"
                    stroke="rgb(239 68 68)"
                    strokeWidth={2}
                    fill="url(#violationGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-white/30 text-sm">
              Run more scans to see trends
            </div>
          )}
        </div>

        {/* Severity Breakdown */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/40 mb-4">By Severity</div>
          <div className="space-y-3">
            <SeverityRow label="Critical" count={severityCounts.critical} color="bg-red-500" href="/scan?severity=critical" />
            <SeverityRow label="High" count={severityCounts.high} color="bg-orange-500" href="/scan?severity=high" />
            <SeverityRow label="Medium" count={severityCounts.medium} color="bg-yellow-500" href="/scan?severity=medium" />
            <SeverityRow label="Low" count={severityCounts.low} color="bg-gray-500" href="/scan?severity=low" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {(severityCounts.critical > 0 || severityCounts.high > 0) && (
        <Link
          href="/scan"
          className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-xl hover:bg-red-500/10 hover:border-red-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <i className="las la-exclamation-triangle text-red-400"></i>
            </div>
            <div>
              <div className="text-sm font-medium">
                {severityCounts.critical + severityCounts.high} high-priority issues need attention
              </div>
              <div className="text-xs text-white/40">AI-powered fixes available</div>
            </div>
          </div>
          <i className="las la-arrow-right text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all"></i>
        </Link>
      )}
    </div>
  )
}

function SeverityRow({
  label,
  count,
  color,
  href,
}: {
  label: string
  count: number
  color: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-2 px-3 -mx-3 rounded-lg hover:bg-white/[0.03] transition-colors group"
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm text-white/70 group-hover:text-white/90">{label}</span>
      </div>
      <span className="text-sm font-medium tabular-nums">{count}</span>
    </Link>
  )
}
