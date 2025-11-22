"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { SiGithub } from "react-icons/si"

// Mock data - will be replaced with real GitHub API data
const MOCK_REPOS = [
  {
    id: 1,
    name: "api-server",
    fullName: "acme/api-server",
    language: "TypeScript",
    lastScan: "2 hours ago",
    violations: 12,
    critical: 2,
    high: 4,
    status: "critical" as const,
    branch: "main",
    stars: 234,
  },
  {
    id: 2,
    name: "web-dashboard",
    fullName: "acme/web-dashboard",
    language: "React",
    lastScan: "5 hours ago",
    violations: 3,
    critical: 0,
    high: 1,
    status: "warning" as const,
    branch: "main",
    stars: 89,
  },
  {
    id: 3,
    name: "auth-service",
    fullName: "acme/auth-service",
    language: "Go",
    lastScan: "1 day ago",
    violations: 0,
    critical: 0,
    high: 0,
    status: "healthy" as const,
    branch: "main",
    stars: 156,
  },
]

const MOCK_ACTIVITY = [
  { id: 1, type: "scan", repo: "api-server", message: "Scan completed - 12 violations found", time: "2 hours ago", severity: "critical" },
  { id: 2, type: "fix", repo: "web-dashboard", message: "Auto-fix applied for SQL injection vulnerability", time: "3 hours ago", severity: "success" },
  { id: 3, type: "scan", repo: "web-dashboard", message: "Scan completed - 3 violations found", time: "5 hours ago", severity: "warning" },
  { id: 4, type: "connect", repo: "auth-service", message: "Repository connected to monitoring", time: "1 day ago", severity: "info" },
]

const MOCK_TREND = [
  { date: "Mon", violations: 28 },
  { date: "Tue", violations: 24 },
  { date: "Wed", violations: 31 },
  { date: "Thu", violations: 22 },
  { date: "Fri", violations: 18 },
  { date: "Sat", violations: 15 },
  { date: "Today", violations: 15 },
]

