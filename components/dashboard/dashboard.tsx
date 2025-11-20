"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { RecentActivityList } from "@/components/dashboard/recent-activity-list"
import { ViolationsGrid } from "@/components/dashboard/violations-grid"
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
    recentActivity,
    totalScansCount,
    fixesAppliedCount,
    complianceScore,
    totalViolations,
  } = useDashboardData(selectedProject?.id)

  const handleRunScan = () => router.push("/scan")
  const handleViewReport = () => router.push("/audit")

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

  if (!lastScan && totalScansCount === 0) {
    return (
      <div className="px-8 py-8 max-w-[1800px] mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <i className="las la-search text-6xl text-white/20 mb-4"></i>
          <h2 className="text-2xl font-bold mb-2">No Scans Yet</h2>
          <p className="text-white/60 mb-6">
            Run your first scan on <span className="text-white font-medium">{selectedProject.name}</span> to start monitoring SOC 2 compliance
          </p>
          <Button onClick={handleRunScan} size="lg" className="gap-2">
            <i className="las la-play text-base"></i>
            Run First Scan
          </Button>
        </div>
      </div>
    )
  }

  const lastScanTimestamp = lastScan?.createdAt || lastScan?.startedAt
  const isStale = lastScanTimestamp
    ? Math.floor((Date.now() - new Date(lastScanTimestamp).getTime()) / 3600000) >= 1
    : false

  return (
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-7xl font-bold leading-none tracking-tight mb-3 text-glow">
              {complianceScore}%
            </h1>
            <p className="text-lg text-white/60">SOC 2 Compliance Score</p>
            <p className="mt-1 text-xs text-white/50">
              Viewing project <span className="font-semibold">{selectedProject.name}</span>
            </p>
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

        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-green-500 to-yellow-500 rounded-full transition-all duration-1000"
            style={{ width: `${complianceScore}%` }}
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm font-medium text-white/70">{totalViolations} violations</span>
          </div>
          {lastScanTimestamp && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
              <i className="las la-clock text-sm text-white/50"></i>
              <span className="text-sm font-medium text-white/50">{formatRelativeTime(lastScanTimestamp)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <ViolationsGrid counts={severityCounts} />

        <div className="col-span-4 space-y-6 animate-fade-in-right delay-200">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">Performance</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Total Scans</span>
                <span className="text-xl font-bold tabular-nums">{totalScansCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Fixes Applied</span>
                <span className="text-xl font-bold tabular-nums">{fixesAppliedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Open Violations</span>
                <span className="text-xl font-bold tabular-nums">{totalViolations}</span>
              </div>
            </div>
          </div>

          <RecentActivityList events={recentActivity} />
        </div>
      </div>

      {isStale && (
        <Link
          href="/scan"
          className="mt-8 flex items-center justify-between p-6 bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/30 rounded-2xl animate-fade-in-up delay-300 hover:bg-yellow-500/15 hover:border-yellow-500/50 transition-all duration-300 cursor-pointer group"
        >
          <div>
            <p className="font-semibold mb-1 text-yellow-400 group-hover:text-yellow-300 transition-colors">
              Scan data is out of date
            </p>
            <p className="text-sm text-yellow-400/70 group-hover:text-yellow-400/90 transition-colors">
              Run a fresh scan to get the latest compliance data
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-400 group-hover:translate-x-1 transition-transform">
            <span>Rescan Now</span>
            <i className="las la-arrow-right text-base"></i>
          </div>
        </Link>
      )}

      <Link
        href="/scan"
        className="mt-8 flex items-center justify-between p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl animate-fade-in-up delay-300 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group"
      >
        <div>
          <p className="font-semibold mb-1 group-hover:text-white transition-colors">Need help fixing violations?</p>
          <p className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
            AI-powered fixes available for {severityCounts.critical + severityCounts.high} high-priority issues
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium group-hover:translate-x-1 transition-transform">
          <span>View All Violations</span>
          <i className="las la-arrow-right text-base"></i>
        </div>
      </Link>
    </div>
  )
}
