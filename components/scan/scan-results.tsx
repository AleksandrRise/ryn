"use client"

import { useEffect, useMemo, useState } from "react"
import { Play, RefreshCw, Clock3, Zap, Search, FolderTree, ChevronDown, Sparkles, Check } from "lucide-react"
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
import { generate_fix } from "@/lib/tauri/commands"
import { readTextFile } from "@tauri-apps/plugin-fs"

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
    cancelScan,
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
  const [isGeneratingFix, setIsGeneratingFix] = useState(false)
  const [generatedFix, setGeneratedFix] = useState<string | null>(null)
  const [isCodeExpanded, setIsCodeExpanded] = useState(false)
  const [fullFileContent, setFullFileContent] = useState<string | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)

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

  // Reset fix and expanded state when violation changes
  useEffect(() => {
    setGeneratedFix(null)
    setIsCodeExpanded(false)
    setFullFileContent(null)
  }, [selectedViolationId])

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
      // Silently ignore cancellation - it's intentional, not an error
      const errorMessage = String(error).toLowerCase()
      if (errorMessage.includes("cancelled") || errorMessage.includes("canceled")) {
        console.log("[ScanResults] Scan was cancelled")
        return
      }
      handleTauriError(error, "Failed to start scan")
    }
  }

  const handleSuggestFix = async () => {
    if (!selectedViolation) return

    setIsGeneratingFix(true)
    setGeneratedFix(null)

    try {
      showInfo("Generating fix with Grok...")
      const fix = await generate_fix(selectedViolation.id)
      setGeneratedFix(fix.fixed_code)
      showSuccess("Fix generated successfully!")
    } catch (error) {
      handleTauriError(error, "Failed to generate fix")
    } finally {
      setIsGeneratingFix(false)
    }
  }

  const handleExpandCode = async () => {
    if (!selectedViolation || !selectedProject) return

    if (isCodeExpanded) {
      setIsCodeExpanded(false)
      return
    }

    setIsLoadingFile(true)

    try {
      const fullPath = `${selectedProject.path}/${selectedViolation.filePath}`
      const content = await readTextFile(fullPath)
      setFullFileContent(content)
      setIsCodeExpanded(true)
    } catch (error) {
      handleTauriError(error, "Failed to read full file content")
    } finally {
      setIsLoadingFile(false)
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
          <ScanControls selectedControls={selectedControls} onToggle={toggleControl} />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/55">Severity</span>
            <SeverityFilter selected={selectedSeverity} onSelect={setSelectedSeverity} violations={violations} />
          </div>
        </div>
      </div>

      {isScanning && <ScanProgressCard progress={progress} onCancel={cancelScan} />}

      <div className="rounded-xl border border-white/10 bg-black/25 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] grid gap-5 xl:grid-cols-[260px_360px_1fr] items-start min-h-[520px]">
        {/* Files */}
        <div className="flex flex-col gap-3 xl:border-r xl:border-white/10 xl:pr-4">
          <div className="flex items-center justify-between text-sm text-white/75">
            <div className="flex items-center gap-2 font-semibold">
              <FolderTree className="w-4 h-4" />
              Files
            </div>
            <span className="text-[11px] text-white/50">
              {visibleFileGroups.length || filteredViolations.length} files
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Filter files"
              className="w-full rounded-md bg-white/5 border border-white/10 px-9 py-2 text-xs text-white/85 placeholder:text-white/45 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1 max-h-[640px] overflow-auto pr-1">
            <button
              className={`w-full text-left rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                selectedFilePath === null
                  ? "bg-white/10 text-white"
                  : "bg-transparent text-white/75 hover:bg-white/5 hover:text-white"
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
                  className={`w-full text-left rounded-md px-3 py-2 text-xs transition-colors flex flex-col gap-1 ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "bg-transparent text-white/80 hover:bg-white/5 hover:text-white"
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

        {/* Violations */}
        <div className="flex flex-col gap-3 xl:border-r xl:border-white/10 xl:pr-4">
          <div className="flex items-center justify-between text-sm text-white/75">
            <div className="font-semibold">Violations</div>
            <div className="text-[11px] text-white/60">{visibleViolations.length} shown</div>
          </div>
          <div className="max-h-[640px] overflow-auto rounded-md bg-white/5 divide-y divide-white/5 border border-white/10">
            {visibleViolations.length === 0 && (
              <div className="text-[12px] text-white/60 px-3 py-6 text-center">No violations match these filters.</div>
            )}
            {visibleViolations.map((v) => {
              const isActive = v.id === selectedViolation?.id
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedViolationId(v.id)}
                  className={`w-full text-left px-3 py-3 transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "bg-transparent text-white/85 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className={`inline-flex items-center gap-1 font-semibold ${severityTone(v.severity)}`}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {v.severity}
                      </span>
                      <span className="text-white/60 text-[11px]">{v.detectionMethod}</span>
                      <span className="font-mono text-[11px] text-white/70">{v.controlId}</span>
                    </div>
                    <span className="text-[11px] text-white/60 font-mono shrink-0">{v.filePath}:{v.lineNumber}</span>
                  </div>
                  <p className="text-sm text-white/90 leading-snug line-clamp-2 mt-1">{v.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[12px] text-white/70">
            <div className="flex items-center gap-3">
              {selectedViolation ? (
                <>
                  <span className={`inline-flex items-center gap-1 font-semibold ${severityTone(selectedViolation.severity)}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {selectedViolation.severity}
                  </span>
                  <span className="text-white/60 text-[11px]">{selectedViolation.detectionMethod}</span>
                  <span className="font-mono text-[11px] text-white/70">{selectedViolation.controlId}</span>
                </>
              ) : (
                <span className="text-white/60">No violation selected.</span>
              )}
            </div>
            {selectedViolation && (
              <span className="text-[11px] text-white/60 font-mono">{selectedViolation.filePath}:{selectedViolation.lineNumber}</span>
            )}
          </div>

          {selectedViolation && (
            <div className="space-y-3">
              <p className="text-base text-white/90 leading-snug">{selectedViolation.description}</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/70">Code Snippet</span>
                  <button
                    onClick={handleExpandCode}
                    disabled={isLoadingFile}
                    className="text-xs text-white/60 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {isLoadingFile ? "Loading..." : isCodeExpanded ? "Show snippet only" : "Expand full file"}
                  </button>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#0c0c0c] p-3 font-mono text-xs text-white/85 overflow-auto shadow-inner max-h-[400px]">
                  {isCodeExpanded && fullFileContent ? (() => {
                    const codeLines = fullFileContent.split(/\r?\n/)
                    return (
                      <div className="grid grid-cols-[auto,1fr] gap-x-3">
                        {codeLines.map((line, idx) => {
                          const lineNumber = idx + 1
                          const isTarget = lineNumber === selectedViolation.lineNumber
                          return (
                            <div key={`${selectedViolation.id}-fullline-${idx}`} className="contents">
                              <span className="text-white/30 text-right select-none">
                                {lineNumber}
                              </span>
                              <pre
                                className={`whitespace-pre-wrap font-mono leading-snug ${
                                  isTarget ? "bg-white/10 text-white px-2 rounded" : ""
                                }`}
                              >
                                {line || "\u00a0"}
                              </pre>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })() : selectedViolation.codeSnippet ? (() => {
                    const codeLines = selectedViolation.codeSnippet.split(/\r?\n/)
                    const anchor = selectedViolation.lineNumber || 0
                    const startLine = Math.max(1, anchor - Math.floor(codeLines.length / 2))
                    return (
                      <div className="grid grid-cols-[auto,1fr] gap-x-3">
                        {codeLines.map((line, idx) => {
                          const lineNumber = startLine + idx
                          const isTarget = lineNumber === anchor
                          return (
                            <div key={`${selectedViolation.id}-line-${idx}`} className="contents">
                              <span className="text-white/30 text-right select-none">
                                {lineNumber > 0 ? lineNumber : ""}
                              </span>
                              <pre
                                className={`whitespace-pre-wrap font-mono leading-relaxed ${
                                  isTarget ? "bg-white/10 text-white px-2 rounded" : ""
                                }`}
                              >
                                {line || "\u00a0"}
                              </pre>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })() : (
                    <div className="text-white/50">No code snippet available for this violation.</div>
                  )}
                </div>
              </div>

              {generatedFix && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400/90 mb-2">Suggested Fix</div>
                  <div className="rounded bg-[#0c0c0c] p-3 font-mono text-xs text-white/85 overflow-auto max-h-[300px]">
                    <pre className="whitespace-pre-wrap">{generatedFix}</pre>
                  </div>
                </div>
              )}

              {(selectedViolation.llmReasoning || selectedViolation.regexReasoning) && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 mb-1">Why this is flagged</div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {selectedViolation.llmReasoning || selectedViolation.regexReasoning}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSuggestFix}
                  disabled={isGeneratingFix}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingFix ? "Generating..." : "Suggest Fix"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  className="gap-2 opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Apply Fix
                </Button>
              </div>
            </div>
          )}
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
