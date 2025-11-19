"use client"

import { useMemo, useState } from "react"
import { Play } from "lucide-react"
import { CostLimitDialog } from "@/components/scan/cost-limit-dialog"
import { LastScanSummary } from "@/components/scan/last-scan-summary"
import { ScanControls } from "@/components/scan/scan-controls"
import { ScanProgressCard } from "@/components/scan/scan-progress-card"
import { SeverityFilter } from "@/components/scan/severity-filter"
import { ViolationsTable } from "@/components/scan/violations-table"
import { Button } from "@/components/ui/button"
import { useScanData } from "@/components/scan/hooks/use-scan-data"
import { useScanRunner } from "@/components/scan/hooks/use-scan-runner"
import { useProjectStore } from "@/lib/stores/project-store"
import type { Severity } from "@/lib/types/violation"
import { formatDateTime } from "@/lib/utils/date"
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
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">Scan Results</h1>
        <p className="text-lg text-white/60">
          Configure, run, and review compliance scans for {selectedProject.name}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-12 gap-6 animate-fade-in-up delay-100">
        <div className="col-span-8 space-y-6">
          <ScanControls selectedControls={selectedControls} onToggle={toggleControl} />
        </div>

        <div className="col-span-4 space-y-6">
          <LastScanSummary
            lastScan={lastScan}
            lastScanCost={lastScanCost}
            lastScanStats={lastScanStats}
          />
          <Button
            onClick={handleStartScan}
            disabled={isScanning || isLoading}
            size="lg"
            className="w-full gap-2 h-14"
          >
            <Play className="w-5 h-5" />
            {isScanning ? "Scanning..." : "Start New Scan"}
          </Button>
        </div>
      </div>

      {isScanning && <ScanProgressCard progress={progress} />}

      <div className="mb-6 animate-fade-in-up delay-300 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold leading-none tracking-tight mb-2">Violations</h2>
          <p className="text-white/60">{filteredViolations.length} violations found</p>
        </div>
        {lastScan && (
          <p className="text-xs text-white/40">
            Last scan {formatDateTime(lastScan.createdAt || lastScan.startedAt)}
          </p>
        )}
      </div>

      <SeverityFilter
        selected={selectedSeverity}
        onSelect={setSelectedSeverity}
        violations={violations}
      />

      <ViolationsTable violations={filteredViolations} />

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
