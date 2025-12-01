"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PiPlay, PiMagnifyingGlass, PiSparkle, PiCheck, PiGithubLogo, PiFolder, PiX, PiCaretDown, PiCaretUp } from "react-icons/pi"
import { CostLimitDialog } from "@/components/scan/cost-limit-dialog"
import { ScanHistoryPanel } from "@/components/scan/scan-history-panel"
import { ScanProgressCard } from "@/components/scan/scan-progress-card"
import { SeverityFilter } from "@/components/scan/severity-filter"
import { CategoryScrubber, CATEGORY_CONFIG } from "@/components/scan/category-scrubber"
import { Button } from "@/components/ui/button"
import { CodeSnippet, CodeBlock } from "@/components/ui/code-display"
import { useScanData } from "@/components/scan/hooks/use-scan-data"
import { useScanRunner } from "@/components/scan/hooks/use-scan-runner"
import { useProjectStore } from "@/lib/stores/project-store"
import { useScanHistoryStore } from "@/lib/stores/scan-history-store"
import type { Severity, Violation } from "@/lib/types/violation"
import { formatDateTime } from "@/lib/utils/date"
import { handleTauriError, showInfo, showSuccess } from "@/lib/utils/error-handler"
import { apply_fix, generate_fix, get_violation, read_file_content, type Fix } from "@/lib/tauri/commands"

// Category order for consistent rendering
const CATEGORY_ORDER = ["CC6.1", "CC6.7", "CC7.2", "A1.2"]

