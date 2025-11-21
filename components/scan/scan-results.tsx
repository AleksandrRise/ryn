"use client"

import { useEffect, useMemo, useState } from "react"
import { Play, RefreshCw, Clock3, Zap, Search, FolderTree, ChevronDown } from "lucide-react"
import { CostLimitDialog } from "@/components/scan/cost-limit-dialog"
import { ScanControls } from "@/components/scan/scan-controls"
import { ScanProgressCard } from "@/components/scan/scan-progress-card"
import { SeverityFilter } from "@/components/scan/severity-filter"
import { Button } from "@/components/ui/button"
import { useScanData } from "@/components/scan/hooks/use-scan-data"
import { useScanRunner } from "@/components/scan/hooks/use-scan-runner"
import { useProjectStore } from "@/lib/stores/project-store"
import type { Severity } from "@/lib/types/violation"
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date"
import { handleTauriError, showInfo, showSuccess } from "@/lib/utils/error-handler"

export function ScanResults() {
  const { selectedProject } = useProjectStore()
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all")
  const [selectedControls, setSelectedControls] = useState<Record<string, boolean>>({
    "CC6.1": true,
    "CC6.7": true,
    "CC7.2": true,
    "A1.2": true,
  })

  const {
    isLoading,
    lastScan,
    lastScanCost,
    violations,
    lastScanStats,
    reload,
  } = useScanData(selectedProject?.id)

  const {
    isScanning,
    progress,
    costLimitPrompt,
    startScan,
    continueAfterCostLimit,
    stopAfterCostLimit,
  } = useScanRunner(selectedProject?.id, {
    onScanCompleted: reload,
    onScanStopped: reload,
  })

  const toggleControl = (control: string) => {
    setSelectedControls((prev) => ({
      ...prev,
      [control]: !prev[control],
    }))
  }

  const filteredViolations = useMemo(
    () =>
      violations.filter((violation) => {
        const matchesSeverity = selectedSeverity === "all" || violation.severity === selectedSeverity
        const matchesControl = selectedControls[violation.controlId] !== false
        return matchesSeverity && matchesControl
      }),
    [selectedSeverity, selectedControls, violations],
  )

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedViolationId, setSelectedViolationId] = useState<number | null>(null)
  const [fileSearch, setFileSearch] = useState("")

  const lastCostDisplay = lastScanCost ? `$${lastScanCost.totalCostUsd.toFixed(3)}` : "–"
  const lastCompletedDisplay = lastScanStats.completedAt
    ? formatDateTime(lastScanStats.completedAt)
    : "No scans yet"
  const lastCompletedRelative = lastScanStats.completedAt
    ? formatRelativeTime(lastScanStats.completedAt)
    : ""
  const lastMode = lastScan?.scanMode ? lastScan.scanMode : "regex_only"

  const severityTone = (sev: Severity) =>
    sev === "critical"
      ? "text-red-300"
      : sev === "high"
        ? "text-orange-300"
        : sev === "medium"
          ? "text-yellow-200"
          : "text-white/60"

  // Build file groups from the currently filtered violations
  const fileGroups = useMemo(() => {
    const groups = new Map<string, { filePath: string; violations: typeof filteredViolations; counts: Record<Severity, number> }>()

    filteredViolations.forEach((v) => {
      if (!groups.has(v.filePath)) {
        groups.set(v.filePath, {
          filePath: v.filePath,
          violations: [],
          counts: { critical: 0, high: 0, medium: 0, low: 0 },
        })
      }
      const entry = groups.get(v.filePath)!
      entry.violations.push(v)
      entry.counts[v.severity] += 1
    })

    const order: Severity[] = ["critical", "high", "medium", "low"]

    return Array.from(groups.values()).sort((a, b) => {
      // Sort by highest-severity count, then total count, then path
      for (const sev of order) {
        const diff = (b.counts[sev] ?? 0) - (a.counts[sev] ?? 0)
        if (diff !== 0) return diff
      }
      const totalDiff = b.violations.length - a.violations.length
      if (totalDiff !== 0) return totalDiff
      return a.filePath.localeCompare(b.filePath)
    })
  }, [filteredViolations])

  const visibleFileGroups = useMemo(() => {
    const term = fileSearch.trim().toLowerCase()
    if (!term) return fileGroups
    return fileGroups.filter((group) =>
      group.filePath.toLowerCase().includes(term)
    )
  }, [fileGroups, fileSearch])

  // Current violation list narrowed by file selection
  const visibleViolations = useMemo(() => {
    if (!selectedFilePath) return filteredViolations
    return filteredViolations.filter((v) => v.filePath === selectedFilePath)
  }, [filteredViolations, selectedFilePath])

  // Ensure selection stays in sync
  useEffect(() => {
    if (visibleViolations.length === 0) {
      setSelectedViolationId(null)
      return
    }
    const hasSelection = selectedViolationId && visibleViolations.some((v) => v.id === selectedViolationId)
    if (!hasSelection) {
      setSelectedViolationId(visibleViolations[0].id)
    }
  }, [visibleViolations, selectedViolationId])

  const selectedViolation = selectedViolationId
    ? visibleViolations.find((v) => v.id === selectedViolationId) ?? visibleViolations[0]
    : visibleViolations[0]

  const handleStartScan = async () => {
    if (!selectedProject) {
      handleTauriError("No project selected", "Please select a project first")
      return
    }

    try {
      showInfo("Starting scan...")
      const scan = await startScan()
      showSuccess(`Scan completed! Found ${scan.violationsFound} violations`)
    } catch (error) {
      handleTauriError(error, "Failed to start scan")
    }
  }

  if (!selectedProject) {
    return (
      <div className="px-8 py-8 max-w-[1800px] mx-auto">
        <div className="mb-4">
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-2">Scan Results</h1>
          <p className="text-white/60">Select a project from the header to view and run scans.</p>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">No project selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-4">
      {/* Top bar: title + primary actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Scan Results</h1>
          <p className="text-xs text-white/50">Project: {selectedProject.name}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button
            onClick={handleStartScan}
            disabled={isScanning || isLoading}
            size="sm"
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            {isScanning ? "Scanning..." : "Start scan"}
          </Button>
        </div>
      </div>

      {/* Meta line + filters */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-white/65">
        <span className="flex items-center gap-1">
          <Clock3 className="w-3.5 h-3.5" />
          {lastCompletedDisplay}
          {lastCompletedRelative && <span className="text-white/45">({lastCompletedRelative})</span>}
        </span>
        <span className="text-white/60">·</span>
        <span>Mode: {lastMode === "regex_only" ? "Pattern only" : lastMode === "smart" ? "Smart" : "Analyze all"}</span>
        <span className="text-white/60">·</span>
        <span>Files: {lastScanStats.filesScanned || 0}</span>
        <span className="text-white/60">·</span>
        <span>Violations: {lastScanStats.violationsFound || 0}</span>
        <span className="text-white/60">·</span>
        <span>Cost: {lastCostDisplay}</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/55">Controls</span>
            <ScanControls selectedControls={selectedControls} onToggle={toggleControl} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/55">Severity</span>
            <SeverityFilter selected={selectedSeverity} onSelect={setSelectedSeverity} violations={violations} />
          </div>
        </div>
      </div>

      {isScanning && <ScanProgressCard progress={progress} />}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr] items-start">
        {/* File tree / grouping */}
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
          <div className="flex items-center gap-2 mb-3 text-white/70 text-sm">
            <FolderTree className="w-4 h-4" />
            <span className="font-semibold">Files</span>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Filter files"
              className="w-full rounded-sm bg-black/50 border border-white/15 px-9 py-2 text-xs text-white/85 placeholder:text-white/45 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1 max-h-[620px] overflow-auto pr-1">
            <button
              className={`w-full text-left rounded-sm px-3 py-2 text-xs font-semibold transition-colors border-l-2 border ${
                selectedFilePath === null
                  ? "bg-white/5 border-l-white text-white"
                  : "bg-transparent border-white/5 text-white/70 hover:border-white/25 hover:border-l-white/40 hover:text-white"
              }`}
              onClick={() => setSelectedFilePath(null)}
            >
              All files ({filteredViolations.length})
            </button>

            {visibleFileGroups.length === 0 && (
              <div className="text-[11px] text-white/50 px-2 py-2">No files match that filter.</div>
            )}

            {visibleFileGroups.map((group) => {
              const isActive = selectedFilePath === group.filePath
              const name = group.filePath.split("/").pop() || group.filePath
              const dir = group.filePath.includes("/") ? group.filePath.slice(0, group.filePath.lastIndexOf("/")) : ""
              return (
                <button
                  key={group.filePath}
                  className={`w-full text-left rounded-sm px-3 py-2 text-xs transition-colors border-l-2 border flex flex-col gap-1 ${
                    isActive
                      ? "bg-white/5 border-l-white text-white"
                      : "bg-transparent border-l-transparent text-white/75 hover-border-l-white/30 hover:text-white"
                  }`}
                  onClick={() => setSelectedFilePath(group.filePath)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{name}</span>
                    <span className="text-[11px] text-white/50">{group.violations.length}</span>
                  </div>
                  {dir && <span className="text-[10px] text-white/45 truncate">{dir}</span>}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-white/60">
                    {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
                      <span key={sev} className={`inline-flex items-center gap-1 ${severityTone(sev)}`}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        {group.counts[sev] || 0}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Violations + detail */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] items-start">
          <div className="rounded-md border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between mb-2 text-white/70 text-sm">
              <div className="font-semibold">Violations</div>
              <div className="text-[11px] text-white/60">{visibleViolations.length} shown</div>
            </div>
            <div className="max-h-[620px] overflow-auto divide-y divide-white/5">
              {visibleViolations.length === 0 && (
                <div className="text-[12px] text-white/50 px-2 py-6 text-center">No violations match these filters.</div>
              )}
              {visibleViolations.map((v) => {
                const isActive = v.id === selectedViolation?.id
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedViolationId(v.id)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-white/5 text-white"
                        : "bg-transparent text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className={`inline-flex items-center gap-1 font-semibold ${severityTone(v.severity)}`}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {v.severity}
                        </span>
                        <span className="text-white/60 text-[11px]">{v.detectionMethod}</span>
                        <span className="font-mono text-[11px] text-white/65">{v.controlId}</span>
                      </div>
                      <span className="text-[11px] text-white/60 font-mono shrink-0">{v.filePath}:{v.lineNumber}</span>
                    </div>
                    <p className="text-sm text-white/90 leading-snug line-clamp-2 mt-1">{v.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-black/30 p-4 min-h-[420px]">
            {selectedViolation ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-[12px] text-white/70">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 font-semibold ${severityTone(selectedViolation.severity)}`}>
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {selectedViolation.severity}
                    </span>
                    <span className="text-white/60 text-[11px]">{selectedViolation.detectionMethod}</span>
                    <span className="font-mono text-[11px] text-white/70">{selectedViolation.controlId}</span>
                    {selectedViolation.confidenceScore !== undefined && (
                      <span className="text-white/60">Confidence {Math.round(selectedViolation.confidenceScore * 100)}%</span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/60 font-mono">{selectedViolation.filePath}:{selectedViolation.lineNumber}</span>
                </div>

                <p className="text-base text-white/90 leading-snug">{selectedViolation.description}</p>

                <div className="rounded-lg border border-white/10 bg-[#0b0b0b] p-3 font-mono text-xs text-white/85 overflow-auto">
                  {selectedViolation.codeSnippet ? (
                    <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                      {selectedViolation.codeSnippet.split("\\n").map((line, idx, arr) => {
                        const anchor = selectedViolation.lineNumber || 0
                        const startLine = Math.max(1, anchor - Math.floor(arr.length / 2))
                        const lineNumber = startLine + idx
                        const isTarget = lineNumber === anchor
                        return (
                          <div key={`${selectedViolation.id}-line-${idx}`} className="contents">
                            <span className="text-white/30 text-right select-none">
                              {lineNumber > 0 ? lineNumber : ""}
                            </span>
                            <pre
                              className={`whitespace-pre-wrap font-mono leading-relaxed ${
                                isTarget ? "bg-white/5 text-white px-2 rounded" : ""
                              }`}
                            >
                              {line || "\u00a0"}
                            </pre>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-white/50">No code snippet available for this violation.</div>
                  )}
                </div>

                {(selectedViolation.llmReasoning || selectedViolation.regexReasoning) && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 mb-1">Why this is flagged</div>
                    <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                      {selectedViolation.llmReasoning || selectedViolation.regexReasoning}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 text-[12px] text-white/60">
                  <span className="px-2 py-1 rounded border border-white/10 bg-white/5">Detected {formatRelativeTime(selectedViolation.detectedAt)}</span>
                  <span className="px-2 py-1 rounded border border-white/10 bg-white/5">Scan #{selectedViolation.scanId}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/60">No violation selected.</div>
            )}
          </div>
        </div>
      </div>
      {costLimitPrompt.open && costLimitPrompt.data && (
        <CostLimitDialog
          currentCost={costLimitPrompt.data.currentCost}
          costLimit={costLimitPrompt.data.costLimit}
          filesAnalyzed={costLimitPrompt.data.filesAnalyzed}
          totalFiles={costLimitPrompt.data.totalFiles}
          onContinue={continueAfterCostLimit}
          onStop={stopAfterCostLimit}
        />
      )}
    </div>
  )
}
