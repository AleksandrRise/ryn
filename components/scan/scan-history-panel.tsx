"use client"

import { ChevronDown, ChevronRight, Clock3 } from "lucide-react"
import { ScanHistoryEntry } from "@/components/scan/scan-history-entry"
import type { ScanCost, ScanSummary } from "@/lib/types/scan"
import type { DetailLevel } from "@/lib/stores/scan-history-store"
import { formatDateTime } from "@/lib/utils/date"

interface ScanHistoryPanelProps {
  scans: ScanSummary[]
  selectedScanId: number | null
  onSelectScan: (scanId: number) => void
  detailLevel: DetailLevel
  onDetailLevelChange: (level: DetailLevel) => void
  isExpanded: boolean
  onToggleExpanded: () => void
  loadingScanId: number | null
  // Current scan info for collapsed view
  currentScanStats: {
    filesScanned: number
    violationsFound: number
    completedAt: string
    mode: string
    cost: string
  }
  currentScanCost?: ScanCost | null
}

const detailOptions: { value: DetailLevel; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "summary", label: "Summary" },
  { value: "detailed", label: "Detailed" },
]

const modeLabels: Record<string, string> = {
  regex_only: "Pattern only",
  smart: "Smart",
  analyze_all: "Analyze all",
}

export function ScanHistoryPanel({
  scans,
  selectedScanId,
  onSelectScan,
  detailLevel,
  onDetailLevelChange,
  isExpanded,
  onToggleExpanded,
  loadingScanId,
  currentScanStats,
}: ScanHistoryPanelProps) {
  const completedScans = scans.filter(s => s.status === "completed")
  const latestScanId = completedScans[0]?.id

  // Get cost map for completed scans (we'll load costs lazily)
  const costMap = new Map<number, ScanCost | null>()

  return (
    <div className="animate-fade-in-up delay-100">
      {/* Header - always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggleExpanded()
          }
        }}
        className="w-full flex items-center justify-between gap-4 text-xs text-white/65 hover:text-white/80 transition-all duration-150 ease-out hover:scale-[1.005] active:scale-[0.995] py-1 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-white/50" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/50" />
          )}
          <span className="font-medium text-white/75">
            Scan History
            <span className="text-white/50 ml-1">({completedScans.length} scans)</span>
          </span>
        </div>

        {/* Collapsed: show current scan stats inline */}
        {!isExpanded && currentScanStats.completedAt && (
          <div className="flex items-center gap-2 text-white/55">
            <Clock3 className="w-3.5 h-3.5" />
            <span>{formatDateTime(currentScanStats.completedAt)}</span>
            <span className="text-white/30">·</span>
            <span>{modeLabels[currentScanStats.mode] || currentScanStats.mode}</span>
            <span className="text-white/30">·</span>
            <span>{currentScanStats.filesScanned} files</span>
            <span className="text-white/30">·</span>
            <span>{currentScanStats.violationsFound} violations</span>
            <span className="text-white/30">·</span>
            <span>{currentScanStats.cost}</span>
          </div>
        )}

        {/* Detail level toggle - only when expanded */}
        {isExpanded && (
          <div
            className="flex items-center gap-1 bg-white/5 rounded-md p-0.5"
            role="group"
            aria-label="Detail level options"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {detailOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onDetailLevelChange(option.value)}
                className={`
                  px-2 py-1 rounded text-[10px] font-medium transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]
                  ${detailLevel === option.value
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white/70"
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Expanded: scan list */}
      {isExpanded && (
        <div className="mt-2 space-y-1.5 max-h-[240px] overflow-auto pr-1">
          {completedScans.length === 0 ? (
            <div className="text-xs text-white/50 py-4 text-center">
              No completed scans yet. Run your first scan to see history.
            </div>
          ) : (
            completedScans.map((scan, index) => (
              <ScanHistoryEntry
                key={scan.id}
                scan={scan}
                cost={costMap.get(scan.id)}
                isSelected={selectedScanId === scan.id || (selectedScanId === null && index === 0)}
                isLatest={scan.id === latestScanId}
                detailLevel={detailLevel}
                onClick={() => onSelectScan(scan.id)}
                isLoading={loadingScanId === scan.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