export function ScanResults() {
  const { selectedProject } = useProjectStore()
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all")

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

  // Violation selection and search state
  const [selectedViolationId, setSelectedViolationId] = useState<number | null>(null)
  const [fileSearch, setFileSearch] = useState("")

  // Category navigation refs
  const violationsListRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  // Flag to prevent scroll listener from fighting with click handler during smooth scroll
  const isScrollingProgrammatically = useRef(false)
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false)


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
        return selectedSeverity === "all" || violation.severity === selectedSeverity
      }),
    [selectedSeverity, activeViolations],
  )

  const [isGeneratingFix, setIsGeneratingFix] = useState(false)
  const [generatedFix, setGeneratedFix] = useState<Fix | null>(null)
  const [isApplyingFix, setIsApplyingFix] = useState(false)
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

  // Group violations by category (control ID)
  const groupedViolations = useMemo(() => {
    const groups: Record<string, Violation[]> = {}
    for (const v of visibleViolations) {
      if (!groups[v.controlId]) groups[v.controlId] = []
      groups[v.controlId].push(v)
    }
    // Return in defined order
    return CATEGORY_ORDER.filter(id => groups[id]?.length > 0).map(id => ({
      categoryId: id,
      violations: groups[id],
    }))
  }, [visibleViolations])

  // Category counts for scrubber
  const categoryInfos = useMemo(() => {
    return CATEGORY_ORDER.map(id => ({
      id,
      count: visibleViolations.filter(v => v.controlId === id).length,
    }))
  }, [visibleViolations])

  // Handle category click from scrubber
  const handleCategoryClick = useCallback((categoryId: string) => {
    const ref = categoryRefs.current[categoryId]
    if (ref && violationsListRef.current) {
      // Prevent scroll listener from overriding our selection during smooth scroll
      isScrollingProgrammatically.current = true
      setActiveCategory(categoryId)
      ref.scrollIntoView({ behavior: "smooth", block: "start" })
      // Re-enable scroll detection after animation completes (~500ms for smooth scroll)
      setTimeout(() => {
        isScrollingProgrammatically.current = false
      }, 500)
    }
  }, [])

  // Track active category on scroll
  useEffect(() => {
    const container = violationsListRef.current
    if (!container) return

    const handleScroll = () => {
      // Skip if we're doing a programmatic scroll (from clicking a category)
      if (isScrollingProgrammatically.current) return

      const containerTop = container.getBoundingClientRect().top
      let currentCategory: string | null = null

      for (const categoryId of CATEGORY_ORDER) {
        const ref = categoryRefs.current[categoryId]
        if (ref) {
          const rect = ref.getBoundingClientRect()
          if (rect.top <= containerTop + 50) {
            currentCategory = categoryId
          }
        }
      }
      setActiveCategory(currentCategory)
    }

    container.addEventListener("scroll", handleScroll)
    handleScroll() // Initial check
    return () => container.removeEventListener("scroll", handleScroll)
  }, [groupedViolations])

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

  // Load existing fix and full file content when violation changes
  useEffect(() => {
    setFullFileContent(null)
    setIsReasoningExpanded(false)

    if (!selectedViolationId) {
      setGeneratedFix(null)
      return
    }

    // Load existing fix for this violation if one exists
    const loadExistingFix = async () => {
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

    // Auto-load full file content
    const loadFullFile = async () => {
      if (!selectedProject) return

      const violation = visibleViolations.find(v => v.id === selectedViolationId)
      if (!violation) return

      setIsLoadingFile(true)
      try {
        const fullPath = `${selectedProject.path}/${violation.filePath}`
        const content = await read_file_content(fullPath)
        setFullFileContent(content)
      } catch (error) {
        // File may not exist if project folder was deleted - this is recoverable
        console.warn("File not available, showing stored snippet:", error)
        setFullFileContent(null) // Will fall back to snippet
      } finally {
        setIsLoadingFile(false)
      }
    }

    loadExistingFix()
    loadFullFile()
  }, [selectedViolationId, selectedProject, visibleViolations])

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


  if (!selectedProject) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
            <PiFolder className="w-8 h-8 text-white/40" />
          </div>
          <h2 className="text-xl font-semibold text-white/90 mb-2">No project selected</h2>
          <p className="text-sm text-white/50">Select a project from the header to view and run compliance scans.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col px-6 pt-4 pb-4 max-w-7xl mx-auto">
      {/* Top bar: project info + primary actions */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 pb-3 animate-fade-in-up">
        {/* Project badge */}
        <div className="flex items-center gap-3">
          <div className={`
            flex items-center justify-center w-10 h-10 rounded-xl
            ${selectedProject.path.includes("ryn-github-cache")
              ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20"
              : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20"
            }
          `}>
            {selectedProject.path.includes("ryn-github-cache") ? (
              <PiGithubLogo className="w-5 h-5 text-purple-400" />
            ) : (
              <PiFolder className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white/95 tracking-tight">{selectedProject.name}</h1>
            <p className="text-[11px] text-white/40 font-mono truncate max-w-[300px]">
              {selectedProject.path.includes("ryn-github-cache") ? "GitHub Repository" : selectedProject.path}
            </p>
          </div>
        </div>

        <Button
          onClick={handleStartScan}
          disabled={isScanning || isLoading}
          size="sm"
          className="gap-2"
        >
          <PiPlay className="w-4 h-4" />
          {isScanning ? "Scanning..." : "Start scan"}
        </Button>
      </div>

      {/* Scan History Panel */}
      <div className="shrink-0 pb-2">
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
      </div>

      {/* Filters row */}
      <div className="shrink-0 flex items-center gap-2 text-xs pb-3 animate-fade-in-up delay-100">
        <span className="text-[11px] text-white/55">Severity</span>
        <SeverityFilter selected={selectedSeverity} onSelect={setSelectedSeverity} violations={activeViolations} />
      </div>

      {/* Historical scan banner */}
      {isViewingHistorical && (
        <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-fade-in-up">
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
            <PiX className="w-3.5 h-3.5" />
            View latest
          </button>
        </div>
      )}

      {isScanning && <ScanProgressCard progress={progress} aiActivity={aiActivity} onCancel={cancelScan} />}

      {/* Main content - flex-1 takes remaining space */}
      <div className="flex-1 min-h-0 grid xl:grid-cols-[420px_1fr] gap-4 animate-fade-in-up delay-200">
        {/* Violations Panel with Scrubber */}
        <div className="flex flex-col min-h-0 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90">Violations</span>
              <span className="text-[11px] text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded">{filteredViolations.length}</span>
            </div>
          </div>

          {/* Search */}
          <div className="shrink-0 px-3 py-2 border-b border-white/[0.04]">
            <div className="relative">
              <PiMagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="Filter by file..."
                className="w-full rounded-md bg-white/[0.04] border border-white/[0.06] pl-8 pr-3 py-1.5 text-xs text-white/85 placeholder:text-white/40 focus:outline-none focus:border-white/15 transition-colors"
              />
            </div>
          </div>

          {/* Violations list with scrubber */}
          <div className="flex-1 flex min-h-0">
            {/* Scrollable violations list */}
            <div ref={violationsListRef} className="flex-1 overflow-y-auto">
              {visibleViolations.length === 0 ? (
                <div className="text-xs text-white/50 px-4 py-8 text-center">No violations match these filters.</div>
              ) : (
                groupedViolations.map(({ categoryId, violations: categoryViolations }) => {
                  const config = CATEGORY_CONFIG[categoryId]
                  return (
                    <div
                      key={categoryId}
                      ref={(el) => { categoryRefs.current[categoryId] = el }}
                    >
                      {/* Sticky category header */}
                      <div
                        className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/[0.06]"
                        style={{ borderLeftColor: config?.color, borderLeftWidth: 3 }}
                      >
                        <span className="text-[11px] font-mono font-medium text-white/70">{categoryId}</span>
                        <span className="text-[10px] text-white/40">{config?.label}</span>
                        <span className="text-[10px] text-white/30 ml-auto">{categoryViolations.length}</span>
                      </div>

                      {/* Violations in this category */}
                      {categoryViolations.map((v) => {
                        const isActive = v.id === selectedViolation?.id
                        const fileName = v.filePath.split("/").pop() || v.filePath
                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelectedViolationId(v.id)}
                            className={`w-full text-left px-4 py-2.5 border-b border-white/[0.04] transition-colors ${
                              isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                v.severity === "critical" ? "bg-red-400" :
                                v.severity === "high" ? "bg-orange-400" :
                                v.severity === "medium" ? "bg-yellow-400" :
                                "bg-white/40"
                              }`} />
                              <span className="text-[10px] text-white/40">{v.detectionMethod}</span>
                            </div>
                            <p className="text-[13px] text-white/85 leading-snug line-clamp-2 mb-1">{v.description}</p>
                            <div className="text-[10px] text-white/40 font-mono truncate">{fileName}:{v.lineNumber}</div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>

            {/* Category scrubber */}
            <div className="shrink-0 border-l border-white/[0.06] bg-white/[0.02]">
              <CategoryScrubber
                categories={categoryInfos}
                activeCategory={activeCategory}
                onCategoryClick={handleCategoryClick}
              />
            </div>
          </div>
        </div>

        {/* Detail Panel - constrained height with internal scroll */}
        <div className="flex flex-col min-h-0 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 text-[12px]">
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
                <span className="text-sm font-semibold text-white/90">Detail</span>
              )}
            </div>
            {selectedViolation && (
              <span className="text-[10px] text-white/50 font-mono">{selectedViolation.filePath}:{selectedViolation.lineNumber}</span>
            )}
          </div>

          {/* Scrollable content - flex layout for code to fill space */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            {selectedViolation ? (
              <>
                {/* Description - fixed height */}
                <p className="shrink-0 text-[15px] text-white/90 leading-relaxed mb-4">{selectedViolation.description}</p>

                {/* Code - fills available space */}
                <div className="flex-1 min-h-0 flex flex-col mb-4">
                  <span className="shrink-0 text-xs font-semibold text-white/70 mb-2">Code</span>
                  <div className="flex-1 min-h-0">
                    {isLoadingFile ? (
                      <div className="h-full rounded-lg border border-white/10 bg-[#0a0a0a] flex items-center justify-center">
                        <span className="text-white/50 text-sm">Loading file...</span>
                      </div>
                    ) : fullFileContent ? (
                      <CodeSnippet
                        code={fullFileContent}
                        filePath={selectedViolation.filePath}
                        startLineNumber={1}
                        highlightLines={[selectedViolation.lineNumber]}
                        maxHeight="100%"
                        className="h-full shadow-inner"
                      />
                    ) : selectedViolation.codeSnippet ? (() => {
                      const codeLines = selectedViolation.codeSnippet.split(/\r?\n/)
                      const anchor = selectedViolation.lineNumber || 0
                      const startLine = Math.max(1, anchor - Math.floor(codeLines.length / 2))
                      return (
                        <CodeSnippet
                          code={selectedViolation.codeSnippet}
                          filePath={selectedViolation.filePath}
                          startLineNumber={startLine}
                          highlightLines={[anchor]}
                          maxHeight="100%"
                          className="h-full shadow-inner"
                        />
                      )
                    })() : (
                      <div className="h-full rounded-lg border border-white/10 bg-[#0a0a0a] flex items-center justify-center">
                        <span className="text-white/50 text-sm">No code available</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggested Fix - fixed height */}
                {generatedFix && (
                  <div className="shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90 mb-2">Suggested Fix</div>
                    <CodeBlock
                      code={generatedFix.fixed_code}
                      filePath={selectedViolation.filePath}
                      showLineNumbers={true}
                      customStyle={{ maxHeight: "150px", overflow: "auto", padding: "0.75rem" }}
                      className="rounded"
                    />
                  </div>
                )}

                {/* Reasoning - fixed height */}
                {(selectedViolation.llmReasoning || selectedViolation.regexReasoning) && (() => {
                  const reasoning = selectedViolation.llmReasoning || selectedViolation.regexReasoning || ""
                  const isLong = reasoning.length > 300
                  const displayText = isLong && !isReasoningExpanded ? reasoning.slice(0, 300) + "..." : reasoning

                  return (
                    <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Why this is flagged</span>
                        {isLong && (
                          <button
                            onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                          >
                            {isReasoningExpanded ? (
                              <>Less <PiCaretUp className="w-3 h-3" /></>
                            ) : (
                              <>More <PiCaretDown className="w-3 h-3" /></>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{displayText}</p>
                    </div>
                  )
                })()}

                {/* Action buttons - fixed height */}
                <div className="shrink-0 flex items-center gap-2">
                  <Button
                    onClick={handleSuggestFix}
                    disabled={isGeneratingFix || generatedFix !== null}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <PiSparkle className="w-3.5 h-3.5" />
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
                      <PiCheck className="w-3.5 h-3.5" />
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
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-white/40">
                Select a violation to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
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
