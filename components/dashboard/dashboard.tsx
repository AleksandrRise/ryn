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
import { useDashboardData, type ProjectHealth } from "@/components/dashboard/use-dashboard-data"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/lib/stores/project-store"
import { formatRelativeTime } from "@/lib/utils/date"

export function Dashboard() {
  const router = useRouter()
  const { setSelectedProject } = useProjectStore()
  const {
    isLoading,
    totalProjects,
    totalViolations,
    totalScans,
    severityCounts,
    projectHealthList,
    scanTrend,
  } = useDashboardData()

  const handleSelectProject = (health: ProjectHealth) => {
    setSelectedProject(health.project)
    router.push("/scan")
  }

  if (isLoading) {
    return (
      <div className="px-8 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-white/5 rounded-xl border border-white/10">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-sm text-white/60">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (totalProjects === 0) {
    return (
      <div className="px-8 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
            <i className="las la-folder-plus text-4xl text-white/40"></i>
          </div>
          <h2 className="text-2xl font-semibold mb-3">No Projects Yet</h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Add your first project to start monitoring SOC 2 compliance across your codebase.
          </p>
          <Button onClick={() => router.push("/scan")} size="lg">
            <i className="las la-plus mr-2"></i>
            Add Project
          </Button>
        </div>
      </div>
    )
  }

  const criticalProjects = projectHealthList.filter(p => p.status === "critical").length
  const warningProjects = projectHealthList.filter(p => p.status === "warning").length
  const healthyProjects = projectHealthList.filter(p => p.status === "healthy").length

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Compliance Overview</h1>
        <p className="text-sm text-white/50">
          Monitoring {totalProjects} project{totalProjects !== 1 ? "s" : ""} for SOC 2 compliance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Total Violations"
          value={totalViolations}
          icon="la-exclamation-circle"
          color={totalViolations > 0 ? "text-red-400" : "text-green-400"}
        />
        <StatCard
          label="Critical"
          value={severityCounts.critical}
          icon="la-exclamation-triangle"
          color="text-red-500"
        />
        <StatCard
          label="High"
          value={severityCounts.high}
          icon="la-shield-alt"
          color="text-orange-400"
        />
        <StatCard
          label="Medium + Low"
          value={severityCounts.medium + severityCounts.low}
          icon="la-info-circle"
          color="text-yellow-400"
        />
        <StatCard
          label="Total Scans"
          value={totalScans}
          icon="la-search"
          color="text-blue-400"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Trend Chart */}
        <div className="col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide">Violation Trend</h2>
            <span className="text-xs text-white/40">Last 10 scans</span>
          </div>
          {scanTrend.length > 1 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scanTrend} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="violationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(239 68 68)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="rgb(239 68 68)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      fontSize: "12px",
                      padding: "10px 14px",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}
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
            <div className="h-52 flex items-center justify-center text-white/30 text-sm">
              Run more scans to see violation trends
            </div>
          )}
        </div>

        {/* Project Health Summary */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-6">Project Health</h2>
          <div className="space-y-4">
            <HealthRow label="Critical Issues" count={criticalProjects} total={totalProjects} color="bg-red-500" />
            <HealthRow label="Warnings" count={warningProjects} total={totalProjects} color="bg-orange-500" />
            <HealthRow label="Healthy" count={healthyProjects} total={totalProjects} color="bg-green-500" />
          </div>
          <div className="mt-6 pt-6 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Projects monitored</span>
              <span className="font-semibold">{totalProjects}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide">All Projects</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/scan")}>
            <i className="las la-plus mr-1.5"></i>
            Add Project
          </Button>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {projectHealthList.map((health) => (
            <ProjectRow
              key={health.project.id}
              health={health}
              onSelect={() => handleSelectProject(health)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: string
  color: string
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <i className={`las ${icon} text-lg ${color}`}></i>
        <span className="text-xs text-white/40 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function HealthRow({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/70">{label}</span>
        <span className="text-sm font-medium tabular-nums">{count}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function ProjectRow({
  health,
  onSelect,
}: {
  health: ProjectHealth
  onSelect: () => void
}) {
  const statusConfig = {
    critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", label: "Critical" },
    warning: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", label: "Warning" },
    healthy: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", label: "Healthy" },
    "no-scans": { bg: "bg-white/5", border: "border-white/10", text: "text-white/40", label: "No Scans" },
  }

  const config = statusConfig[health.status]

  return (
    <div
      onClick={onSelect}
      className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] cursor-pointer transition-colors group"
    >
      {/* Status Indicator */}
      <div className={`w-2 h-2 rounded-full ${health.status === "critical" ? "bg-red-500" : health.status === "warning" ? "bg-orange-500" : health.status === "healthy" ? "bg-green-500" : "bg-white/20"}`} />

      {/* Project Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-medium truncate">{health.project.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.border} border ${config.text}`}>
            {config.label}
          </span>
        </div>
        <div className="text-xs text-white/40 mt-0.5 truncate">
          {health.lastScanDate ? `Last scan ${formatRelativeTime(health.lastScanDate)}` : "Never scanned"}
        </div>
      </div>

      {/* Violation Counts */}
      <div className="flex items-center gap-4 text-xs">
        {health.criticalCount > 0 && (
          <span className="text-red-400 font-medium">{health.criticalCount} critical</span>
        )}
        {health.highCount > 0 && (
          <span className="text-orange-400 font-medium">{health.highCount} high</span>
        )}
        {health.totalViolations > 0 && health.criticalCount === 0 && health.highCount === 0 && (
          <span className="text-yellow-400 font-medium">{health.totalViolations} issues</span>
        )}
        {health.totalViolations === 0 && health.scanCount > 0 && (
          <span className="text-green-400 font-medium">No issues</span>
        )}
      </div>

      {/* Scan Count */}
      <div className="text-xs text-white/30 w-20 text-right">
        {health.scanCount} scan{health.scanCount !== 1 ? "s" : ""}
      </div>

      {/* Arrow */}
      <i className="las la-angle-right text-white/20 group-hover:text-white/40 transition-colors"></i>
    </div>
  )
}
