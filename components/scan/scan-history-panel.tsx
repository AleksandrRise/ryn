"use client"

import { PiCaretDown, PiCaretRight, PiClock, PiFileText, PiWarning, PiLightning, PiCurrencyDollar, PiClockCounterClockwise } from "react-icons/pi"
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
      {/* Card container with subtle glow effect */}
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
        className={`
          group relative rounded-xl border transition-all duration-200 ease-out cursor-pointer
          ${isExpanded
            ? "border-white/10 bg-white/[0.03]"
            : "border-white/[0.08] bg-gradient-to-r from-white/[0.02] to-transparent hover:border-white/15 hover:from-white/[0.04]"
          }
        `}
      >
        {/* Subtle gradient accent line at top */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-xl" />

        {/* Header row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Animated icon container */}
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200
              ${isExpanded
                ? "bg-white/10"
                : "bg-gradient-to-br from-purple-500/20 to-blue-500/20 group-hover:from-purple-500/30 group-hover:to-blue-500/30"
              }
            `}>
              <PiClockCounterClockwise className={`w-4 h-4 transition-colors ${isExpanded ? "text-white/70" : "text-purple-400"}`} />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white/90">Scan History</span>
              <span className="text-xs text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded-md">
                {completedScans.length}
              </span>
              {isExpanded ? (
                <PiCaretDown className="w-4 h-4 text-white/40" />
              ) : (
                <PiCaretRight className="w-4 h-4 text-white/40" />
              )}
            </div>
          </div>

          {/* Collapsed: show current scan stats as stylish chips */}
          {!isExpanded && currentScanStats.completedAt && (
            <div className="flex items-center gap-2">
              {/* Timestamp chip */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <PiClock className="w-3 h-3 text-white/50" />
                <span className="text-[11px] text-white/60">{formatDateTime(currentScanStats.completedAt)}</span>
              </div>

              {/* Mode chip with gradient */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                <PiLightning className="w-3 h-3 text-purple-400" />
                <span className="text-[11px] font-medium text-purple-300">{modeLabels[currentScanStats.mode] || currentScanStats.mode}</span>
              </div>

              {/* Files chip */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <PiFileText className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] text-white/70">{currentScanStats.filesScanned}</span>
              </div>

              {/* Violations chip - highlighted if > 0 */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                currentScanStats.violationsFound > 0
                  ? "bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20"
                  : "bg-white/[0.04] border-white/[0.06]"
              }`}>
                <PiWarning className={`w-3 h-3 ${currentScanStats.violationsFound > 0 ? "text-orange-400" : "text-white/50"}`} />
                <span className={`text-[11px] font-medium ${currentScanStats.violationsFound > 0 ? "text-orange-300" : "text-white/70"}`}>
                  {currentScanStats.violationsFound}
                </span>
              </div>

              {/* Cost chip */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <PiCurrencyDollar className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px] font-medium text-emerald-300">{currentScanStats.cost}</span>
              </div>
            </div>
          )}

          {/* Detail level toggle - only when expanded */}
          {isExpanded && (
            <div
              className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5"
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
                    px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]
                    ${detailLevel === option.value
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
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
          <div className="px-4 pb-4">
            <div className="space-y-1.5 max-h-[240px] overflow-auto pr-1">
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
          </div>
        )}
      </div>
    </div>
  )
}
