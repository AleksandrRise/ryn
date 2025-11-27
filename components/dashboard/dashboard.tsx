"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"
import {
  check_github_connection,
  disconnect_github,
  get_tracked_repos,
  check_repo_for_changes,
  scan_github_repo,
  create_project,
  get_projects,
  get_scan_progress,
  get_settings,
  type GitHubConnectionStatus,
  type TrackedRepoWithDetails,
} from "@/lib/tauri/commands"
import { useProjectStore } from "@/lib/stores/project-store"
import { GitHubOAuthModal } from "./github-oauth-modal"
import { GitHubRepoManager } from "./github-repo-manager"
import { useRouter } from "next/navigation"

// Platform configuration
const PLATFORMS = [
  { id: "github", name: "GitHub", laIcon: "lab la-github", available: true },
  { id: "aws", name: "AWS", laIcon: "lab la-aws", available: false },
  { id: "azure", name: "Azure", laIcon: "lab la-microsoft", available: false },
  { id: "gcp", name: "Google Cloud", laIcon: "lab la-google", available: false },
] as const

const AUTO_POLL_INTERVAL_MS = 90_000
const isActivationKey = (event: React.KeyboardEvent) =>
  event.key === "Enter" || event.key === " "

export function Dashboard() {
  const router = useRouter()
  const { setSelectedProject } = useProjectStore()
  const [connectionStatus, setConnectionStatus] = useState<GitHubConnectionStatus | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<typeof PLATFORMS[number]>(PLATFORMS[0])
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false)
  const [repoManagerOpen, setRepoManagerOpen] = useState(false)
  const [oauthModalOpen, setOauthModalOpen] = useState(false)
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepoWithDetails[]>([])
  const [repoFilter, setRepoFilter] = useState<"all" | "critical" | "healthy">("all")
  const [checkingRepos, setCheckingRepos] = useState<Set<number>>(new Set())
  const [scanningRepos, setScanningRepos] = useState<Set<number>>(new Set())
  const [repoChanges, setRepoChanges] = useState<Map<number, boolean>>(new Map())
  const [repoForProject, setRepoForProject] = useState<TrackedRepoWithDetails | null>(null)
  const [projectModalError, setProjectModalError] = useState<string | null>(null)
  const [projectModalLoading, setProjectModalLoading] = useState(false)
  const [lastAutoCheck, setLastAutoCheck] = useState<Date | null>(null)
  const [defaultScanMode, setDefaultScanMode] = useState<string>("smart")
  const projectModalRunId = useRef(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const latestReposRef = useRef<TrackedRepoWithDetails[]>([])
  const prevRepoIdsRef = useRef<Set<number>>(new Set())
  const hasInitializedTrackedRef = useRef(false)
  const checkingReposRef = useRef<Set<number>>(new Set())
  const scanningReposRef = useRef<Set<number>>(new Set())
  const autoPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoPollingRef = useRef(false)

  const checkConnection = useCallback(async () => {
    try {
      const status = await check_github_connection()
      setConnectionStatus(status)
    } catch (error) {
      console.error("Failed to check GitHub connection:", error)
    }
  }, [])

  const loadTrackedRepos = useCallback(async () => {
    try {
      const repos = await get_tracked_repos()
      setTrackedRepos(repos)
      latestReposRef.current = repos
    } catch (error) {
      console.error("Failed to load tracked repos:", error)
    }
  }, [])

  // Check GitHub connection status on mount
  useEffect(() => {
    void checkConnection()
  }, [checkConnection])

  // Load tracked repos when connected
  useEffect(() => {
    if (connectionStatus?.connected) {
      void loadTrackedRepos()
    }
  }, [connectionStatus?.connected, loadTrackedRepos])

  useEffect(() => {
    const loadScanModeSetting = async () => {
      try {
        const settings = await get_settings()
        const mode = settings.find((s) => s.key === "llm_scan_mode")?.value
        if (mode) {
          setDefaultScanMode(mode)
        }
      } catch (error) {
        console.warn("Failed to load scan mode setting", error)
      }
    }
    void loadScanModeSetting()
  }, [])

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

  const waitForScanCompletion = async (scanId: number) => {
    const start = Date.now()
    const timeoutMs = 120_000
    while (Date.now() - start < timeoutMs) {
      try {
        const progress = await get_scan_progress(scanId)
        if (progress.status !== "in_progress" && progress.status !== "queued") {
          return progress
        }
      } catch (err) {
        console.warn(`Polling scan ${scanId} failed`, err)
      }
      await new Promise((res) => setTimeout(res, 1500))
    }
    throw new Error("Scan did not complete in time")
  }

  const runScanForRepo = useCallback(async (repoId: number, reason: string, waitForCompletion = false) => {
    setScanningRepos(prev => {
      const next = new Set(prev)
      next.add(repoId)
      scanningReposRef.current = next
      return next
    })
    try {
      const scanId = await scan_github_repo(repoId, defaultScanMode)
      if (waitForCompletion) {
        await waitForScanCompletion(scanId)
      }
      setRepoChanges(prev => {
        const next = new Map(prev)
        next.delete(repoId)
        return next
      })
      await loadTrackedRepos()
      console.log(`Scan started for repo ${repoId} (${reason})`)
      return scanId
    } catch (error) {
      console.error(`Failed to scan repo ${repoId} (${reason}):`, error)
      throw error
    } finally {
      setScanningRepos(prev => {
        const next = new Set(prev)
        next.delete(repoId)
        scanningReposRef.current = next
        return next
      })
    }
  }, [defaultScanMode, loadTrackedRepos])

  const checkRepoAndFlag = useCallback(async (repoId: number) => {
    const hasChanges = await check_repo_for_changes(repoId)
    setRepoChanges(prev => {
      const next = new Map(prev)
      next.set(repoId, hasChanges)
      return next
    })
    return hasChanges
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPlatformDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Keep latest repos reference for background polling
  useEffect(() => {
    latestReposRef.current = trackedRepos
  }, [trackedRepos])

  // Background polling: keep data fresh and auto-scan when commits change
  useEffect(() => {
    if (!connectionStatus?.connected) {
      if (autoPollTimerRef.current) {
        clearTimeout(autoPollTimerRef.current)
      }
      autoPollingRef.current = false
      return
    }

    let cancelled = false

    const pollTrackedRepos = async () => {
      if (cancelled || autoPollingRef.current) return
      autoPollingRef.current = true

      try {
        const repos = latestReposRef.current
        if (repos.length === 0) {
          setLastAutoCheck(new Date())
          return
        }

        let scanned = false

        for (const repo of repos) {
          if (cancelled) break
          if (scanningReposRef.current.has(repo.id) || checkingReposRef.current.has(repo.id)) {
            continue
          }

          setCheckingRepos(prev => {
            const next = new Set(prev)
            next.add(repo.id)
            checkingReposRef.current = next
            return next
          })

          try {
            const hasChanges = await checkRepoAndFlag(repo.id)
            if (cancelled) break

            if (hasChanges) {
              scanned = true
              toast("Auto-scan started", {
                description: `${repo.github_repo.full_name} has new commits. Running compliance scan...`,
              })
              await runScanForRepo(repo.id, "auto-change-detected", true)
            }
          } catch (error) {
            console.warn(`Auto check failed for repo ${repo.id}`, error)
          } finally {
            setCheckingRepos(prev => {
              const next = new Set(prev)
              next.delete(repo.id)
              checkingReposRef.current = next
              return next
            })
          }
        }

        if (!scanned) {
          await loadTrackedRepos()
        }
      } finally {
        setLastAutoCheck(new Date())
        autoPollingRef.current = false
        if (!cancelled) {
          autoPollTimerRef.current = setTimeout(pollTrackedRepos, AUTO_POLL_INTERVAL_MS)
        }
      }
    }

    // Kick off immediately
    pollTrackedRepos()

    return () => {
      cancelled = true
      if (autoPollTimerRef.current) {
        clearTimeout(autoPollTimerRef.current)
      }
    }
  }, [connectionStatus?.connected, runScanForRepo, checkRepoAndFlag, loadTrackedRepos])

  // Track repo id set for change detection (no auto-scan)
  useEffect(() => {
    if (!connectionStatus?.connected) {
      return
    }
    if (!hasInitializedTrackedRef.current) {
      prevRepoIdsRef.current = new Set(trackedRepos.map(r => r.id))
      hasInitializedTrackedRef.current = true
      return
    }
    prevRepoIdsRef.current = new Set(trackedRepos.map(r => r.id))
  }, [trackedRepos, connectionStatus?.connected])

  const ensureProjectAndNavigate = async (repo: TrackedRepoWithDetails) => {
    const runId = ++projectModalRunId.current
    setProjectModalError(null)
    setProjectModalLoading(true)
    try {
      let currentRepo = repo

      if (!currentRepo.local_path) {
        await loadTrackedRepos()
        if (runId !== projectModalRunId.current) return
        const refreshed = latestReposRef.current.find(r => r.id === repo.id)
        if (!refreshed || !refreshed.local_path) {
          throw new Error("Latest scan not found for this repo. Run a scan first, then add as project.")
        }
        currentRepo = refreshed
      }

      const projects = await get_projects()
      if (runId !== projectModalRunId.current) return
      const localPath = currentRepo.local_path
      if (!localPath) {
        throw new Error("Local snapshot not available. Run a scan first.")
      }

      const existing = projects.find(p => p.path === localPath)
      if (existing) {
        setSelectedProject(existing)
        router.push("/scan")
        return
      }

      const project = await create_project(localPath, currentRepo.github_repo.name, undefined)
      if (runId !== projectModalRunId.current) return
      setSelectedProject(project)
      router.push("/scan")
    } catch (error) {
      console.error("Failed to open project from repo:", error)
      setProjectModalError(error instanceof Error ? error.message : String(error))
    } finally {
      if (runId === projectModalRunId.current) {
        setProjectModalLoading(false)
      }
    }
  }

  const scannedRepos = trackedRepos.filter(r => !!r.last_scanned_at)

  const filteredTrackedRepos = trackedRepos.filter((repo) => {
    const hasScan = !!repo.last_scanned_at
    const violations = repo.total_violations ?? 0
    const critical = repo.critical_violations ?? 0
    if (repoFilter === "critical") return hasScan && critical > 0
    if (repoFilter === "healthy") return hasScan && violations === 0
    return true
  })

  const totalViolations = scannedRepos.reduce((sum, r) => sum + (r.total_violations ?? 0), 0)
  const criticalCount = scannedRepos.reduce((sum, r) => sum + (r.critical_violations ?? 0), 0)
  const healthyCount = scannedRepos.filter(r => (r.total_violations ?? 0) === 0).length

  // Build chart data - pad with baseline point if only one repo to show a line
  const rawChartData = scannedRepos.map(repo => ({
    name: repo.github_repo.name,
    violations: repo.total_violations ?? 0,
    critical: repo.critical_violations ?? 0,
  }))

  // If only one data point, add a baseline to create a visible line
  const chartData = rawChartData.length === 1
    ? [{ name: "Baseline", violations: 0, critical: 0 }, ...rawChartData]
    : rawChartData

  const hasScanData = scannedRepos.length > 0

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
                  <span className="text-xs text-white/30 uppercase tracking-wider">Violations</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{hasScanData ? totalViolations : "—"}</span>
                  {!hasScanData && <span className="text-xs text-white/40">Awaiting scans</span>}
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
                <div className="text-3xl font-bold">{hasScanData ? criticalCount : "—"}</div>
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
                  <span className="text-3xl font-bold">{hasScanData ? healthyCount : "—"}</span>
                  {connectionStatus?.connected && hasScanData && <span className="text-xs text-white/30">/{trackedRepos.length}</span>}
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
              role={!connectionStatus?.connected ? "button" : undefined}
              tabIndex={!connectionStatus?.connected ? 0 : undefined}
              aria-label={!connectionStatus?.connected ? "Connect GitHub" : undefined}
              onKeyDown={
                !connectionStatus?.connected
                  ? (event) => {
                      if (isActivationKey(event)) {
                        event.preventDefault()
                        handleConnectClick()
                      }
                    }
                  : undefined
              }
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
                  <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                    }}
                  />
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
              <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-medium">Tracked Repositories</h2>
                  {connectionStatus?.connected && (
                    <div className="flex items-center gap-2 text-[11px] text-white/50">
                      <span className="px-2 py-1 rounded-md bg-white/[0.05] text-emerald-300 flex items-center gap-1">
                        <i className="las la-broadcast-tower text-sm"></i>
                        Auto-monitoring every {Math.round(AUTO_POLL_INTERVAL_MS / 1000)}s
                      </span>
                      <span className="text-white/40">
                        {lastAutoCheck
                          ? `Last check ${lastAutoCheck.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : "Checking soon"}
                      </span>
                    </div>
                  )}
                </div>

                {connectionStatus?.connected && trackedRepos.length > 0 && (
                  <div className="flex gap-1 text-xs">
                    <button
                      onClick={() => setRepoFilter("all")}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${repoFilter === "all" ? "bg-white/[0.12]" : "text-white/60 hover:bg-white/[0.04]"}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setRepoFilter("critical")}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${repoFilter === "critical" ? "bg-red-500/15 text-red-300" : "text-white/60 hover:bg-white/[0.04]"}`}
                    >
                      Critical
                    </button>
                    <button
                      onClick={() => setRepoFilter("healthy")}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${repoFilter === "healthy" ? "bg-emerald-500/15 text-emerald-300" : "text-white/60 hover:bg-white/[0.04]"}`}
                    >
                      Healthy
                    </button>
                  </div>
                )}
              </div>

              {connectionStatus?.connected ? (
                filteredTrackedRepos.length > 0 ? (
                  <div className="px-2 pb-2">
                    {filteredTrackedRepos.map((repo, index) => {
                    const hasScan = !!repo.last_scanned_at
                    const violations = hasScan ? repo.total_violations ?? 0 : null
                    const critical = hasScan ? repo.critical_violations ?? 0 : null
                    const status = !hasScan
                      ? "pending"
                      : (critical ?? 0) > 0
                        ? "critical"
                        : (violations ?? 0) > 0
                          ? "warning"
                          : "clean"
                    const isChecking = checkingRepos.has(repo.id)
                    const isScanning = scanningRepos.has(repo.id)
                    const hasChanges = repoChanges.get(repo.id) === true
                    const scanModeLabel = repo.last_scan_mode
                      ? repo.last_scan_mode.replace("_", " ")
                      : "unknown"

                    return (
                      <button
                        key={repo.id}
                        type="button"
                        className="w-full text-left px-4 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-all duration-200 rounded-xl mx-1 mb-1 animate-slideIn"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => setRepoForProject(repo)}
                        aria-label={`Open ${repo.github_repo.full_name} snapshot`}
                      >
                          <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                            isScanning ? "bg-blue-400 animate-pulse" :
                            isChecking ? "bg-cyan-400 animate-pulse" :
                            status === "critical" ? "bg-red-400" :
                            status === "warning" ? "bg-amber-400" :
                            status === "pending" ? "bg-white/40" :
                            "bg-emerald-400"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{repo.github_repo.name}</span>
                              <span className="text-xs text-white/30">{repo.github_repo.full_name}</span>
                              {isScanning && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-[10px] text-blue-400 font-medium flex items-center gap-1">
                                  <i className="las la-circle-notch animate-spin text-[8px]"></i>
                                  Scanning
                                </span>
                              )}
                              {isChecking && !isScanning && (
                                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                                  <i className="las la-sync animate-spin text-[8px]"></i>
                                  Checking
                                </span>
                              )}
                              {hasChanges && !isScanning && !isChecking && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-[10px] text-amber-400 font-medium">
                                  New commits
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                              {repo.github_repo.language && <span>{repo.github_repo.language}</span>}
                              <span>{repo.github_repo.default_branch}</span>
                              {hasScan ? (
                                <span>Last scan: {new Date(repo.last_scanned_at || 0).toLocaleDateString()}</span>
                              ) : isScanning ? (
                                <span className="text-blue-300">Running first scan...</span>
                              ) : (
                                <span className="text-white/50">Not yet scanned</span>
                              )}
                              {hasScan && repo.last_scan_mode && (
                                <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-white/60 capitalize">
                                  Mode: {scanModeLabel}
                                </span>
                              )}
                              {/* Show last checked time */}
                              {repo.last_checked_at && (
                                <span className="text-white/30">
                                  Checked: {new Date(repo.last_checked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300">Auto</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasScan && critical !== null && critical > 0 && (
                              <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-xs text-red-400">{critical} critical</span>
                            )}
                            {hasScan && violations !== null && violations === 0 && !hasChanges && (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-xs text-emerald-400">Clean</span>
                            )}
                            {!hasScan && !isScanning && !isChecking && (
                              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-white/60">Not scanned</span>
                            )}
                            {isChecking && (
                              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-xs text-cyan-300 flex items-center gap-1">
                                <i className="las la-sync animate-spin"></i>
                                Checking…
                              </span>
                            )}
                            {isScanning && (
                              <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-xs text-blue-300 flex items-center gap-1">
                                <i className="las la-radar animate-spin"></i>
                                Scanning…
                              </span>
                            )}
                            {hasChanges && !isScanning && !isChecking && (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-xs text-amber-300 flex items-center gap-1">
                                <i className="las la-code-branch"></i>
                                New commits
                              </span>
                            )}
                          </div>
                          <div className="w-14 text-right">
                            <div className="text-lg font-semibold">{hasScan ? violations : "—"}</div>
                            <div className="text-[10px] text-white/30 uppercase">issues</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                      <i className="lab la-filter text-2xl text-white/20"></i>
                    </div>
                    <p className="text-sm text-white/40 mb-3">No repositories match this filter</p>
                  </div>
                )
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
          onScanStarted={(trackedRepoId) => {
            setScanningRepos(prev => {
              const next = new Set(prev)
              next.add(trackedRepoId)
              scanningReposRef.current = next
              return next
            })
            loadTrackedRepos() // Refresh to show the new repo
          }}
          onScanCompleted={(trackedRepoId) => {
            setScanningRepos(prev => {
              const next = new Set(prev)
              next.delete(trackedRepoId)
              scanningReposRef.current = next
              return next
            })
            loadTrackedRepos() // Refresh to show scan results
          }}
        />
      )}

      {/* Add tracked repo as project modal */}
      {repoForProject && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f16] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center">
                <i className="las la-layer-group text-xl text-emerald-400"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold mb-1">Add repository as project?</h3>
                <p className="text-sm text-white/70 truncate">{repoForProject.github_repo.full_name}</p>
                <p className="text-xs text-white/40 mt-2">
                  This will open the repository snapshot as a project and take you to Scan Results.
                </p>
                {projectModalError && (
                  <p className="text-xs text-red-400 mt-2">{projectModalError}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm"
                onClick={() => {
                  projectModalRunId.current++
                  setRepoForProject(null)
                  setProjectModalError(null)
                  setProjectModalLoading(false)
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm text-black font-semibold disabled:opacity-60"
                onClick={() => ensureProjectAndNavigate(repoForProject)}
                disabled={projectModalLoading}
              >
                {projectModalLoading ? "Opening..." : "Yes, open project"}
              </button>
            </div>
          </div>
        </div>
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
