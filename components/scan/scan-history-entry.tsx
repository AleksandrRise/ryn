"use client"

import { PiSpinner } from "react-icons/pi"
import type { ScanCost, ScanSummary } from "@/lib/types/scan"
import type { DetailLevel } from "@/lib/stores/scan-history-store"
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date"

interface ScanHistoryEntryProps {
  scan: ScanSummary
  cost?: ScanCost | null
  isSelected: boolean
  isLatest: boolean
  detailLevel: DetailLevel
  onClick: () => void
  isLoading?: boolean
}

const modeLabels: Record<string, string> = {
  regex_only: "Pattern only",
  smart: "Smart",
  analyze_all: "Analyze all",
}

export function ScanHistoryEntry({
  scan,
  cost,
  isSelected,
  isLatest,
  detailLevel,
  onClick,
  isLoading,
}: ScanHistoryEntryProps) {
  const modeLabel = modeLabels[scan.scanMode] || scan.scanMode
  const costDisplay = cost ? `$${cost.totalCostUsd.toFixed(3)}` : null
  const dateDisplay = scan.completedAt || scan.startedAt
  const isInProgress = scan.status === "running" || scan.status === "in_progress"

  return (
    <button
      onClick={onClick}
      disabled={isLoading || isInProgress}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.99]
        ${isSelected
          ? "bg-white/10 border border-white/20"
          : "bg-white/[0.03] border border-transparent hover:bg-white/5 hover:border-white/10"
        }
        ${isLoading ? "opacity-70" : ""}
        ${isInProgress ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left side: Date and mode */}
        <div className="flex items-center gap-2 min-w-0">
          {isLoading && <PiSpinner className="w-3 h-3 animate-spin text-white/60 shrink-0" />}

          <span className="text-xs text-white/80 truncate">
            {detailLevel === "detailed"
              ? formatDateTime(dateDisplay)
              : formatRelativeTime(dateDisplay) || formatDateTime(dateDisplay)
            }
          </span>

          <span className="text-white/30">·</span>

          <span className={`
            text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0
            ${scan.scanMode === "smart" || scan.scanMode === "analyze_all"
              ? "bg-purple-500/15 text-purple-300"
              : "bg-white/10 text-white/60"
            }
          `}>
            {modeLabel}
          </span>
        </div>

        {/* Right side: Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {isInProgress && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-medium flex items-center gap-1">
              <PiSpinner className="w-2.5 h-2.5 animate-spin" />
              Running
            </span>
          )}
          {isLatest && !isInProgress && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-medium">
              Latest
            </span>
          )}
        </div>
      </div>

      {/* Summary row - always shown */}
      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/60">
        <span>{scan.violationsFound} violations</span>

        {detailLevel !== "minimal" && (
          <>
            <span className="text-white/30">·</span>
            <span>{scan.filesScanned} files</span>
          </>
        )}

        {detailLevel === "detailed" && costDisplay && (
          <>
            <span className="text-white/30">·</span>
            <span>{costDisplay}</span>
          </>
        )}
      </div>

      {/* Severity breakdown - summary and detailed only */}
      {detailLevel !== "minimal" && (
        <div className="flex items-center gap-3 mt-1.5 text-[10px]">
          {scan.criticalCount > 0 && (
            <span className="text-red-300 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.criticalCount}
            </span>
          )}
          {scan.highCount > 0 && (
            <span className="text-orange-300 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.highCount}
            </span>
          )}
          {scan.mediumCount > 0 && (
            <span className="text-yellow-200 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.mediumCount}
            </span>
          )}
          {scan.lowCount > 0 && (
            <span className="text-white/50 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.lowCount}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
