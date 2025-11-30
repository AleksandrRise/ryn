"use client"

import { Loader2 } from "lucide-react"
import type { DetailLevel } from "@/lib/stores/scan-history-store"
import type { Scan } from "@/lib/types"

interface ScanHistoryEntryProps {
  scan: Scan
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
  isSelected,
  isLatest,
  detailLevel,
  onClick,
  isLoading,
}: ScanHistoryEntryProps) {
  const modeLabel = modeLabels[scan.scan_mode] || scan.scan_mode
  const dateDisplay = scan.completed_at || scan.started_at || scan.created_at
  const isInProgress = scan.status === "running"

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString()
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

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
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-white/60 shrink-0" />}

          <span className="text-xs text-white/80 truncate">
            {detailLevel === "detailed"
              ? dateDisplay ? formatDate(dateDisplay) : ""
              : dateDisplay ? formatRelativeTime(dateDisplay) : ""
            }
          </span>

          <span className="text-white/30">·</span>

          <span className={`
            text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0
            ${scan.scan_mode === "smart" || scan.scan_mode === "analyze_all"
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
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
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
        <span>{scan.violations_found} violations</span>

        {detailLevel !== "minimal" && (
          <>
            <span className="text-white/30">·</span>
            <span>{scan.files_scanned} files</span>
          </>
        )}
      </div>

      {/* Severity breakdown - summary and detailed only */}
      {detailLevel !== "minimal" && (
        <div className="flex items-center gap-3 mt-1.5 text-[10px]">
          {scan.critical_count > 0 && (
            <span className="text-red-300 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.critical_count}
            </span>
          )}
          {scan.high_count > 0 && (
            <span className="text-orange-300 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.high_count}
            </span>
          )}
          {scan.medium_count > 0 && (
            <span className="text-yellow-200 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.medium_count}
            </span>
          )}
          {scan.low_count > 0 && (
            <span className="text-white/50 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {scan.low_count}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
