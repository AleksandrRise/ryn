"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import type { Severity } from "@/lib/types/violation"
import { listen } from "@tauri-apps/api/event"
import { Button } from "@/components/ui/button"
import { Play, Check, FileSearch, AlertCircle, Shield, X } from "lucide-react"
import { useProjectStore } from "@/lib/stores/project-store"
import {
  scan_project,
  get_scan_progress,
  get_violations,
  get_scans,
  get_projects,
  respond_to_cost_limit,
  cancel_scan,
  type Violation,
  type ScanResult
} from "@/lib/tauri/commands"
import { handleTauriError, showSuccess, showInfo } from "@/lib/utils/error-handler"
import { CostLimitDialog } from "@/components/scan/cost-limit-dialog"

export function ScanResults() {
  const { selectedProject, setSelectedProject } = useProjectStore()
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all")
  const [selectedControls, setSelectedControls] = useState({
    "CC6.1": true,
    "CC6.7": true,
    "CC7.2": true,
    "A1.2": true,
  })
  const [isScanning, setIsScanning] = useState(false)
  const [currentScanId, setCurrentScanId] = useState<number | null>(null)
  const [scanProgress, setScanProgress] = useState({
    percentage: 0,
    currentFile: "",
    filesScanned: 0,
    totalFiles: 0,
  })
  const [violations, setViolations] = useState<Violation[]>([])
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [lastScanStats, setLastScanStats] = useState({
    filesScanned: 0,
    violationsFound: 0,
    completedAt: "",
  })
  const [showCostLimitDialog, setShowCostLimitDialog] = useState(false)
  const [costLimitData, setCostLimitData] = useState({
    currentCost: 0,
    costLimit: 0,
    filesAnalyzed: 0,
    totalFiles: 0,
  })
  const lastProgressRef = useRef<{ filesScanned: number; timestamp: number }>({
    filesScanned: 0,
    timestamp: Date.now(),
  })

  // Restore active scan on mount (persist across page navigation)
  useEffect(() => {
    const activeScanData = localStorage.getItem('activeScan')
    if (activeScanData) {
      try {
        const { scanId, projectId } = JSON.parse(activeScanData)

        // Only restore if it's for the current project
        if (selectedProject?.id === projectId) {
          console.log(`[ryn] Restoring active scan ${scanId} for project ${projectId}`)
          setCurrentScanId(scanId)
          setIsScanning(true)

          // Restore progress by polling backend
          get_scan_progress(scanId).then(scan => {
            setScanProgress({
              percentage: scan.total_files > 0
                ? Math.round((scan.files_scanned / scan.total_files) * 100)
                : 0,
              currentFile: "Resuming scan...",
              filesScanned: scan.files_scanned,
              totalFiles: scan.total_files,
            })
          }).catch(err => {
            console.error("[ryn] Failed to restore scan progress:", err)
            // Clear stale scan data
            localStorage.removeItem('activeScan')
            setIsScanning(false)
            setCurrentScanId(null)
          })
        }
      } catch (error) {
        console.error("[ryn] Failed to restore active scan:", error)
        localStorage.removeItem('activeScan')
      }
    }
  }, []) // Run once on mount

  // Load scan data whenever selected project changes
  useEffect(() => {
    // Immediately clear violations when project changes
    setViolations([])
    setLastScan(null)
    setLastScanStats({
      filesScanned: 0,
      violationsFound: 0,
      completedAt: "",
    })

    const verifyAndLoadProject = async () => {
      if (selectedProject) {
        try {
          // Verify project still exists in database
          const projects = await get_projects()
          const exists = projects.some(p => p.id === selectedProject.id)

          if (!exists) {
            // Project was deleted or database was cleared
            console.warn(`Project ${selectedProject.id} not found in database, clearing selection`)
            setSelectedProject(null)
            showInfo("Previous project no longer exists. Please select a project.")
          } else {
            // Project exists, load last scan data
            await loadLastScan()
          }
        } catch (error) {
          console.error("Failed to verify project:", error)
          // On error, clear the selection to be safe
          setSelectedProject(null)
        }
      }
    }

    verifyAndLoadProject()
  }, [selectedProject?.id]) // React when project ID changes

  // Listen to real-time scan progress events
  useEffect(() => {
    if (!isScanning || !currentScanId) return

    let unlisten: (() => void) | null = null

    // Set up event listener for scan progress
    const setupListener = async () => {
      unlisten = await listen<{
        scan_id: number
        files_scanned: number
        total_files: number
        violations_found: number
        current_file: string
      }>("scan-progress", (event) => {
        const progress = event.payload

        // Update progress (accept all events while scanning, or filter by scan_id if it's set)
        if (currentScanId === -1 || progress.scan_id === currentScanId) {
          // Update the real scan ID when we receive the first event
          if (currentScanId === -1) {
            setCurrentScanId(progress.scan_id)
          }

          // Check for stalled scan (same file count for >30 seconds)
          const now = Date.now()
          const lastProgress = lastProgressRef.current
          if (
            progress.files_scanned === lastProgress.filesScanned &&
            now - lastProgress.timestamp > 30000 &&
            progress.files_scanned < progress.total_files
          ) {
            console.error("[ryn] Scan stalled - no progress for 30 seconds")
            setIsScanning(false)

            // Clear active scan from localStorage
            localStorage.removeItem('activeScan')

            handleTauriError("Scan timeout", "Scan stalled with no progress for 30 seconds. Please try again.")
            return
          }

          // Update last progress tracker
          if (progress.files_scanned !== lastProgress.filesScanned) {
            lastProgressRef.current = {
              filesScanned: progress.files_scanned,
              timestamp: now,
            }
          }

          setScanProgress({
            percentage: progress.total_files > 0
              ? Math.round((progress.files_scanned / progress.total_files) * 100)
              : 0,
            currentFile: progress.current_file,
            filesScanned: progress.files_scanned,
            totalFiles: progress.total_files,
          })

          // Check if scan completed (100%)
          if (progress.files_scanned === progress.total_files && progress.total_files > 0) {
            setTimeout(async () => {
              setIsScanning(false)

              // Clear active scan from localStorage
              localStorage.removeItem('activeScan')

              // Load violations and refresh
              await loadViolations(progress.scan_id)
              await loadLastScan()

              showSuccess(`Scan completed! Found ${progress.violations_found} violations`)
            }, 500) // Small delay to ensure DB is updated
          }
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) unlisten()
    }
  }, [isScanning, currentScanId])

  // Listen to cost limit reached events
  useEffect(() => {
    if (!isScanning || !currentScanId) return

    let unlisten: (() => void) | null = null

    const setupListener = async () => {
      unlisten = await listen<{
        scan_id: number
        current_cost_usd: number
        cost_limit_usd: number
        files_analyzed: number
        total_files: number
      }>("cost-limit-reached", (event) => {
        const data = event.payload

        // Only show dialog if it's for the current scan
        if (data.scan_id === currentScanId) {
          setCostLimitData({
            currentCost: data.current_cost_usd,
            costLimit: data.cost_limit_usd,
            filesAnalyzed: data.files_analyzed,
            totalFiles: data.total_files,
          })
          setShowCostLimitDialog(true)
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) unlisten()
    }
  }, [isScanning, currentScanId])

  // Listen to LLM error events
  useEffect(() => {
    if (!isScanning || !currentScanId) return

    let unlisten: (() => void) | null = null

    const setupListener = async () => {
      unlisten = await listen<{
        scan_id: number
        error_message: string
        scan_mode: string
      }>("llm-error", (event) => {
        const data = event.payload

        // Only show error if it's for the current scan
        if (data.scan_id === currentScanId) {
          const modeNames: Record<string, string> = {
            smart: "Smart",
            analyze_all: "Analyze All",
            regex_only: "Pattern Only"
          }
          const modeName = modeNames[data.scan_mode] || data.scan_mode
          handleTauriError(
            "AI Scanning Failed",
            `${modeName} mode is enabled but AI analysis failed. Scan completed with pattern-only results. Check your API key and try again.`
          )
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) unlisten()
    }
  }, [isScanning, currentScanId])

  const loadLastScan = async () => {
    if (!selectedProject) return

    try {
      const scans = await get_scans(selectedProject.id)
      if (scans.length > 0) {
        const latest = scans[0]
        setLastScan(latest)

        // Load violations for stats
        const viols = await get_violations(latest.id, {})
        setLastScanStats({
          filesScanned: latest.files_scanned || latest.total_files || 0,
          violationsFound: viols.length,
          completedAt: new Date(latest.created_at || latest.started_at).toLocaleString(),
        })

        // Load violations for display
        await loadViolations(latest.id)
      }
    } catch (error) {
      // Silent fail - no scans yet is OK
      console.log("No previous scans found")
    }
  }

  const loadViolations = async (scanId: number) => {
    try {
      const viols = await get_violations(scanId, {})
      // Filter out dismissed violations (status === 'dismissed')
      const activeViolations = viols.filter((v: any) => v.status !== 'dismissed')
      setViolations(activeViolations as unknown as Violation[])
    } catch (error) {
      handleTauriError(error, "Failed to load violations")
    }
  }

  const handleStartScan = async () => {
    if (!selectedProject) {
      handleTauriError("No project selected", "Please select a project first")
      return
    }

    try {
      setIsScanning(true)
      setScanProgress({ percentage: 0, currentFile: "", filesScanned: 0, totalFiles: 0 })

      // Reset progress tracker to prevent false timeout on new scan
      lastProgressRef.current = {
        filesScanned: 0,
        timestamp: Date.now(),
      }

      showInfo("Starting scan...")

      // Verify project exists before scanning
      try {
        const projects = await get_projects()
        const exists = projects.some(p => p.id === selectedProject.id)

        if (!exists) {
          throw new Error(`Project not found in database. Please select the project folder again.`)
        }
      } catch (verifyError) {
        // Clear invalid project from state
        setSelectedProject(null)
        throw verifyError
      }

      // Set a temporary scan ID so event listener activates
      setCurrentScanId(-1)

      // Start scan - this runs asynchronously and emits events
      const scan = await scan_project(selectedProject.id)

      // Update with real scan ID
      setCurrentScanId(scan.id)

      // Save active scan to localStorage so it persists across page navigation
      localStorage.setItem('activeScan', JSON.stringify({
        scanId: scan.id,
        projectId: selectedProject.id,
        startedAt: new Date().toISOString()
      }))

      console.log(`[ryn] Scan ${scan.id} started and saved to localStorage`)

      // Note: Completion is handled by the event listener now
    } catch (error) {
      setIsScanning(false)
      setCurrentScanId(null)

      // Clear active scan from localStorage on error
      localStorage.removeItem('activeScan')

      handleTauriError(error, "Failed to start scan")
    }
  }

  const toggleControl = (control: string) => {
    setSelectedControls(prev => ({
      ...prev,
      [control]: !prev[control as keyof typeof prev]
    }))
  }

  const handleCostLimitContinue = async () => {
    if (!currentScanId) return

    try {
      await respond_to_cost_limit(currentScanId, true)
      setShowCostLimitDialog(false)
      showInfo("Continuing scan...")
    } catch (error) {
      handleTauriError(error, "Failed to continue scan")
    }
  }

  const handleCostLimitStop = async () => {
    if (!currentScanId) return

    try {
      await respond_to_cost_limit(currentScanId, false)
      setShowCostLimitDialog(false)
      setIsScanning(false)

      // Clear active scan from localStorage
      localStorage.removeItem('activeScan')

      // Load violations found so far
      await loadViolations(currentScanId)
      await loadLastScan()

      showInfo("Scan stopped. Using violations found so far.")
    } catch (error) {
      handleTauriError(error, "Failed to stop scan")
    }
  }

  const handleCancelScan = async () => {
    if (!currentScanId || currentScanId === -1) return

    try {
      await cancel_scan(currentScanId)
      setIsScanning(false)
      setCurrentScanId(null)

      // Clear active scan from localStorage
      localStorage.removeItem('activeScan')

      showInfo("Scan cancelled")
    } catch (error) {
      handleTauriError(error, "Failed to cancel scan")
    }
  }

  const filteredViolations = violations.filter((v) => {
    // Filter by severity
    const matchesSeverity = selectedSeverity === "all" || v.severity === selectedSeverity

    // Filter by selected controls
    const matchesControl = selectedControls[v.control_id as keyof typeof selectedControls] !== false

    return matchesSeverity && matchesControl
  })

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-[#ef4444]"
      case "high":
        return "text-[#f97316]"
      case "medium":
        return "text-[#eab308]"
      case "low":
        return "text-[#e8e8e8]"
      default:
        return "text-white"
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">Scan Results</h1>
        <p className="text-lg text-white/60">Configure, run, and review compliance scans</p>
      </div>

      {/* Scan Configuration Panel */}
      <div className="mb-8 grid grid-cols-12 gap-6 animate-fade-in-up delay-100">
        {/* Left: Controls - 8 cols */}
        <div className="col-span-8 space-y-6">
          {/* SOC 2 Controls */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/5 rounded-lg">
                <Shield className="w-5 h-5 text-white/60" />
              </div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">SOC 2 Controls</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(selectedControls).map(([control, checked]) => (
                <button
                  key={control}
                  onClick={() => toggleControl(control)}
                  className={`relative overflow-hidden rounded-xl px-5 py-4 text-left transition-all duration-300 border-2 ${
                    checked
                      ? "bg-white/20 text-white border-white/30 shadow-lg"
                      : "bg-black/40 text-white/60 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold tracking-wide">{control}</p>
                    {checked && <Check className="w-4 h-4" />}
                  </div>
                  <p className={`text-xs ${checked ? "text-white/70" : "text-white/40"}`}>
                    {control === "CC6.1" && "Access Controls"}
                    {control === "CC6.7" && "Encryption & Secrets"}
                    {control === "CC7.2" && "Logging & Monitoring"}
                    {control === "A1.2" && "Data Availability"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Quick Stats & Actions - 4 cols */}
        <div className="col-span-4 space-y-6">
          {/* Quick Stats */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">Last Scan</h3>
            {lastScan ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">Completed</p>
                  <p className="text-lg font-bold">{lastScanStats.completedAt || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Files Scanned</p>
                  <p className="text-lg font-bold tabular-nums">{lastScanStats.filesScanned ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Violations Found</p>
                  <p className="text-lg font-bold tabular-nums">{lastScanStats.violationsFound}</p>
                </div>

                {/* Stale scan indicator */}
                {lastScan && (() => {
                  const scanTime = new Date(lastScan.created_at || lastScan.started_at).getTime()
                  const now = Date.now()
                  const diffMs = now - scanTime
                  const diffHours = Math.floor(diffMs / 3600000)
                  const isStale = diffHours >= 1

                  return isStale ? (
                    <div className="mt-4 p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-xl">
                      <p className="text-xs text-yellow-400 mb-2">
                        Scan data is {diffHours} hour{diffHours > 1 ? "s" : ""} old
                      </p>
                    </div>
                  ) : null
                })()}
              </div>
            ) : (
              <p className="text-sm text-white/40">No scans yet</p>
            )}
          </div>

          {/* Action Buttons */}
          {isScanning ? (
            <Button
              onClick={handleCancelScan}
              size="lg"
              variant="destructive"
              className="w-full gap-2 h-14"
            >
              <X className="w-5 h-5" />
              Cancel Scan
            </Button>
          ) : (
            <Button
              onClick={handleStartScan}
              size="lg"
              className="w-full gap-2 h-14"
            >
              <Play className="w-5 h-5" />
              Start New Scan
            </Button>
          )}
        </div>
      </div>

      {/* Scan Progress Indicator */}
      {isScanning && (
        <div className="mb-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 animate-fade-in-up delay-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-500/20 rounded-xl animate-pulse">
              <FileSearch className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Scanning in progress...</h3>
              <p className="text-sm text-white/60 font-mono truncate">{scanProgress.currentFile || "Initializing scan..."}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">{scanProgress.percentage}%</div>
              <p className="text-xs text-white/40">{scanProgress.filesScanned} / {scanProgress.totalFiles} files</p>
            </div>
          </div>
          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="mb-6 animate-fade-in-up delay-300">
        <h2 className="text-3xl font-bold leading-none tracking-tight mb-2">Violations</h2>
        <p className="text-white/60">{filteredViolations.length} violations found</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-3 animate-fade-in-up delay-400">
        {(["all", "critical", "high", "medium", "low"] as const).map((severity) => {
          const count = severity === "all" ? violations.length : violations.filter(v => v.severity === severity).length
          return (
            <button
              key={severity}
              onClick={() => setSelectedSeverity(severity as Severity | "all")}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-all ${
                selectedSeverity === severity
                  ? "bg-white/20 text-white shadow-lg"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              {severity} <span className="ml-2 opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Violations Table */}
      {isScanning ? (
        /* Show loading state during scan */
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 animate-fade-in-up delay-500">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin mb-6" />
            <h3 className="text-xl font-semibold mb-2">Analyzing code...</h3>
            <p className="text-white/60">Please wait while we scan your project for violations</p>
          </div>
        </div>
      ) : filteredViolations.length === 0 ? (
        /* Show empty state - always prompt to scan */
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 animate-fade-in-up delay-500">
          <div className="flex flex-col items-center justify-center text-center">
            <Play className="w-16 h-16 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Ready to scan</h3>
            <p className="text-white/60 mb-4">
              Click the &quot;Start New Scan&quot; button above to analyze this project for SOC 2 compliance violations.
            </p>
          </div>
        </div>
      ) : (
        /* Show violations table */
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden animate-fade-in-up delay-500">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Severity</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Control</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Description</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Location</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.map((violation, i) => (
                  <tr key={violation.id} className="group border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        violation.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        violation.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        violation.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {violation.severity === 'critical' && <AlertCircle className="w-3 h-3" />}
                        {violation.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/5 text-xs font-mono font-medium">
                        {violation.control_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white/90">{violation.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-white/60 font-mono">
                        {violation.file_path}
                        <span className="text-white/40">:{violation.line_number}</span>
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/violation/${violation.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors"
                      >
                        View details
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost Limit Dialog */}
      {showCostLimitDialog && (
        <CostLimitDialog
          currentCost={costLimitData.currentCost}
          costLimit={costLimitData.costLimit}
          filesAnalyzed={costLimitData.filesAnalyzed}
          totalFiles={costLimitData.totalFiles}
          onContinue={handleCostLimitContinue}
          onStop={handleCostLimitStop}
        />
      )}
    </div>
  )
}
