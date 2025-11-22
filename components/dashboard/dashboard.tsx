"use client"

import { useState, useRef, useEffect } from "react"
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

// Platform configuration
const PLATFORMS = [
  { id: "github", name: "GitHub", laIcon: "lab la-github", available: true },
  { id: "aws", name: "AWS", laIcon: "lab la-aws", available: false },
  { id: "azure", name: "Azure", laIcon: "lab la-microsoft", available: false },
  { id: "gcp", name: "Google Cloud", laIcon: "lab la-google", available: false },
] as const

// All available repos from GitHub (mock)
const ALL_GITHUB_REPOS = [
  { id: 1, name: "api-server", fullName: "acme/api-server", language: "TypeScript", stars: 234, isPrivate: false },
  { id: 2, name: "web-dashboard", fullName: "acme/web-dashboard", language: "React", stars: 89, isPrivate: false },
  { id: 3, name: "auth-service", fullName: "acme/auth-service", language: "Go", stars: 156, isPrivate: true },
  { id: 4, name: "payment-gateway", fullName: "acme/payment-gateway", language: "Python", stars: 312, isPrivate: true },
  { id: 5, name: "mobile-app", fullName: "acme/mobile-app", language: "Swift", stars: 78, isPrivate: false },
  { id: 6, name: "analytics-engine", fullName: "acme/analytics-engine", language: "Rust", stars: 445, isPrivate: true },
]

// Mock data
const MOCK_REPOS = [
  { id: 1, name: "api-server", fullName: "acme/api-server", language: "TypeScript", lastScan: "2h ago", violations: 12, critical: 2, high: 4, status: "critical" as const, branch: "main" },
  { id: 2, name: "web-dashboard", fullName: "acme/web-dashboard", language: "React", lastScan: "5h ago", violations: 3, critical: 0, high: 1, status: "warning" as const, branch: "main" },
  { id: 3, name: "auth-service", fullName: "acme/auth-service", language: "Go", lastScan: "1d ago", violations: 0, critical: 0, high: 0, status: "healthy" as const, branch: "main" },
  { id: 4, name: "payment-gateway", fullName: "acme/payment-gateway", language: "Python", lastScan: "3h ago", violations: 8, critical: 1, high: 2, status: "critical" as const, branch: "main" },
]

const MOCK_ACTIVITY = [
  { id: 1, repo: "api-server", message: "12 violations found", time: "2h ago", severity: "critical" },
  { id: 2, repo: "web-dashboard", message: "Auto-fix applied", time: "3h ago", severity: "success" },
  { id: 3, repo: "payment-gateway", message: "8 violations found", time: "3h ago", severity: "critical" },
  { id: 4, repo: "web-dashboard", message: "3 violations found", time: "5h ago", severity: "warning" },
]

const MOCK_TREND = [
  { date: "Mon", violations: 42, fixed: 8 },
  { date: "Tue", violations: 38, fixed: 12 },
  { date: "Wed", violations: 45, fixed: 15 },
  { date: "Thu", violations: 36, fixed: 18 },
  { date: "Fri", violations: 28, fixed: 22 },
  { date: "Sat", violations: 24, fixed: 6 },
  { date: "Sun", violations: 23, fixed: 4 },
]

