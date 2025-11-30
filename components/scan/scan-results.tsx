"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Play, Search, Sparkles, Check, Github, Folder, X } from "lucide-react"
import { CostLimitDialog } from "@/components/scan/cost-limit-dialog"
import { ScanControls } from "@/components/scan/scan-controls"
import { ScanHistoryPanel } from "@/components/scan/scan-history-panel"
import { ScanProgressCard } from "@/components/scan/scan-progress-card"
import { SeverityFilter } from "@/components/scan/severity-filter"
import { Button } from "@/components/ui/button"
import { useScanData } from "@/components/scan/hooks/use-scan-data"
import { useScanRunner } from "@/components/scan/hooks/use-scan-runner"
import { useProjectStore } from "@/lib/stores/project-store"
import { useScanHistoryStore } from "@/lib/stores/scan-history-store"
import type { Severity, Violation } from "@/lib/types/violation"
import { formatDateTime } from "@/lib/utils/date"
import { handleTauriError, showInfo, showSuccess } from "@/lib/utils/error-handler"
import { apply_fix, generate_fix, get_violation, read_file_content, type Fix } from "@/lib/tauri/commands"

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
    allScans,
    loadScanData,
  } = useScanData(selectedProject?.id)

  // Scan history state
  const {
    isExpanded: historyExpanded,
    toggleExpanded: toggleHistoryExpanded,
    detailLevel,
    setDetailLevel,
    selectedScanId,
    setSelectedScanId,
  } = useScanHistoryStore()

  const [historicalViolations, setHistoricalViolations] = useState<Violation[]>([])
  const [loadingScanId, setLoadingScanId] = useState<number | null>(null)

  const {
    isScanning,
    progress,
    costLimitPrompt,
    aiActivity,
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

  // Violation selection and search state
  const [selectedViolationId, setSelectedViolationId] = useState<number | null>(null)
  const [fileSearch, setFileSearch] = useState("")

  // Check if any filter is active (for showing "Clear filters" button)
  const hasActiveFilters = useMemo(() => {
    return (
      selectedSeverity !== "all" ||
      Object.values(selectedControls).some(v => v === false) ||
      fileSearch.trim() !== ""
    )
  }, [selectedSeverity, selectedControls, fileSearch])

  // Clear all filters at once
  const clearAllFilters = useCallback(() => {
    setSelectedSeverity("all")
    setSelectedControls({
      "CC6.1": true,
      "CC6.7": true,
      "CC7.2": true,
      "A1.2": true,
    })
    setFileSearch("")
  }, [])

  // Handle selecting a historical scan
  const handleSelectHistoricalScan = useCallback(async (scanId: number) => {
    // If selecting the latest scan, clear historical selection
    if (lastScan && scanId === lastScan.id) {
      setSelectedScanId(null)
      setHistoricalViolations([])
      return
    }

    setSelectedScanId(scanId)
    setLoadingScanId(scanId)
    try {
      const data = await loadScanData(scanId)
      setHistoricalViolations(data.violations)
    } finally {
      setLoadingScanId(null)
    }
  }, [lastScan, loadScanData, setSelectedScanId])

  // Clear historical selection when project changes
  useEffect(() => {
    setSelectedScanId(null)
    setHistoricalViolations([])
  }, [selectedProject?.id, setSelectedScanId])

  // Determine which violations to display (historical vs current)
  const isViewingHistorical = selectedScanId !== null && selectedScanId !== lastScan?.id
  const activeViolations = isViewingHistorical ? historicalViolations : violations

  const filteredViolations = useMemo(
    () =>
      activeViolations.filter((violation) => {
        const matchesSeverity = selectedSeverity === "all" || violation.severity === selectedSeverity
        const matchesControl = selectedControls[violation.controlId] !== false
        return matchesSeverity && matchesControl
      }),
    [selectedSeverity, selectedControls, activeViolations],
  )

  const [isGeneratingFix, setIsGeneratingFix] = useState(false)
  const [generatedFix, setGeneratedFix] = useState<Fix | null>(null)
  const [isApplyingFix, setIsApplyingFix] = useState(false)
  const [isCodeExpanded, setIsCodeExpanded] = useState(false)
  const [fullFileContent, setFullFileContent] = useState<string | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)

  const lastCostDisplay = lastScanCost ? `$${lastScanCost.totalCostUsd.toFixed(3)}` : "–"
  const lastMode = lastScan?.scanMode ? lastScan.scanMode : "regex_only"
  const isGitHubSnapshot = selectedProject?.path.includes("ryn-github-cache") ?? false

  // Current violation list narrowed by file search
  const visibleViolations = useMemo(() => {
    const term = fileSearch.trim().toLowerCase()
    if (!term) return filteredViolations
    return filteredViolations.filter((v) => v.filePath.toLowerCase().includes(term))
  }, [filteredViolations, fileSearch])

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

  // Load existing fix from database when violation changes
  useEffect(() => {
    setIsCodeExpanded(false)
    setFullFileContent(null)

    // Load existing fix for this violation if one exists
    const loadExistingFix = async () => {
      if (!selectedViolationId) {
        setGeneratedFix(null)
        return
      }

      try {
        const detail = await get_violation(selectedViolationId)
        if (detail.fix) {
          setGeneratedFix(detail.fix)
        } else {
          setGeneratedFix(null)
        }
      } catch (error) {
        console.error("Failed to load existing fix:", error)
        setGeneratedFix(null)
      }
    }

    loadExistingFix()
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
      setGeneratedFix(fix)
      showSuccess("Fix generated successfully!")
    } catch (error) {
      handleTauriError(error, "Failed to generate fix")
    } finally {
      setIsGeneratingFix(false)
    }
  }

  const handleApplyFix = () => {
    if (!selectedViolation) return
    setShowApplyConfirm(true)
  }

  const confirmApplyFix = async () => {
    if (!selectedViolation) return

    setIsApplyingFix(true)
    try {
      let fixToApply = generatedFix

      // If no fix was generated yet, generate one first
      if (!fixToApply) {
        showInfo("Generating fix with Grok...")
        fixToApply = await generate_fix(selectedViolation.id)
        setGeneratedFix(fixToApply)
      }

      showInfo("Applying fix to file...")
      await apply_fix(fixToApply.id)
      showSuccess("Fix applied successfully! File has been modified.")

      // Reflect applied state locally and refresh violation list
      setGeneratedFix((prev) => (prev ? { ...prev, applied_at: new Date().toISOString() } : { ...fixToApply!, applied_at: new Date().toISOString() }))
      setShowApplyConfirm(false)
      await reload()
    } catch (error) {
      handleTauriError(error, "Failed to apply fix")
    } finally {
      setIsApplyingFix(false)
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
      const content = await read_file_content(fullPath)
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
      <div className="px-6 pt-8 pb-12 max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-2">Scans</h1>
          <p className="text-white/60">Select a project from the header to view and run scans.</p>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">No project selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 pt-8 pb-12 max-w-7xl mx-auto space-y-6">
      {/* Top bar: title + primary actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in-up">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Scans</h1>
          <p className="text-xs text-white/40 flex items-center gap-1.5">
            {selectedProject.path.includes("ryn-github-cache") ? (
              <>
                <Github className="w-3 h-3" />
                <span>{selectedProject.name}</span>
              </>
            ) : (
              <>
                <Folder className="w-3 h-3" />
                <span>{selectedProject.name}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Scan History Panel */}
      <ScanHistoryPanel
        scans={allScans}
        selectedScanId={selectedScanId}
        onSelectScan={handleSelectHistoricalScan}
        detailLevel={detailLevel}
        onDetailLevelChange={setDetailLevel}
        isExpanded={historyExpanded}
        onToggleExpanded={toggleHistoryExpanded}
        loadingScanId={loadingScanId}
        currentScanStats={{
          filesScanned: lastScanStats.filesScanned,
          violationsFound: lastScanStats.violationsFound,
          completedAt: lastScanStats.completedAt,
          mode: lastMode,
          cost: lastCostDisplay,
        }}
        currentScanCost={lastScanCost}
      />

      {/* Filters row */}
      <div className="flex items-center justify-end gap-3 text-xs animate-fade-in-up delay-100">
        <ScanControls selectedControls={selectedControls} onToggle={toggleControl} />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/55">Severity</span>
          <SeverityFilter selected={selectedSeverity} onSelect={setSelectedSeverity} violations={activeViolations} />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-white/60 hover:text-white transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Historical scan banner */}
      {isViewingHistorical && (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-fade-in-up">
          <span className="text-sm text-amber-200">
            Viewing historical scan from {formatDateTime(allScans.find(s => s.id === selectedScanId)?.completedAt || "")}
          </span>
          <button
            onClick={() => {
              setSelectedScanId(null)
              setHistoricalViolations([])
            }}
            className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200 transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]"
          >
            <X className="w-3.5 h-3.5" />
            View latest
          </button>
        </div>
      )}

      {isScanning && <ScanProgressCard progress={progress} aiActivity={aiActivity} onCancel={cancelScan} />}

      <div className="rounded-2xl border border-white/[0.04] bg-white/5 p-5 grid gap-6 xl:grid-cols-[380px_1fr] items-stretch min-h-[560px] animate-fade-in-up delay-200">
        {/* Violations */}
        <div className="flex flex-col gap-3 xl:border-r xl:border-white/[0.06] xl:pr-5">
          <div className="flex items-center justify-between text-sm text-white/75">
            <div className="font-semibold">Violations</div>
            <div className="text-[11px] text-white/50">{filteredViolations.length} total</div>
          </div>

          {/* Search within violations */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Filter by file..."
              className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-9 py-2 text-xs text-white/85 placeholder:text-white/40 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-auto rounded-lg bg-white/[0.02] divide-y divide-white/[0.04] border border-white/[0.04]">
            {visibleViolations.length === 0 && (
              <div className="text-xs text-white/50 px-4 py-8 text-center">No violations match these filters.</div>
            )}
            {visibleViolations.map((v) => {
              const isActive = v.id === selectedViolation?.id
              const fileName = v.filePath.split("/").pop() || v.filePath
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedViolationId(v.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    isActive
                      ? "bg-white/[0.08]"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2 w-2 rounded-full ${
                      v.severity === "critical" ? "bg-red-400" :
                      v.severity === "high" ? "bg-orange-400" :
                      v.severity === "medium" ? "bg-yellow-400" :
                      "bg-white/40"
                    }`} />
                    <span className="text-xs font-mono text-white/50">{v.controlId}</span>
                    <span className="text-[10px] text-white/40">{v.detectionMethod}</span>
                  </div>
                  <p className="text-sm text-white/90 leading-snug line-clamp-2 mb-1.5">{v.description}</p>
                  <div className="text-[11px] text-white/40 font-mono truncate">{fileName}:{v.lineNumber}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[12px] text-white/70">
            <div className="flex items-center gap-2">
              {selectedViolation ? (
                <>
                  <span className={`h-2 w-2 rounded-full ${
                    selectedViolation.severity === "critical" ? "bg-red-400" :
                    selectedViolation.severity === "high" ? "bg-orange-400" :
                    selectedViolation.severity === "medium" ? "bg-yellow-400" :
                    "bg-white/40"
                  }`} />
                  <span className="font-mono text-white/60">{selectedViolation.controlId}</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/50">{selectedViolation.detectionMethod}</span>
                  {selectedViolation.confidenceScore !== undefined && selectedViolation.confidenceScore > 0 && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="text-white/50">{Math.round(selectedViolation.confidenceScore * 100)}%</span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-white/50">No violation selected</span>
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
                    className="text-xs text-white/60 hover:text-white transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
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
                    <pre className="whitespace-pre-wrap">{generatedFix.fixed_code}</pre>
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
                  disabled={isGeneratingFix || generatedFix !== null}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingFix ? "Generating..." : generatedFix ? "Suggested" : "Suggest Fix"}
                </Button>
                <div className="relative group/apply">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleApplyFix}
                    disabled={isApplyingFix || generatedFix?.applied_at !== null || isGitHubSnapshot}
                    className={`gap-2 ${isGitHubSnapshot ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <Check className="w-4 h-4" />
                    {generatedFix?.applied_at ? "Applied" : isApplyingFix ? "Applying..." : "Apply Fix"}
                  </Button>
                  {isGitHubSnapshot && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/95 border border-white/20 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover/apply:opacity-100 group-hover/apply:visible transition-all duration-200 z-50 shadow-lg">
                      Cannot apply fixes to GitHub snapshots.
                      <br />
                      Clone the repo locally to apply fixes.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/20" />
                    </div>
                  )}
                </div>
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

      {/* Apply Fix Confirmation Dialog */}
      {showApplyConfirm && selectedViolation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 max-w-lg">
            <h3 className="text-xl font-bold mb-4">Apply Fix?</h3>
            <p className="text-sm text-white/60 mb-4">
              {generatedFix
                ? "This will modify the file and replace the original code with the suggested fix."
                : "This will generate a fix using AI and then apply it to the file."
              }
              {" "}A backup will be created before any changes are made.
            </p>
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <p className="text-xs text-white/40 mb-1">File to be modified:</p>
              <p className="font-mono text-sm text-white/90">{selectedViolation.filePath}</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-200">
                Warning: This action will modify your source code. {!generatedFix && "A fix will be generated first. "}Make sure you understand the changes.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmApplyFix}
                disabled={isApplyingFix}
                className="flex-1 px-6 py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isApplyingFix ? "Applying..." : generatedFix ? "Apply Fix" : "Generate & Apply"}
              </button>
              <button
                onClick={() => setShowApplyConfirm(false)}
                disabled={isApplyingFix}
                className="flex-1 px-6 py-3 border border-white/10 text-sm rounded-lg hover:bg-white/5 transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
