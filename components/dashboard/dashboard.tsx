"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/lib/stores/project-store"
import {
  get_scans,
  get_violations,
  get_audit_events,
  type Violation,
  type ScanResult,
  type AuditEvent,
} from "@/lib/tauri/commands"
import { handleTauriError } from "@/lib/utils/error-handler"

export function Dashboard() {
  const router = useRouter()
  const { selectedProject } = useProjectStore()
  const [isLoading, setIsLoading] = useState(true)
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [violations, setViolations] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  })
  const [recentActivity, setRecentActivity] = useState<AuditEvent[]>([])
  const [totalScansCount, setTotalScansCount] = useState(0)
  const [fixesAppliedCount, setFixesAppliedCount] = useState(0)

  const totalViolations = violations.critical + violations.high + violations.medium + violations.low

  // Calculate compliance score from violation counts
  const complianceScore = lastScan
    ? Math.max(0, Math.min(100, Math.round((1 - totalViolations / Math.max(1, lastScan.violations_found || totalViolations || 1)) * 100)))
    : 0

  // Track mouse position for each card
  const [mousePos, setMousePos] = useState<{ [key: string]: { x: number; y: number } }>({
    critical: { x: 50, y: 50 },
    high: { x: 50, y: 50 },
    medium: { x: 50, y: 50 },
    low: { x: 50, y: 50 },
  })

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>, card: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setMousePos(prev => ({ ...prev, [card]: { x, y } }))
  }

  // Load dashboard data on mount or when project changes
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!selectedProject) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)

        // Fetch latest scan for the project
        const scans = await get_scans(selectedProject.id)
        const latestScan = scans.length > 0 ? scans[0] : null
        setLastScan(latestScan)
        setTotalScansCount(scans.length)

        if (latestScan) {
          // Fetch violations from latest scan
          const allViolations = await get_violations(latestScan.id, {})

          // Count violations by severity
          const violationCounts = {
            critical: allViolations.filter(v => v.severity === "critical").length,
            high: allViolations.filter(v => v.severity === "high").length,
            medium: allViolations.filter(v => v.severity === "medium").length,
            low: allViolations.filter(v => v.severity === "low").length,
          }
          setViolations(violationCounts)
        }

        // Fetch recent audit events (limit to 4)
        const events = await get_audit_events({ limit: 4 })
        setRecentActivity(events)

        // Count fixes applied from audit events
        const fixEvents = events.filter(e => e.event_type === "fix_applied")
        setFixesAppliedCount(fixEvents.length)
      } catch (error) {
        handleTauriError(error, "Failed to load dashboard data")
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [selectedProject])

  // Format timestamp to relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffMs = now.getTime() - past.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
  }

  // Map event type to icon and message
  const getActivityDisplay = (event: AuditEvent) => {
    const typeMap: Record<string, { icon: string; color: string }> = {
      scan_completed: { icon: "scan", color: "bg-blue-500" },
      fix_applied: { icon: "fix", color: "bg-green-500" },
      violation_detected: { icon: "violation", color: "bg-red-500" },
      violation_dismissed: { icon: "violation", color: "bg-yellow-500" },
    }
    const display = typeMap[event.event_type] || { icon: "scan", color: "bg-blue-500" }
    return {
      type: display.icon,
      message: event.description,
      time: formatRelativeTime(event.created_at),
      color: display.color,
    }
  }

  const handleRunScan = () => {
    router.push("/scan")
  }

  const handleViewReport = () => {
    router.push("/audit")
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="px-8 py-8 max-w-[1800px] mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-white/70">Loading dashboard data...</span>
          </div>
        </div>
      </div>
    )
  }

  // Empty state when no project selected
  if (!selectedProject) {
    return (
      <div className="px-8 py-8 max-w-[1800px] mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <i className="las la-folder-open text-6xl text-white/20 mb-4"></i>
          <h2 className="text-2xl font-bold mb-2">No Project Selected</h2>
          <p className="text-white/60 mb-6">Select a project from the header to view compliance metrics</p>
          <Button onClick={() => router.push("/scan")} className="gap-2">
            <i className="las la-folder text-base"></i>
            Select Project
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      {/* Hero Section - Compliance Score */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-7xl font-bold leading-none tracking-tight mb-3 text-glow">
              {complianceScore}%
            </h1>
            <p className="text-lg text-white/60">SOC 2 Compliance Score</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleRunScan} size="lg" className="gap-2">
              <i className="las la-play text-base"></i>
              Run Scan
            </Button>
            <Button onClick={handleViewReport} size="lg" variant="outline" className="gap-2">
              <i className="las la-search text-base"></i>
              View Report
            </Button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-green-500 to-yellow-500 rounded-full transition-all duration-1000"
            style={{ width: `${complianceScore}%` }}
          />
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3 mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm font-medium text-white/70">{totalViolations} violations</span>
          </div>
          {lastScan && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
              <i className="las la-clock text-sm text-white/50"></i>
              <span className="text-sm font-medium text-white/50">{formatRelativeTime(lastScan.created_at || lastScan.started_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Layout - Bento Box Style */}
      <div className="grid grid-cols-12 gap-6">

        {/* Violations Cards - Takes 8 columns */}
        <div className="col-span-8 grid grid-cols-2 gap-5 animate-fade-in-left delay-100">

          {/* Critical Violations */}
          <Link
            href="/scan?severity=critical"
            className="group relative overflow-hidden bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/30 rounded-3xl p-8 hover:border-red-500/60 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]"
            onMouseMove={(e) => handleMouseMove(e, 'critical')}
          >
            {/* Cursor-following radial glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `radial-gradient(1600px circle at ${mousePos.critical.x}% ${mousePos.critical.y}%, rgba(239, 68, 68, 0.25), transparent 50%)`
              }}
            />

            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-red-500/15 rounded-xl group-hover:bg-red-500/25 transition-colors duration-300">
                  <i className="las la-exclamation-triangle text-xl text-red-400"></i>
                </div>
                <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">Critical</span>
              </div>

              <div className="mb-6">
                <div className="text-7xl font-extrabold text-red-400 tabular-nums leading-none mb-4 tracking-tighter">
                  {violations.critical}
                </div>
                <p className="text-base font-medium text-white/60 leading-relaxed tracking-wide">Immediate action required</p>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium text-red-400/70 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <i className="las la-arrow-right text-base"></i>
              </div>
            </div>
          </Link>

          {/* High Violations */}
          <Link
            href="/scan?severity=high"
            className="group relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/30 rounded-3xl p-8 hover:border-orange-500/60 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]"
            onMouseMove={(e) => handleMouseMove(e, 'high')}
          >
            {/* Cursor-following radial glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `radial-gradient(1600px circle at ${mousePos.high.x}% ${mousePos.high.y}%, rgba(249, 115, 22, 0.25), transparent 50%)`
              }}
            />

            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-orange-500/15 rounded-xl group-hover:bg-orange-500/25 transition-colors duration-300">
                  <i className="las la-shield-alt text-xl text-orange-400"></i>
                </div>
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-widest">High</span>
              </div>

              <div className="mb-6">
                <div className="text-7xl font-extrabold text-orange-400 tabular-nums leading-none mb-4 tracking-tighter">
                  {violations.high}
                </div>
                <p className="text-base font-medium text-white/60 leading-relaxed tracking-wide">Fix within 24 hours</p>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium text-orange-400/70 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <i className="las la-arrow-right text-base"></i>
              </div>
            </div>
          </Link>

          {/* Medium Violations */}
          <Link
            href="/scan?severity=medium"
            className="group relative overflow-hidden bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-3xl p-8 hover:border-yellow-500/60 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]"
            onMouseMove={(e) => handleMouseMove(e, 'medium')}
          >
            {/* Cursor-following radial glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `radial-gradient(1600px circle at ${mousePos.medium.x}% ${mousePos.medium.y}%, rgba(234, 179, 8, 0.25), transparent 50%)`
              }}
            />

            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-yellow-500/15 rounded-xl group-hover:bg-yellow-500/25 transition-colors duration-300">
                  <i className="las la-file-alt text-xl text-yellow-400"></i>
                </div>
                <span className="text-xs font-semibold text-yellow-400 uppercase tracking-widest">Medium</span>
              </div>

              <div className="mb-6">
                <div className="text-7xl font-extrabold text-yellow-400 tabular-nums leading-none mb-4 tracking-tighter">
                  {violations.medium}
                </div>
                <p className="text-base font-medium text-white/60 leading-relaxed tracking-wide">Fix within 7 days</p>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium text-yellow-400/70 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <i className="las la-arrow-right text-base"></i>
              </div>
            </div>
          </Link>

          {/* Low Violations */}
          <Link
            href="/scan?severity=low"
            className="group relative overflow-hidden bg-gradient-to-br from-gray-500/10 to-transparent border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]"
            onMouseMove={(e) => handleMouseMove(e, 'low')}
          >
            {/* Cursor-following radial glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `radial-gradient(1600px circle at ${mousePos.low.x}% ${mousePos.low.y}%, rgba(255, 255, 255, 0.15), transparent 50%)`
              }}
            />

            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                  <i className="las la-shield-alt text-xl text-white/60"></i>
                </div>
                <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">Low</span>
              </div>

              <div className="mb-6">
                <div className="text-7xl font-extrabold text-white/60 tabular-nums leading-none mb-4 tracking-tighter">
                  {violations.low}
                </div>
                <p className="text-base font-medium text-white/50 leading-relaxed tracking-wide">Address when possible</p>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium text-white/50 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <i className="las la-arrow-right text-base"></i>
              </div>
            </div>
          </Link>

        </div>

        {/* Right Column - Activity & Stats */}
        <div className="col-span-4 space-y-6 animate-fade-in-right delay-200">

          {/* Quick Stats */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">Performance</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Total Scans</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold tabular-nums">{totalScansCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Fixes Applied</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold tabular-nums">{fixesAppliedCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Open Violations</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold tabular-nums">{totalViolations}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Recent Activity</h3>
              <Link href="/audit" className="text-xs text-white/60 hover:text-white transition-colors">
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <div className="text-center py-4">
                  <i className="las la-inbox text-2xl text-white/20 mb-2"></i>
                  <p className="text-sm text-white/40">No recent activity</p>
                </div>
              ) : (
                recentActivity.map((event) => {
                  const display = getActivityDisplay(event)
                  return (
                    <div key={event.id} className="group cursor-pointer">
                      <div className="flex items-start gap-3 pb-4 border-b border-white/5 last:border-0">
                        <div className={`mt-0.5 w-2 h-2 rounded-full ${display.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 group-hover:text-white transition-colors truncate">
                            {display.message}
                          </p>
                          <p className="text-xs text-white/40 mt-1">{display.time}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Action Footer */}
      <Link
        href="/scan"
        className="mt-8 flex items-center justify-between p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl animate-fade-in-up delay-300 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group"
      >
        <div>
          <p className="font-semibold mb-1 group-hover:text-white transition-colors">Need help fixing violations?</p>
          <p className="text-sm text-white/60 group-hover:text-white/80 transition-colors">AI-powered fixes available for {violations.critical + violations.high} high-priority issues</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium group-hover:translate-x-1 transition-transform">
          <span>View All Violations</span>
          <i className="las la-arrow-right text-base"></i>
        </div>
      </Link>
    </div>
  )
}