export function Dashboard() {
  const router = useRouter()
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashboard_connected") === "true"
    }
    return false
  })
  const [selectedPlatform, setSelectedPlatform] = useState<typeof PLATFORMS[number]>(PLATFORMS[0])
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false)
  const [repoManagerOpen, setRepoManagerOpen] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<number[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard_repos")
      return saved ? JSON.parse(saved) : [1, 2, 3, 4]
    }
    return [1, 2, 3, 4]
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem("dashboard_connected", String(isConnected))
  }, [isConnected])

  useEffect(() => {
    localStorage.setItem("dashboard_repos", JSON.stringify(selectedRepos))
  }, [selectedRepos])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPlatformDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const trackedRepos = isConnected ? MOCK_REPOS.filter(r => selectedRepos.includes(r.id)) : []
  const totalViolations = trackedRepos.reduce((sum, r) => sum + r.violations, 0)
  const criticalCount = trackedRepos.reduce((sum, r) => sum + r.critical, 0)
  const healthyCount = trackedRepos.filter(r => r.status === "healthy").length

  return (
    <>
      <main className="px-6 pt-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-5">
              {/* Platform Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                  className="flex items-center gap-3 pl-3 pr-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <i className={`${selectedPlatform.laIcon} text-lg`}></i>
                  </div>
                  <span className="text-sm font-medium">{selectedPlatform.name}</span>
                  <i className={`las la-angle-down text-xs text-white/40 ml-1 transition-transform ${platformDropdownOpen ? "rotate-180" : ""}`}></i>
                </button>

                {platformDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-[#12121a] backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden z-50 animate-fadeIn">
                    <div className="p-1.5">
                      {PLATFORMS.map((platform) => {
                        const isSelected = platform.id === selectedPlatform.id
                        return (
                          <button
                            key={platform.id}
                            onClick={() => {
                              if (platform.available) {
                                setSelectedPlatform(platform)
                                setPlatformDropdownOpen(false)
                              }
                            }}
                            disabled={!platform.available}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                              isSelected ? "bg-white/10" : platform.available ? "hover:bg-white/[0.06]" : "opacity-40 cursor-not-allowed"
                            }`}
                          >
                            <i className={`${platform.laIcon} text-base`}></i>
                            <span className="flex-1 text-left">{platform.name}</span>
                            {!platform.available && <span className="text-[10px] text-white/30 uppercase tracking-wider">Soon</span>}
                            {isSelected && <i className="las la-check text-emerald-400 text-sm"></i>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div>
                <h1 className="text-xl font-semibold tracking-tight">Compliance Overview</h1>
                <p className="text-xs text-white/40 mt-0.5">
                  {isConnected ? `${trackedRepos.length} repositories monitored` : "Connect to start monitoring"}
                </p>
              </div>
            </div>
          </div>

          {/* Top Section: Stats + Chart side by side */}
          <div className="grid grid-cols-12 gap-5 mb-5">
            {/* Stats Column - Vertical stack */}
            <div className="col-span-3 flex flex-col gap-3">
              {/* Repositories */}
              <div className="flex-1 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-blue-500/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <i className="las la-layer-group text-lg text-blue-400"></i>
                  </div>
                  <span className="text-xs text-white/30 uppercase tracking-wider">Repos</span>
                </div>
                <div className="text-3xl font-bold">{trackedRepos.length}</div>
              </div>

              {/* Violations */}
              <div className="flex-1 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-amber-500/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <i className="las la-exclamation-triangle text-lg text-amber-400"></i>
                  </div>
                  <span className="text-xs text-white/30 uppercase tracking-wider">Issues</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{totalViolations}</span>
                  {isConnected && <span className="text-xs text-emerald-400">-18%</span>}
                </div>
              </div>

              {/* Critical */}
              <div className="flex-1 bg-gradient-to-br from-red-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-red-500/20 transition-colors relative">
                {isConnected && criticalCount > 0 && (
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <i className="las la-radiation text-lg text-red-400"></i>
                  </div>
                  <span className="text-xs text-white/30 uppercase tracking-wider">Critical</span>
                </div>
                <div className="text-3xl font-bold">{criticalCount}</div>
              </div>

              {/* Healthy */}
              <div className="flex-1 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-emerald-500/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <i className="las la-shield-alt text-lg text-emerald-400"></i>
                  </div>
                  <span className="text-xs text-white/30 uppercase tracking-wider">Healthy</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{healthyCount}</span>
                  {isConnected && <span className="text-xs text-white/30">/{trackedRepos.length}</span>}
                </div>
              </div>
            </div>

            {/* Chart - Large - With connection CTA when not connected */}
            <div
              className={`col-span-9 relative rounded-2xl overflow-hidden transition-all duration-300 border ${
                !isConnected
                  ? "bg-gradient-to-br from-emerald-400/[0.12] via-emerald-500/[0.04] to-transparent border-emerald-500/10 hover:border-emerald-500/25 cursor-pointer group/card"
                  : "bg-[#08080c]/80 border-white/[0.05]"
              }`}
              onClick={!isConnected ? () => setRepoManagerOpen(true) : undefined}
            >
              {/* Shimmer animation background when not connected */}
              {!isConnected && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/[0.08] to-transparent shimmer-bg" />
                  <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/[0.1] rounded-full blur-[100px] pointer-events-none transition-all duration-500 group-hover/card:bg-emerald-400/[0.15]" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/[0.06] rounded-full blur-[80px] pointer-events-none" />
                </>
              )}

              {/* Background for connected state - subtle grid pattern */}
              {isConnected && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] via-transparent to-blue-500/[0.02]" />
                  <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/[0.04] rounded-full blur-[60px] pointer-events-none" />
                  {/* Subtle grid overlay */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                </>
              )}

              <div className="relative p-6 h-full">
                {isConnected && (
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-base font-semibold">Weekly Trend</h2>
                      <p className="text-xs text-white/40 mt-0.5">Violations over time</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-5 text-xs text-white/50">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span>Found</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Fixed</span>
                      </div>
                      <button
                        onClick={() => setRepoManagerOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/60 hover:text-white transition-all border border-white/[0.04]"
                      >
                        <i className="las la-cog"></i>
                        <span>Manage Repos</span>
                      </button>
                    </div>
                  </div>
                )}

                {isConnected ? (
                  <div className="animate-fadeIn">
                    {/* Chart */}
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_TREND} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                          <defs>
                            <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(248,113,113)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="rgb(248,113,113)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="fixGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(52,211,153)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="rgb(52,211,153)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "rgba(13,13,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                          />
                          <Area type="monotone" dataKey="violations" stroke="rgb(248,113,113)" strokeWidth={2.5} fill="url(#violGrad)" />
                          <Area type="monotone" dataKey="fixed" stroke="rgb(52,211,153)" strokeWidth={2.5} fill="url(#fixGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Summary stats below chart */}
                    <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-white/90">{MOCK_TREND.reduce((sum, d) => sum + d.violations, 0)}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Total Found</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-emerald-400">{MOCK_TREND.reduce((sum, d) => sum + d.fixed, 0)}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Fixed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-white/90">{Math.round(MOCK_TREND.reduce((sum, d) => sum + d.fixed, 0) / MOCK_TREND.reduce((sum, d) => sum + d.violations, 0) * 100)}%</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Fix Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-amber-400">~2.4h</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Avg Fix Time</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[300px] flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center text-center w-full transition-transform duration-300 group-hover/card:scale-[1.02]">
                      {/* Icon with glow */}
                      <div className="relative w-14 h-14 mb-4 mx-auto">
                        <div className="absolute inset-0 rounded-xl bg-emerald-400/30 blur-lg transition-all duration-300 group-hover/card:bg-emerald-400/40" />
                        <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 border border-emerald-400/30 flex items-center justify-center transition-all duration-300 group-hover/card:border-emerald-400/50">
                          <i className="lab la-github text-2xl text-emerald-300 transition-all duration-300 group-hover/card:text-emerald-200"></i>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-1.5 transition-colors duration-300 group-hover/card:text-emerald-100">Connect Your Repositories</h3>
                      <p className="text-sm text-white/40 mb-5 leading-relaxed max-w-xs mx-auto">
                        Link your GitHub account to monitor SOC 2 compliance
                      </p>
                      <div className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-sm font-medium transition-all duration-300 group-hover/card:bg-emerald-400 group-hover/card:shadow-lg group-hover/card:shadow-emerald-500/25 mx-auto">
                        <i className="lab la-github text-lg"></i>
                        Connect GitHub
                        <i className="las la-arrow-right text-sm transition-all duration-300 opacity-0 -translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0"></i>
                      </div>
                      <p className="mt-3 text-xs text-white/30">Read-only access · Secure OAuth</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section: Activity + Repositories Table */}
          <div className="grid grid-cols-12 gap-5">
            {/* Activity Feed */}
            <div className="col-span-4 bg-gradient-to-br from-purple-500/[0.08] to-transparent rounded-2xl p-5 border border-white/[0.04]">
              <h2 className="text-sm font-medium mb-4">Recent Activity</h2>
              {isConnected ? (
                <div className="space-y-3">
                  {MOCK_ACTIVITY.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-200 animate-slideIn"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        item.severity === "critical" ? "bg-red-400" :
                        item.severity === "success" ? "bg-emerald-400" :
                        "bg-amber-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">
                          <span className="font-medium">{item.repo}</span>
                          <span className="text-white/30 mx-1.5">·</span>
                          <span className="text-white/50">{item.message}</span>
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                    <i className="las la-history text-xl text-white/20"></i>
                  </div>
                  <p className="text-xs text-white/40">No activity yet</p>
                </div>
              )}
            </div>

            {/* Repositories Table */}
            <div className="col-span-8 bg-gradient-to-br from-white/[0.04] to-transparent rounded-2xl overflow-hidden border border-white/[0.04]">
              <div className="px-5 py-4 flex items-center justify-between">
                <h2 className="text-sm font-medium">Tracked Repositories</h2>
                {isConnected && trackedRepos.length > 0 && (
                  <div className="flex gap-1 text-xs">
                    <button className="px-3 py-1.5 rounded-lg bg-white/[0.08]">All</button>
                    <button className="px-3 py-1.5 rounded-lg text-white/40 hover:bg-white/[0.04] transition-colors">Critical</button>
                    <button className="px-3 py-1.5 rounded-lg text-white/40 hover:bg-white/[0.04] transition-colors">Healthy</button>
                  </div>
                )}
              </div>

              {isConnected && trackedRepos.length > 0 ? (
                <div className="px-2 pb-2">
                  {trackedRepos.map((repo, index) => (
                    <div
                      key={repo.id}
                      onClick={() => router.push("/scan")}
                      className="px-4 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] cursor-pointer transition-all duration-200 rounded-xl mx-1 mb-1 animate-slideIn"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                        repo.status === "critical" ? "bg-red-400" :
                        repo.status === "warning" ? "bg-amber-400" :
                        "bg-emerald-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{repo.name}</span>
                          <span className="text-xs text-white/30">{repo.fullName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                          <span>{repo.language}</span>
                          <span>{repo.branch}</span>
                          <span>{repo.lastScan}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {repo.critical > 0 && (
                          <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-xs text-red-400">{repo.critical} critical</span>
                        )}
                        {repo.high > 0 && (
                          <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-xs text-orange-400">{repo.high} high</span>
                        )}
                        {repo.violations === 0 && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-xs text-emerald-400">Clean</span>
                        )}
                      </div>
                      <div className="w-12 text-right">
                        <div className="text-lg font-semibold">{repo.violations}</div>
                        <div className="text-[10px] text-white/30 uppercase">issues</div>
                      </div>
                      <i className="las la-angle-right text-white/20"></i>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <i className="lab la-github text-2xl text-white/20"></i>
                  </div>
                  <p className="text-sm text-white/40 mb-3">No repositories tracked</p>
                  <button onClick={() => setRepoManagerOpen(true)} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                    Connect GitHub to get started
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Repository Manager Modal */}
      {repoManagerOpen && (
        <RepoManagerModal
          isConnected={isConnected}
          selectedRepos={selectedRepos}
          onSelectRepos={setSelectedRepos}
          onConnect={() => {
            setIsConnected(true)
            // Set default repos when connecting if none selected
            if (selectedRepos.length === 0) {
              setSelectedRepos([1, 2, 3, 4])
            }
            setRepoManagerOpen(false)
          }}
          onDisconnect={() => { setIsConnected(false); setSelectedRepos([]); setRepoManagerOpen(false) }}
          onClose={() => setRepoManagerOpen(false)}
        />
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes shimmerBg {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }

        .shimmer-bg {
          animation: shimmerBg 3s ease-in-out infinite;
        }

        @keyframes borderGlow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes particleFloat {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translate(20px, -30px) scale(1.5);
            opacity: 0.6;
          }
        }

        .glow-border {
          background: linear-gradient(90deg,
            rgba(16, 185, 129, 0.5),
            rgba(6, 182, 212, 0.5),
            rgba(16, 185, 129, 0.5),
            rgba(6, 182, 212, 0.5),
            rgba(16, 185, 129, 0.5)
          );
          background-size: 300% 100%;
          animation: borderGlow 4s ease infinite;
        }

        .glow-card {
          box-shadow:
            0 0 60px rgba(16, 185, 129, 0.15),
            0 0 100px rgba(6, 182, 212, 0.1);
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
          opacity: 0;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.6), rgba(6, 182, 212, 0.6));
          animation: particleFloat 4s ease-in-out infinite;
        }

        .particle-1 {
          top: 20%;
          left: 15%;
          animation-delay: 0s;
        }

        .particle-2 {
          top: 60%;
          left: 80%;
          animation-delay: 1s;
        }

        .particle-3 {
          top: 40%;
          left: 30%;
          animation-delay: 2s;
        }

        .particle-4 {
          top: 70%;
          left: 60%;
          animation-delay: 3s;
        }

        .particle-5 {
          top: 30%;
          left: 70%;
          animation-delay: 1.5s;
        }

        .particle-6 {
          top: 80%;
          left: 25%;
          animation-delay: 2.5s;
        }
      `}</style>
    </>
  )
}

function RepoManagerModal({
  isConnected, selectedRepos, onSelectRepos, onConnect, onDisconnect, onClose,
}: {
  isConnected: boolean
  selectedRepos: number[]
  onSelectRepos: (repos: number[]) => void
  onConnect: () => void
  onDisconnect: () => void
  onClose: () => void
}) {
  const [localSelected, setLocalSelected] = useState<number[]>(selectedRepos)
  const allSelected = localSelected.length === ALL_GITHUB_REPOS.length

  const langColors: Record<string, string> = {
    TypeScript: "bg-blue-500", React: "bg-cyan-500", Go: "bg-cyan-400",
    Python: "bg-yellow-500", Rust: "bg-orange-500", Swift: "bg-orange-400",
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#12121a] rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <i className="lab la-github text-xl"></i>
            </div>
            <div>
              <h2 className="font-semibold">Repository Manager</h2>
              <p className="text-xs text-white/40">{isConnected ? "Select repositories" : "Connect GitHub"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
            <i className="las la-times text-white/40"></i>
          </button>
        </div>

        <div className="px-6 pb-6">
          {!isConnected ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center animate-float">
                <i className="lab la-github text-4xl text-emerald-400"></i>
              </div>
              <h3 className="font-semibold mb-2">Connect GitHub</h3>
              <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
                Monitor your repositories for SOC 2 compliance violations.
              </p>
              <button onClick={onConnect} className="group relative px-6 py-3 rounded-xl font-medium text-sm overflow-hidden transition-all duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center gap-2 text-white">
                  <i className="lab la-github text-lg"></i>
                  Connect with GitHub
                </span>
              </button>
              <p className="mt-4 text-xs text-white/30">Read-only access</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-white/50">{localSelected.length} selected</span>
                <button onClick={() => setLocalSelected(allSelected ? [] : ALL_GITHUB_REPOS.map(r => r.id))} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ALL_GITHUB_REPOS.map((repo, index) => {
                  const selected = localSelected.includes(repo.id)
                  return (
                    <button
                      key={repo.id}
                      onClick={() => setLocalSelected(prev => prev.includes(repo.id) ? prev.filter(r => r !== repo.id) : [...prev, repo.id])}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left animate-slideIn ${
                        selected ? "bg-emerald-500/10" : "bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${selected ? "bg-gradient-to-r from-emerald-500 to-cyan-500" : "bg-white/10"}`}>
                        {selected && <i className="las la-check text-xs text-white"></i>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{repo.name}</span>
                          {repo.isPrivate && <span className="text-[10px] text-white/30 uppercase">Private</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                          <span>{repo.fullName}</span>
                          <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${langColors[repo.language] || "bg-gray-500"}`}></span>{repo.language}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-white/[0.02] flex items-center justify-between">
          {isConnected ? (
            <>
              <button onClick={onDisconnect} className="text-sm text-red-400 hover:text-red-300 transition-colors">Disconnect</button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={() => { onSelectRepos(localSelected); onClose() }} className="bg-gradient-to-r from-emerald-500 to-cyan-500 border-0">Save</Button>
              </div>
            </>
          ) : (
            <button onClick={onClose} className="ml-auto text-sm text-white/50 hover:text-white/70 transition-colors">Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}
