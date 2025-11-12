"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, FileSearch, Shield, AlertTriangle } from "lucide-react"

export function Dashboard() {
  const complianceScore = 73
  const violations = {
    critical: 3,
    high: 5,
    medium: 8,
    low: 12,
  }
  const totalViolations = violations.critical + violations.high + violations.medium + violations.low

  const recentActivity = [
    { type: "scan", message: "Completed full scan", time: "2 minutes ago" },
    { type: "fix", message: "Applied fix to auth/views.py", time: "15 minutes ago" },
    { type: "violation", message: "New critical violation detected", time: "1 hour ago" },
    { type: "scan", message: "Started monitoring session", time: "3 hours ago" },
  ]

  const stats = [
    { label: "Total Scans", value: "142", change: "+12%", trend: "up" },
    { label: "Fixes Applied", value: "89", change: "+8%", trend: "up" },
    { label: "Avg Fix Time", value: "4.2m", change: "-15%", trend: "down" },
  ]

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
            <Button size="lg" className="gap-2">
              <Play className="w-4 h-4" />
              Run Scan
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              <FileSearch className="w-4 h-4" />
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
        <p className="text-sm text-white/40 mt-3">{totalViolations} violations found • Last scanned 2 minutes ago</p>
      </div>

      {/* Main Grid Layout - Bento Box Style */}
      <div className="grid grid-cols-12 gap-6">

        {/* Violations Cards - Takes 8 columns */}
        <div className="col-span-8 grid grid-cols-2 gap-5 animate-fade-in-left delay-100">

          {/* Critical Violations */}
          <Link href="/scan?severity=critical" className="group relative overflow-hidden bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/30 rounded-3xl p-8 hover:border-red-500/60 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-red-500/15 rounded-xl group-hover:bg-red-500/25 transition-colors duration-300">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-[11px] font-bold text-red-400/80 uppercase tracking-[0.15em]">Critical</span>
              </div>

              <div className="mb-4">
                <div className="text-6xl font-bold text-red-400 tabular-nums leading-none mb-3 group-hover:scale-105 transition-transform duration-300">
                  {violations.critical}
                </div>
                <p className="text-sm text-white/50 leading-relaxed">Immediate action required</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-red-400/60 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Link>

          {/* High Violations */}
          <Link href="/scan?severity=high" className="group relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/30 rounded-3xl p-8 hover:border-orange-500/60 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-orange-500/15 rounded-xl group-hover:bg-orange-500/25 transition-colors duration-300">
                  <Shield className="w-5 h-5 text-orange-400" />
                </div>
                <span className="text-[11px] font-bold text-orange-400/80 uppercase tracking-[0.15em]">High</span>
              </div>

              <div className="mb-4">
                <div className="text-6xl font-bold text-orange-400 tabular-nums leading-none mb-3 group-hover:scale-105 transition-transform duration-300">
                  {violations.high}
                </div>
                <p className="text-sm text-white/50 leading-relaxed">Fix within 24 hours</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-orange-400/60 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Link>

          {/* Medium Violations */}
          <Link href="/scan?severity=medium" className="group relative overflow-hidden bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-3xl p-8 hover:border-yellow-500/60 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-yellow-500/15 rounded-xl group-hover:bg-yellow-500/25 transition-colors duration-300">
                  <FileSearch className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="text-[11px] font-bold text-yellow-400/80 uppercase tracking-[0.15em]">Medium</span>
              </div>

              <div className="mb-4">
                <div className="text-6xl font-bold text-yellow-400 tabular-nums leading-none mb-3 group-hover:scale-105 transition-transform duration-300">
                  {violations.medium}
                </div>
                <p className="text-sm text-white/50 leading-relaxed">Fix within 7 days</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-yellow-400/60 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Link>

          {/* Low Violations */}
          <Link href="/scan?severity=low" className="group relative overflow-hidden bg-gradient-to-br from-gray-500/10 to-transparent border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                  <Shield className="w-5 h-5 text-white/60" />
                </div>
                <span className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em]">Low</span>
              </div>

              <div className="mb-4">
                <div className="text-6xl font-bold text-white/60 tabular-nums leading-none mb-3 group-hover:scale-105 transition-transform duration-300">
                  {violations.low}
                </div>
                <p className="text-sm text-white/40 leading-relaxed">Address when possible</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-white/40 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                <span>View details</span>
                <ArrowRight className="w-3.5 h-3.5" />
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
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <span className="text-sm text-white/70">{stat.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold tabular-nums">{stat.value}</span>
                    <span className={`text-xs font-medium ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
              ))}
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
              {recentActivity.map((activity, i) => (
                <div key={`${activity.type}-${activity.time}`} className="group cursor-pointer">
                  <div className="flex items-start gap-3 pb-4 border-b border-white/5">
                    <div className={`mt-0.5 w-2 h-2 rounded-full ${
                      activity.type === 'violation' ? 'bg-red-500' :
                      activity.type === 'fix' ? 'bg-green-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 group-hover:text-white transition-colors truncate">
                        {activity.message}
                      </p>
                      <p className="text-xs text-white/40 mt-1">{activity.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Action Footer */}
      <div className="mt-8 flex items-center justify-between p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl animate-fade-in-up delay-300">
        <div>
          <p className="font-semibold mb-1">Need help fixing violations?</p>
          <p className="text-sm text-white/60">AI-powered fixes available for {violations.critical + violations.high} high-priority issues</p>
        </div>
        <Link href="/scan">
          <Button size="lg" className="gap-2">
            View All Violations
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
