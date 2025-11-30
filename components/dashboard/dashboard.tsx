"use client"

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"
import { ChartSelector, ChartContainer } from "./charts"
import { useDashboardChartStore } from "@/lib/stores/dashboard-chart-store"
import {
  check_github_connection,
  check_repos_for_changes_batch,
  disconnect_github,
  get_tracked_repos,
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
import { useScanData } from "@/components/scan/hooks/use-scan-data"
import { formatRelativeTime } from "@/lib/utils/date"

// Platform configuration
const PLATFORMS = [
  { id: "github", name: "GitHub", laIcon: "lab la-github", available: true },
  { id: "local", name: "Local folder", laIcon: "las la-folder-open", available: true },
] as const

const AUTO_POLL_INTERVAL_MS = 90_000
const isActivationKey = (event: React.KeyboardEvent) =>
  event.key === "Enter" || event.key === " "

export function Dashboard() {
  const router = useRouter()
  const { setSelectedProject, selectedProject } = useProjectStore()
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
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 })
  const latestReposRef = useRef<TrackedRepoWithDetails[]>([])
  const prevRepoIdsRef = useRef<Set<number>>(new Set())
  const hasInitializedTrackedRef = useRef(false)
  const checkingReposRef = useRef<Set<number>>(new Set())
  const scanningReposRef = useRef<Set<number>>(new Set())
  const autoPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoPollingRef = useRef(false)

  // Pause monitoring state (persisted to localStorage)
  const [isMonitoringPaused, setIsMonitoringPaused] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ryn-monitoring-paused") === "true"
    }
    return false
  })

  // Persist pause state to localStorage
  useEffect(() => {
    localStorage.setItem("ryn-monitoring-paused", String(isMonitoringPaused))
  }, [isMonitoringPaused])

  const isLocalMode = selectedPlatform.id === "local"
  const hasLocalProject = Boolean(selectedProject)

  // Fetch local project scan data
  const {
    violations: localViolations,
    lastScan: localLastScan,
    lastScanStats: localScanStats,
    allScans: localScans,
  } = useScanData(selectedProject?.id)

  // Chart preferences store
  const {
    localChartType,
    githubChartType,
    trendTimeRange,
    setLocalChartType,
    setGithubChartType,
    setTrendTimeRange,
  } = useDashboardChartStore()

  // Computed chart settings based on mode
  const currentChartType = isLocalMode ? localChartType : githubChartType
  const setChartType = isLocalMode ? setLocalChartType : setGithubChartType
  const showTimeRange = currentChartType === "trend-over-time"

  // Calculate local project stats
  const localTotalViolations = localViolations.length
  const localCriticalCount = localViolations.filter(v => v.severity === "critical").length
  const localHighCount = localViolations.filter(v => v.severity === "high").length
  const hasLocalScanData = !!localLastScan

  // Show chart CTA (clickable area to open file picker or connect GitHub) when:
  // - Not connected to GitHub AND not in local mode with existing scan data
  const showChartCta = !connectionStatus?.connected && !(isLocalMode && hasLocalScanData)

  const checkConnection = useCallback(async () => {
    try {
      const status = await check_github_connection()
      setConnectionStatus(status)
    } catch {
      // Connection check failed
    }
  }, [])

  const loadTrackedRepos = useCallback(async () => {
    try {
      const repos = await get_tracked_repos()
      setTrackedRepos(repos)
      latestReposRef.current = repos
    } catch {
      // Failed to load tracked repos
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

  // Sync platform tab to match loaded project on initial hydration
  const hasInitializedPlatformRef = useRef(false)
  useEffect(() => {
    if (selectedProject && !hasInitializedPlatformRef.current) {
      hasInitializedPlatformRef.current = true
      setSelectedPlatform(PLATFORMS.find(p => p.id === "local")!)
    }
  }, [selectedProject])

  useEffect(() => {
    const loadScanModeSetting = async () => {
      try {
        const settings = await get_settings()
        const mode = settings.find((s) => s.key === "llm_scan_mode")?.value
        if (mode) {
          setDefaultScanMode(mode)
        }
      } catch {
        // Failed to load scan mode setting
      }
    }
    void loadScanModeSetting()
  }, [])

  const handleDisconnect = async () => {
    try {
      await disconnect_github()
      setConnectionStatus({ connected: false, username: undefined, avatar_url: undefined, repo_count: 0, tracked_count: 0 })
      setTrackedRepos([])
    } catch {
      // Failed to disconnect
    }
  }

  const handleConnectClick = useCallback(() => {
    if (connectionStatus?.connected) {
      setRepoManagerOpen(true)
    } else {
      setOauthModalOpen(true)
    }
  }, [connectionStatus?.connected])

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
      } catch {
        // Polling scan failed
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
      // Show completion toast
      const repoName = latestReposRef.current.find(r => r.id === repoId)?.github_repo.name ?? "Repository"
      toast.success("Scan complete", {
        description: `${repoName} scan finished.`,
      })
      return scanId
    } finally {
      setScanningRepos(prev => {
        const next = new Set(prev)
        next.delete(repoId)
        scanningReposRef.current = next
        return next
      })
    }
  }, [defaultScanMode, loadTrackedRepos])

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

  useLayoutEffect(() => {
    if (!platformDropdownOpen) return
    const node = dropdownRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    setMenuPos({ left: rect.left, top: rect.bottom + 8, width: rect.width })
  }, [platformDropdownOpen])

  // Background polling: keep data fresh and auto-scan when commits change
  // Optimized to batch check all repos in a single call instead of N+1 sequential checks
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
      if (cancelled || autoPollingRef.current || isMonitoringPaused) return
      autoPollingRef.current = true

      try {
        const repos = latestReposRef.current
        if (repos.length === 0) {
          setLastAutoCheck(new Date())
          return
        }

        // Get repos that aren't currently scanning/checking
        const reposToCheck = repos.filter(
          repo =>
            !scanningReposRef.current.has(repo.id) && !checkingReposRef.current.has(repo.id)
        )

        if (reposToCheck.length === 0) {
          setLastAutoCheck(new Date())
          return
        }

        // Mark all repos as checking
        const repoIds = reposToCheck.map(r => r.id)
        setCheckingRepos(prev => {
          const next = new Set(prev)
          repoIds.forEach(id => next.add(id))
          checkingReposRef.current = next
          return next
        })

        try {
          // Batch check all repos in one call (eliminates N+1 pattern)
          const checkResults = await check_repos_for_changes_batch(repoIds)
          if (cancelled) return

          let scanned = false

          // Process results and trigger scans for changed repos
          for (const result of checkResults) {
            if (cancelled) break

            // Update repo changes map
            setRepoChanges(prev => {
              const next = new Map(prev)
              next.set(result.repo_id, result.has_changes)
              return next
            })

            if (result.has_changes) {
              const repo = repos.find(r => r.id === result.repo_id)
              if (repo) {
                scanned = true
                toast("Auto-scan started", {
                  description: `${repo.github_repo.full_name} has new commits. Running compliance scan...`,
                })
                await runScanForRepo(result.repo_id, "auto-change-detected", true)
              }
            }
          }

          if (!scanned && !cancelled) {
            await loadTrackedRepos()
          }
        } catch {
          // Fall back to loading repos to get fresh data
          if (!cancelled) {
            await loadTrackedRepos()
          }
        } finally {
          setCheckingRepos(prev => {
            const next = new Set(prev)
            repoIds.forEach(id => next.delete(id))
            checkingReposRef.current = next
            return next
          })
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
  }, [connectionStatus?.connected, runScanForRepo, loadTrackedRepos, isMonitoringPaused])

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

  // Auto-scan repos that have never been scanned and aren't currently scanning
  // This ensures repos NEVER show "Not scanned" status
  useEffect(() => {
    if (!connectionStatus?.connected) return

    const unscannedRepos = trackedRepos.filter(repo => {
      // No completed scan
      const hasCompletedScan = !!repo.last_scanned_at
      // Not currently scanning (either in local state or backend status)
      const isCurrentlyScanning = scanningRepos.has(repo.id) || repo.last_scan_status === "running"
      // Not being checked
      const isBeingChecked = checkingRepos.has(repo.id)

      return !hasCompletedScan && !isCurrentlyScanning && !isBeingChecked
    })

    // Trigger scans for repos that need it
    for (const repo of unscannedRepos) {
      toast("First scan starting", {
        description: `Running initial compliance scan on ${repo.github_repo.name}...`,
      })
      runScanForRepo(repo.id, "auto-first-scan", false).catch(() => {
        // Auto-scan failed
      })
    }
  }, [connectionStatus?.connected, trackedRepos, scanningRepos, checkingRepos, runScanForRepo])

  const handlePlatformSelect = useCallback(
    async (platform: typeof PLATFORMS[number]) => {
      if (!platform.available) return
      setSelectedPlatform(platform)
      setPlatformDropdownOpen(false)

      if (platform.id === "github") {
        handleConnectClick()
        return
      }

      try {
        toast("Opening local folder picker…")
        const folder = await open({
          title: "Select Project Folder",
          directory: true,
          multiple: false,
          recursive: true,
        })
        if (!folder || typeof folder !== "string") {
          return
        }

        const projects = await get_projects()
        const existing = projects.find((p) => p.path === folder)
        const name = folder.split(/[\\/]/).filter(Boolean).pop() ?? "Local project"
        const project = existing ?? (await create_project(folder, name))

        setSelectedProject(project)
        router.push("/scan")
        toast.success("Local project ready", {
          description: name,
        })
      } catch (error) {
        toast.error("Could not open local folder", {
          description: error instanceof Error ? error.message : "Unexpected error",
        })
      }
    },
    [handleConnectClick, router, setSelectedProject],
  )

  const handlePrimaryConnect = useCallback(() => {
    if (selectedPlatform.id === "local") {
      const localPlatform = PLATFORMS.find((p) => p.id === "local")
      if (localPlatform) {
        void handlePlatformSelect(localPlatform)
      }
      return
    }
    handleConnectClick()
  }, [handleConnectClick, handlePlatformSelect, selectedPlatform.id])

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
          <div className="flex items-start justify-between mb-8 animate-fade-in-up">
            <div className="flex items-center gap-5">
              {/* Platform Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setPlatformDropdownOpen((open) => !open)}
                  className="flex items-center gap-3 pl-3 pr-4 py-2.5 bg-white/[0.07] hover:bg-white/[0.12] rounded-xl transition-all border border-white/10"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <i className={`${selectedPlatform.laIcon} text-lg`}></i>
                  </div>
                  <span className="text-sm font-medium">{selectedPlatform.name}</span>
                  <i className={`las la-angle-down text-xs text-white/40 ml-1 transition-transform ${platformDropdownOpen ? "rotate-180" : ""}`}></i>
                </button>

                {platformDropdownOpen &&
                  typeof document !== "undefined" &&
                  createPortal(
                    <div
                      className="fixed inset-0 z-[4000]"
                      onMouseDown={() => setPlatformDropdownOpen(false)}
                    >
                      <div
                        className="absolute rounded-2xl overflow-hidden border border-white/10 bg-black pointer-events-auto"
                        style={{
                          left: menuPos.left,
                          top: menuPos.top,
                          width: menuPos.width || 224,
                          boxShadow: "0 32px 90px rgba(0,0,0,0.9)",
                          backgroundColor: "rgba(0,0,0,1)",
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="p-1.5 space-y-1">
                          {PLATFORMS.map((platform) => {
                            const isSelected = platform.id === selectedPlatform.id
                            return (
                              <button
                                key={platform.id}
                                onClick={() => void handlePlatformSelect(platform)}
                                disabled={!platform.available}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                  isSelected
                                    ? "bg-neutral-900 border border-white/15 ring-1 ring-white/10"
                                    : platform.available
                                      ? "hover:bg-white/10"
                                      : "opacity-40 cursor-not-allowed"
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
                    </div>,
                    document.body,
                  )}
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div>
                <h1 className="text-xl font-semibold tracking-tight">Compliance Overview</h1>
                <p className="text-xs text-white/40 mt-0.5">
                  {connectionStatus?.connected
                    ? `${trackedRepos.length} repositories monitored`
                    : hasLocalProject
                      ? `Local project ready: ${selectedProject?.name ?? "Project"}`
                      : isLocalMode
                        ? "Open a local project to start scanning"
                        : "Connect to start monitoring"}
                </p>
              </div>
            </div>
          </div>

          {/* Top Section: Stats + Chart side by side */}
          <div className="grid grid-cols-12 gap-5 mb-5 animate-fade-in-up delay-100">
            {/* Stats Column - Vertical stack */}
            <div className="col-span-3 flex flex-col gap-3">
              {/* Files Scanned (local) / Repositories (github) */}
              <div className="flex-1 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-blue-500/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <i className={`las ${isLocalMode ? "la-file-code" : "la-layer-group"} text-lg text-blue-400`}></i>
                  </div>
                  <span className="text-xs text-white/30 uppercase tracking-wider">{isLocalMode ? "Files" : "Repos"}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {isLocalMode ? (hasLocalScanData ? localScanStats.filesScanned : "—") : trackedRepos.length}
                  </span>
                  {isLocalMode && !hasLocalScanData && <span className="text-xs text-white/40">No scans yet</span>}
                </div>
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
                  <span className="text-3xl font-bold">
                    {isLocalMode ? (hasLocalScanData ? localTotalViolations : "—") : (hasScanData ? totalViolations : "—")}
                  </span>
                  {(isLocalMode ? !hasLocalScanData : !hasScanData) && <span className="text-xs text-white/40">Awaiting scans</span>}
                </div>
              </div>

              {/* Critical */}
              <div className="flex-1 bg-gradient-to-br from-red-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-red-500/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <i className="las la-radiation text-lg text-red-400"></i>
                  </div>
                  <span className="text-xs text-white/30 uppercase tracking-wider">Critical</span>
                </div>
                <div className="text-3xl font-bold">
                  {isLocalMode ? (hasLocalScanData ? localCriticalCount : "—") : (hasScanData ? criticalCount : "—")}
                </div>
              </div>

              {/* High (local) / Healthy (github) */}
              <div className="flex-1 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-emerald-500/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <i className={`las ${isLocalMode ? "la-exclamation-circle" : "la-shield-alt"} text-lg ${isLocalMode ? "text-orange-400" : "text-emerald-400"}`}></i>
                  </div>
                  <span className="text-xs text-white/30 uppercase tracking-wider">{isLocalMode ? "High" : "Healthy"}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {isLocalMode ? (hasLocalScanData ? localHighCount : "—") : (hasScanData ? healthyCount : "—")}
                  </span>
                  {!isLocalMode && connectionStatus?.connected && hasScanData && <span className="text-xs text-white/30">/{trackedRepos.length}</span>}
                </div>
              </div>
            </div>

            {/* Chart - Large - With connection CTA when not connected */}
            <div
              className={`col-span-9 relative rounded-2xl overflow-hidden transition-colors duration-300 border ${
                showChartCta
                  ? isLocalMode
                    ? "bg-[#0a0b10]/90 border-white/10 cursor-pointer group/card"
                    : "bg-gradient-to-br from-emerald-400/[0.12] via-emerald-500/[0.04] to-transparent border-emerald-500/10 hover:border-emerald-500/25 cursor-pointer group/card"
                  : "bg-[#08080c]/80 border-white/[0.05]"
              }`}
              onClick={showChartCta ? handlePrimaryConnect : undefined}
              role={showChartCta ? "button" : undefined}
              tabIndex={showChartCta ? 0 : undefined}
              aria-label={showChartCta ? (isLocalMode ? "Open local project" : "Connect GitHub") : undefined}
              onKeyDown={
                showChartCta
                  ? (event) => {
                      if (isActivationKey(event)) {
                        event.preventDefault()
                        handlePrimaryConnect()
                      }
                    }
                  : undefined
              }
            >
              {/* Shimmer animation background when not connected */}
              {!connectionStatus?.connected && !isLocalMode && (
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
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold">Compliance Overview</h2>
                      <p className="text-xs text-white/40 mt-0.5">{trackedRepos.length} repositories monitored</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChartSelector
                        chartType={currentChartType}
                        onChartTypeChange={setChartType}
                        mode="github"
                        timeRange={trendTimeRange}
                        onTimeRangeChange={setTrendTimeRange}
                        showTimeRange={showTimeRange}
                      />
                      <button
                        onClick={handleConnectClick}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/60 hover:text-white transition-all border border-white/[0.04]"
                      >
                        <i className="las la-cog"></i>
                        <span>Repos</span>
                      </button>
                    </div>
                  </div>
                )}

                {connectionStatus?.connected ? (
                  <div className="animate-fadeIn">
                    {/* Customizable Chart */}
                    <div className="flex-1 min-h-[200px]">
                      <ChartContainer
                        chartType={currentChartType}
                        mode="github"
                        violations={[]}
                        scans={[]}
                        trackedRepos={trackedRepos}
                        timeRange={trendTimeRange}
                      />
                    </div>

                    {/* Summary stats below chart */}
                    <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-base font-semibold text-white/90">{totalViolations}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-base font-semibold text-red-400">{criticalCount}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Critical</div>
                      </div>
                      <div className="text-center">
                        <div className="text-base font-semibold text-emerald-400">{healthyCount}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Clean</div>
                      </div>
                      <div className="text-center">
                        <div className="text-base font-semibold text-white/80">{trackedRepos.filter(r => !!r.last_scanned_at).length}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Scanned</div>
                      </div>
                    </div>
                  </div>
                ) : hasLocalProject ? (
                  <div className="h-full min-h-[300px] p-6">
                    {hasLocalScanData ? (
                      <div className="h-full flex flex-col">
                        {/* Header with Chart Selector */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-sm font-semibold">{selectedProject?.name ?? "Local Project"}</h3>
                            <p className="text-xs text-white/40">Last scanned {formatRelativeTime(localScanStats.completedAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <ChartSelector
                              chartType={currentChartType}
                              onChartTypeChange={setChartType}
                              mode="local"
                              timeRange={trendTimeRange}
                              onTimeRangeChange={setTrendTimeRange}
                              showTimeRange={showTimeRange}
                            />
                            <button
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/60 hover:text-white transition-all border border-white/[0.04]"
                              onClick={() => router.push("/scan")}
                            >
                              <i className="las la-search"></i>
                              <span>Details</span>
                            </button>
                          </div>
                        </div>

                        {/* Chart Visualization */}
                        <div className="flex-1 min-h-[180px]">
                          <ChartContainer
                            chartType={currentChartType}
                            mode="local"
                            violations={localViolations}
                            scans={localScans}
                            timeRange={trendTimeRange}
                          />
                        </div>

                        {/* Bottom summary stats */}
                        <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-base font-semibold text-red-400">{localCriticalCount}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">Critical</div>
                          </div>
                          <div className="text-center">
                            <div className="text-base font-semibold text-amber-400">{localHighCount}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">High</div>
                          </div>
                          <div className="text-center">
                            <div className="text-base font-semibold text-white/80">{localScanStats.filesScanned}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">Files</div>
                          </div>
                          <div className="text-center">
                            <div className="text-base font-semibold text-white/80">{localTotalViolations}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">Total</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center justify-center text-center w-full">
                          <div className="relative w-14 h-14 mb-4 mx-auto">
                            <div className="absolute inset-0 rounded-xl bg-white/12 blur-lg" />
                            <div className="relative w-full h-full rounded-xl bg-white/08 border border-white/15 flex items-center justify-center">
                              <i className="las la-folder-open text-2xl text-white/80"></i>
                            </div>
                          </div>
                          <h3 className="text-lg font-semibold mb-1.5">{selectedProject?.name ?? "Local project"}</h3>
                          <p className="text-sm text-white/50 mb-5 leading-relaxed max-w-xs mx-auto truncate">{selectedProject?.path}</p>
                          <div className="flex gap-2">
                            <button
                              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-medium text-white transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
                              onClick={() => router.push("/scan")}
                            >
                              <i className="las la-play text-lg"></i>
                              Start First Scan
                            </button>
                            <button
                              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/14 text-sm font-medium text-white transition-all duration-300"
                              onClick={() => handlePlatformSelect(PLATFORMS.find((p) => p.id === "local")!)}
                            >
                              <i className="las la-folder-open text-lg"></i>
                              Change
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isLocalMode ? (
                  <div className="h-full min-h-[300px] flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center text-center w-full transition-transform duration-300 group-hover/card:scale-[1.02]">
                      <div className="relative w-14 h-14 mb-4 mx-auto">
                        <div className="absolute inset-0 rounded-xl bg-white/12 blur-lg transition-all duration-300 group-hover/card:bg-white/16" />
                        <div className="relative w-full h-full rounded-xl bg-white/08 border border-white/15 flex items-center justify-center transition-all duration-300 group-hover/card:border-white/25">
                          <i className="las la-folder-open text-2xl text-white/80"></i>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-1.5">Open a local project</h3>
                      <p className="text-sm text-white/50 mb-5 leading-relaxed max-w-xs mx-auto">Select a folder to scan locally.</p>
                      <button
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white/12 hover:bg-white/16 border border-white/18 text-sm font-medium text-white transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
                        onClick={() => handlePlatformSelect(PLATFORMS.find((p) => p.id === "local")!)}
                      >
                        <i className="las la-folder-open text-lg"></i>
                        Choose Folder
                      </button>
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
          <div className="grid grid-cols-12 gap-5 animate-fade-in-up delay-200">
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
                      <span className={`px-2 py-1 rounded-md flex items-center gap-1 ${
                        isMonitoringPaused
                          ? "bg-amber-500/10 text-amber-300"
                          : "bg-white/[0.05] text-emerald-300"
                      }`}>
                        <i className={`las ${isMonitoringPaused ? "la-pause-circle" : "la-broadcast-tower"} text-sm`}></i>
                        {isMonitoringPaused ? "Monitoring paused" : `Auto-monitoring every ${Math.round(AUTO_POLL_INTERVAL_MS / 1000)}s`}
                      </span>
                      <button
                        onClick={() => setIsMonitoringPaused(prev => !prev)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                          isMonitoringPaused
                            ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20"
                            : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08]"
                        }`}
                      >
                        <i className={`las ${isMonitoringPaused ? "la-play" : "la-pause"} text-sm`}></i>
                        {isMonitoringPaused ? "Resume" : "Pause"}
                      </button>
                      {!isMonitoringPaused && (
                        <span className="text-white/40">
                          {lastAutoCheck
                            ? `Last check ${lastAutoCheck.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "Checking soon"}
                        </span>
                      )}
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
                    // Also check last_scan_status to detect scans running from before app restart
                    const isScanning = scanningRepos.has(repo.id) || repo.last_scan_status === "running"
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
                  <button onClick={handlePrimaryConnect} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                    {selectedPlatform.id === "local" ? "Open a local project" : "Connect GitHub to get started"}
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
                  This will open the repository snapshot as a project and take you to Scans.
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