export function Dashboard() {
  const router = useRouter()
  const [isConnected, setIsConnected] = useState(true) // Mock connected state
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing">("idle")

  const totalViolations = MOCK_REPOS.reduce((sum, r) => sum + r.violations, 0)
  const criticalCount = MOCK_REPOS.reduce((sum, r) => sum + r.critical, 0)
  const reposAtRisk = MOCK_REPOS.filter(r => r.status === "critical" || r.status === "warning").length

  const handleSync = () => {
    setSyncStatus("syncing")
    setTimeout(() => setSyncStatus("idle"), 2000)
  }

  if (!isConnected) {
    return <GitHubConnectScreen onConnect={() => setIsConnected(true)} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d14] to-[#0a0a0f]">
      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAxIiBkPSJNMCAwaDYwdjYwSDB6Ii8+PHBhdGggZD0iTTYwIDBIMHY2MCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-50" />

      <div className="relative px-8 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
                <SiGithub className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">GitHub Compliance</h1>
            </div>
            <p className="text-sm text-white/40">
              Monitoring {MOCK_REPOS.length} repositories for SOC 2 compliance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncStatus === "syncing"}
              className="gap-2"
            >
              <i className={`las la-sync ${syncStatus === "syncing" ? "animate-spin" : ""}`}></i>
              {syncStatus === "syncing" ? "Syncing..." : "Sync All"}
            </Button>
            <Button size="sm" className="gap-2">
              <i className="las la-plus"></i>
              Add Repository
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Violations"
            value={totalViolations}
            trend={-13}
            icon="la-exclamation-circle"
            gradient="from-red-500/20 via-red-500/5 to-transparent"
            iconColor="text-red-400"
          />
          <StatCard
            label="Critical Issues"
            value={criticalCount}
            trend={-2}
            icon="la-radiation"
            gradient="from-orange-500/20 via-orange-500/5 to-transparent"
            iconColor="text-orange-400"
          />
          <StatCard
            label="Repos at Risk"
            value={reposAtRisk}
            subtitle={`of ${MOCK_REPOS.length}`}
            icon="la-shield-alt"
            gradient="from-yellow-500/20 via-yellow-500/5 to-transparent"
            iconColor="text-yellow-400"
          />
          <StatCard
            label="Compliance Score"
            value={87}
            suffix="%"
            trend={5}
            icon="la-chart-line"
            gradient="from-emerald-500/20 via-emerald-500/5 to-transparent"
            iconColor="text-emerald-400"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Trend Chart */}
          <div className="col-span-2 bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide">Violation Trend</h2>
                  <p className="text-xs text-white/30 mt-1">Last 7 days across all repositories</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">-46% this week</span>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_TREND} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(168 85 247)" stopOpacity={0.4} />
                        <stop offset="50%" stopColor="rgb(168 85 247)" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="rgb(168 85 247)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        padding: "12px 16px",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: "6px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="violations"
                      stroke="rgb(168 85 247)"
                      strokeWidth={2.5}
                      fill="url(#trendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide">Activity</h2>
                <button className="text-xs text-white/40 hover:text-white/60 transition-colors">View all</button>
              </div>
              <div className="space-y-4">
                {MOCK_ACTIVITY.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Repositories */}
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide">Tracked Repositories</h2>
              <span className="px-2 py-0.5 bg-white/5 rounded-full text-xs text-white/40">{MOCK_REPOS.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg transition-all">
                All
              </button>
              <button className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg">
                At Risk
              </button>
              <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg transition-all">
                Healthy
              </button>
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {MOCK_REPOS.map((repo) => (
              <RepoRow key={repo.id} repo={repo} onClick={() => router.push("/scan")} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GitHubConnectScreen({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d14] to-[#0a0a0f] flex items-center justify-center">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px]" />
      </div>
      <div className="relative text-center max-w-lg px-8">
        <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
          <SiGithub className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          Connect GitHub
        </h1>
        <p className="text-white/50 mb-10 text-lg leading-relaxed">
          Link your GitHub account to automatically monitor your repositories for SOC 2 compliance issues in real-time.
        </p>
        <Button onClick={onConnect} size="lg" className="gap-3 px-8 py-6 text-base">
          <SiGithub className="w-5 h-5" />
          Connect with GitHub
        </Button>
        <p className="mt-6 text-xs text-white/30">
          We only request read access to your repositories
        </p>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  trend,
  suffix,
  subtitle,
  icon,
  gradient,
  iconColor,
}: {
  label: string
  value: number
  trend?: number
  suffix?: string
  subtitle?: string
  icon: string
  gradient: string
  iconColor: string
}) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5`}>
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/[0.02] rounded-full blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${iconColor}`}>
            <i className={`las ${icon} text-xl`}></i>
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${trend > 0 ? "text-emerald-400" : "text-red-400"}`}>
              <i className={`las ${trend > 0 ? "la-arrow-up" : "la-arrow-down"} text-sm`}></i>
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="text-3xl font-bold tabular-nums mb-1">
          {value}{suffix}
        </div>
        <div className="text-xs text-white/40 uppercase tracking-wide">
          {label}
          {subtitle && <span className="text-white/25 ml-1">{subtitle}</span>}
        </div>
      </div>
    </div>
  )
}

function ActivityItem({ activity }: { activity: typeof MOCK_ACTIVITY[0] }) {
  const severityColors = {
    critical: "bg-red-500",
    warning: "bg-yellow-500",
    success: "bg-emerald-500",
    info: "bg-blue-500",
  }

  return (
    <div className="flex items-start gap-3 group">
      <div className={`mt-1.5 w-2 h-2 rounded-full ${severityColors[activity.severity as keyof typeof severityColors]} ring-4 ring-white/5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/70 leading-relaxed">
          <span className="font-medium text-white/90">{activity.repo}</span>
          <span className="mx-1.5 text-white/30">·</span>
          {activity.message}
        </p>
        <p className="text-xs text-white/30 mt-1">{activity.time}</p>
      </div>
    </div>
  )
}

function RepoRow({ repo, onClick }: { repo: typeof MOCK_REPOS[0]; onClick: () => void }) {
  const statusConfig = {
    critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-500" },
    warning: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-500" },
    healthy: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-500" },
  }

  const config = statusConfig[repo.status]
  const langColors: Record<string, string> = {
    TypeScript: "bg-blue-500",
    React: "bg-cyan-500",
    Go: "bg-cyan-400",
    Python: "bg-yellow-500",
    Rust: "bg-orange-500",
  }

  return (
    <div
      onClick={onClick}
      className="px-6 py-5 flex items-center gap-5 hover:bg-white/[0.02] cursor-pointer transition-all duration-200 group"
    >
      {/* Status */}
      <div className={`w-3 h-3 rounded-full ${config.dot} ring-4 ring-white/5`} />

      {/* Repo Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-semibold text-white/90 group-hover:text-white transition-colors">{repo.name}</span>
          <span className="text-xs text-white/30">{repo.fullName}</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${langColors[repo.language] || "bg-gray-500"}`} />
            <span className="text-xs text-white/40">{repo.language}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <i className="las la-code-branch"></i>
            {repo.branch}
          </span>
          <span className="flex items-center gap-1">
            <i className="las la-star"></i>
            {repo.stars}
          </span>
          <span>Last scan {repo.lastScan}</span>
        </div>
      </div>

      {/* Violations */}
      <div className="flex items-center gap-4">
        {repo.critical > 0 && (
          <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
            {repo.critical} critical
          </span>
        )}
        {repo.high > 0 && (
          <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-400 font-medium">
            {repo.high} high
          </span>
        )}
        {repo.violations === 0 && (
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 font-medium">
            All clear
          </span>
        )}
      </div>

      {/* Total */}
      <div className="w-20 text-right">
        <div className="text-lg font-bold tabular-nums">{repo.violations}</div>
        <div className="text-xs text-white/30">violations</div>
      </div>

      {/* Arrow */}
      <i className="las la-angle-right text-xl text-white/20 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all"></i>
    </div>
  )
}
