"use client"

import React, { useState, useRef, useEffect } from "react"
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
import {
  check_github_connection,
  disconnect_github,
  fetch_github_repos,
  get_github_repos,
  get_tracked_repos,
  track_repo,
  untrack_repo,
  check_repo_for_changes,
  scan_github_repo,
  type GitHubConnectionStatus,
  type GitHubRepo,
  type TrackedRepoWithDetails,
} from "@/lib/tauri/commands"
import { GitHubOAuthModal } from "./github-oauth-modal"
import { GitHubRepoManager } from "./github-repo-manager"

// Platform configuration
const PLATFORMS = [
  { id: "github", name: "GitHub", laIcon: "lab la-github", available: true },
  { id: "aws", name: "AWS", laIcon: "lab la-aws", available: false },
  { id: "azure", name: "Azure", laIcon: "lab la-microsoft", available: false },
  { id: "gcp", name: "Google Cloud", laIcon: "lab la-google", available: false },
] as const

export function Dashboard() {
  const router = useRouter()
  const [connectionStatus, setConnectionStatus] = useState<GitHubConnectionStatus | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<typeof PLATFORMS[number]>(PLATFORMS[0])
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false)
  const [repoManagerOpen, setRepoManagerOpen] = useState(false)
  const [oauthModalOpen, setOauthModalOpen] = useState(false)
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepoWithDetails[]>([])
  const [checkingRepos, setCheckingRepos] = useState<Set<number>>(new Set())
  const [repoChanges, setRepoChanges] = useState<Map<number, boolean>>(new Map())
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Check GitHub connection status on mount
  useEffect(() => {
    checkConnection()
  }, [])

  // Load tracked repos when connected
  useEffect(() => {
    if (connectionStatus?.connected) {
      loadTrackedRepos()
    }
  }, [connectionStatus?.connected])

  const checkConnection = async () => {
    try {
      const status = await check_github_connection()
      setConnectionStatus(status)
    } catch (error) {
      console.error("Failed to check GitHub connection:", error)
    }
  }

  const loadTrackedRepos = async () => {
    try {
      const repos = await get_tracked_repos()
      setTrackedRepos(repos)
    } catch (error) {
      console.error("Failed to load tracked repos:", error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect_github()
      setConnectionStatus({ connected: false, username: undefined, avatar_url: undefined, repo_count: 0, tracked_count: 0 })
      setTrackedRepos([])
    } catch (error) {
      console.error("Failed to disconnect:", error)
    }
  }

  const handleConnectClick = () => {
    if (connectionStatus?.connected) {
      setRepoManagerOpen(true)
    } else {
      setOauthModalOpen(true)
    }
  }

  const handleOAuthSuccess = async () => {
    await checkConnection()
    setOauthModalOpen(false)
    setRepoManagerOpen(true)
  }

  const handleRepoManagerSuccess = () => {
    loadTrackedRepos()
  }

  const handleCheckForUpdates = async (repoId: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation

    setCheckingRepos(prev => new Set(prev).add(repoId))

    try {
      const hasChanges = await check_repo_for_changes(repoId)
      setRepoChanges(prev => new Map(prev).set(repoId, hasChanges))

      // Reload repos to get updated last_checked_at timestamp
      await loadTrackedRepos()

      if (hasChanges) {
        console.log(`Repository ${repoId} has new commits`)
      }
    } catch (error) {
      console.error(`Failed to check repo ${repoId}:`, error)
    } finally {
      setCheckingRepos(prev => {
        const next = new Set(prev)
        next.delete(repoId)
        return next
      })
    }
  }

  const handleScanRepo = async (repoId: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation

    try {
      // Use default scan mode from settings, or 'smart' as fallback
      const scanId = await scan_github_repo(repoId, 'smart')
      console.log(`Started scan ${scanId} for repo ${repoId}`)

      // Clear the changes indicator
      setRepoChanges(prev => {
        const next = new Map(prev)
        next.delete(repoId)
        return next
      })

      // Reload repos to get updated scan info
      await loadTrackedRepos()
    } catch (error) {
      console.error(`Failed to scan repo ${repoId}:`, error)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPlatformDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const totalViolations = trackedRepos.reduce((sum, r) => sum + (r.total_violations || 0), 0)
  const criticalCount = trackedRepos.reduce((sum, r) => sum + (r.critical_violations || 0), 0)
  const healthyCount = trackedRepos.filter(r => (r.total_violations || 0) === 0).length

  const chartData = trackedRepos.map(repo => ({
    name: repo.github_repo.name,
    violations: repo.total_violations || 0,
    critical: repo.critical_violations || 0,
  }))

  const recentActivity = [...trackedRepos]
    .filter(r => r.last_scanned_at)
    .sort((a, b) => new Date(b.last_scanned_at || 0).getTime() - new Date(a.last_scanned_at || 0).getTime())
    .slice(0, 6)

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
                  {connectionStatus?.connected ? `${trackedRepos.length} repositories monitored` : "Connect to start monitoring"}
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
                  {connectionStatus?.connected && <span className="text-xs text-emerald-400">-18%</span>}
                </div>
              </div>

              {/* Critical */}
              <div className="flex-1 bg-gradient-to-br from-red-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-red-500/20 transition-colors relative">
                {connectionStatus?.connected && criticalCount > 0 && (
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
                  {connectionStatus?.connected && <span className="text-xs text-white/30">/{trackedRepos.length}</span>}
                </div>
              </div>
            </div>

            {/* Chart - Large - With connection CTA when not connected */}
            <div
              className={`col-span-9 relative rounded-2xl overflow-hidden transition-all duration-300 border ${
                !connectionStatus?.connected
                  ? "bg-gradient-to-br from-emerald-400/[0.12] via-emerald-500/[0.04] to-transparent border-emerald-500/10 hover:border-emerald-500/25 cursor-pointer group/card"
                  : "bg-[#08080c]/80 border-white/[0.05]"
              }`}
              onClick={!connectionStatus?.connected ? handleConnectClick : undefined}
            >
              {/* Shimmer animation background when not connected */}
              {!connectionStatus?.connected && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/[0.08] to-transparent shimmer-bg" />
                  <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/[0.1] rounded-full blur-[100px] pointer-events-none transition-all duration-500 group-hover/card:bg-emerald-400/[0.15]" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/[0.06] rounded-full blur-[80px] pointer-events-none" />
                </>
              )}

              {/* Background for connected state - subtle grid pattern */}
              {connectionStatus?.connected && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] via-transparent to-blue-500/[0.02]" />
                  <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/[0.04] rounded-full blur-[60px] pointer-events-none" />
                  {/* Subtle grid overlay */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                </>
              )}

              <div className="relative p-6 h-full">
                {connectionStatus?.connected && (
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
                        onClick={handleConnectClick}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/60 hover:text-white transition-all border border-white/[0.04]"
                      >
                        <i className="las la-cog"></i>
                        <span>Manage Repos</span>
                      </button>
                    </div>
                  </div>
                )}

                {connectionStatus?.connected ? (
                  <div className="animate-fadeIn">
                    {/* Chart */}
                    <div className="h-56">
                      {chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-white/50">
                          Scan a repo to see live findings
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                            <defs>
                              <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(248,113,113)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="rgb(248,113,113)" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(251,191,36)" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="rgb(251,191,36)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "rgba(13,13,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                              labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                            />
                            <Area type="monotone" dataKey="violations" stroke="rgb(248,113,113)" strokeWidth={2.5} fill="url(#violGrad)" name="Violations" />
                            <Area type="monotone" dataKey="critical" stroke="rgb(251,191,36)" strokeWidth={2.5} fill="url(#critGrad)" name="Critical" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Summary stats below chart */}
                    <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-white/90">{chartData.reduce((sum, d) => sum + d.violations, 0)}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Total Found</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-amber-300">{chartData.reduce((sum, d) => sum + d.critical, 0)}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Critical</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-white/90">{healthyCount}/{trackedRepos.length}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Clean Repos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-emerald-400">{trackedRepos.filter(r => !!r.last_scanned_at).length}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Scanned</div>
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
              {connectionStatus?.connected ? (
                <div className="space-y-3">
                  {recentActivity.length === 0 ? (
                    <div className="text-xs text-white/40">Scan a repository to see activity.</div>
                  ) : (
                    recentActivity.map((item, index) => {
                      const severity = (item.critical_violations || 0) > 0 ? "critical" : (item.total_violations || 0) > 0 ? "warning" : "success"
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-200 animate-slideIn"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            severity === "critical" ? "bg-red-400" :
                            severity === "success" ? "bg-emerald-400" :
                            "bg-amber-400"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80 truncate">
                              <span className="font-medium">{item.github_repo.name}</span>
                              <span className="text-white/30 mx-1.5">·</span>
                              <span className="text-white/50">Last scan {item.last_scanned_at ? new Date(item.last_scanned_at).toLocaleString() : "pending"}</span>
                            </p>
                            <p className="text-xs text-white/30 mt-0.5">{item.total_violations || 0} issues, {item.critical_violations || 0} critical</p>
                          </div>
                        </div>
                      )
                    })
                  )}
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
                {connectionStatus?.connected && trackedRepos.length > 0 && (
                  <div className="flex gap-1 text-xs">
                    <button className="px-3 py-1.5 rounded-lg bg-white/[0.08]">All</button>
                    <button className="px-3 py-1.5 rounded-lg text-white/40 hover:bg-white/[0.04] transition-colors">Critical</button>
                    <button className="px-3 py-1.5 rounded-lg text-white/40 hover:bg-white/[0.04] transition-colors">Healthy</button>
                  </div>
                )}
              </div>

              {connectionStatus?.connected && trackedRepos.length > 0 ? (
                <div className="px-2 pb-2">
                  {trackedRepos.map((repo, index) => {
                    const violations = repo.total_violations || 0
                    const critical = repo.critical_violations || 0
                    const status = critical > 0 ? "critical" : violations > 0 ? "warning" : "clean"
                    const isChecking = checkingRepos.has(repo.id)
                    const hasChanges = repoChanges.get(repo.id) === true

                    return (
                      <div
                        key={repo.id}
                        className="px-4 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-all duration-200 rounded-xl mx-1 mb-1 animate-slideIn"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                          status === "critical" ? "bg-red-400" :
                          status === "warning" ? "bg-amber-400" :
                          "bg-emerald-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{repo.github_repo.name}</span>
                            <span className="text-xs text-white/30">{repo.github_repo.full_name}</span>
                            {hasChanges && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-[10px] text-blue-400 font-medium">
                                New commits
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                            {repo.github_repo.language && <span>{repo.github_repo.language}</span>}
                            <span>{repo.github_repo.default_branch}</span>
                            {repo.last_scanned_at && <span>Last scan: {new Date(repo.last_scanned_at).toLocaleDateString()}</span>}
                            {/* Show last checked time */}
                            {repo.last_checked_at && (
                              <span className="text-white/30">
                                Checked: {new Date(repo.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {critical > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-xs text-red-400">{critical} critical</span>
                          )}
                          {violations === 0 && !hasChanges && (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-xs text-emerald-400">Clean</span>
                          )}

                          {/* Check for Updates button */}
                          <button
                            onClick={(e) => handleCheckForUpdates(repo.id, e)}
                            disabled={isChecking}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Check for new commits"
                          >
                            {isChecking ? (
                              <span className="flex items-center gap-1.5">
                                <i className="las la-sync animate-spin"></i>
                                Checking...
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <i className="las la-sync"></i>
                                Check
                              </span>
                            )}
                          </button>

                          {/* Scan button - shows when changes detected */}
                          {hasChanges && (
                            <button
                              onClick={(e) => handleScanRepo(repo.id, e)}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-xs text-blue-400 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <i className="las la-radar"></i>
                                Scan Now
                              </span>
                            </button>
                          )}
                        </div>
                        <div className="w-12 text-right">
                          <div className="text-lg font-semibold">{violations}</div>
                          <div className="text-[10px] text-white/30 uppercase">issues</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <i className="lab la-github text-2xl text-white/20"></i>
                  </div>
                  <p className="text-sm text-white/40 mb-3">No repositories tracked</p>
                  <button onClick={handleConnectClick} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                    Connect GitHub to get started
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* GitHub OAuth Modal */}
      {oauthModalOpen && (
        <GitHubOAuthModal
          onSuccess={handleOAuthSuccess}
          onClose={() => setOauthModalOpen(false)}
        />
      )}

      {/* GitHub Repository Manager Modal */}
      {repoManagerOpen && connectionStatus?.connected && (
        <GitHubRepoManager
          onSuccess={handleRepoManagerSuccess}
          onDisconnect={() => {
            handleDisconnect()
            setRepoManagerOpen(false)
          }}
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
