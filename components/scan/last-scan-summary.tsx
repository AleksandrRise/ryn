"use client"

import type { ScanCost, ScanSummary } from "@/lib/types/scan"
import { formatDateTime } from "@/lib/utils/date"

interface LastScanSummaryProps {
  lastScan: ScanSummary | null
  lastScanCost: ScanCost | null
  lastScanStats: {
    filesScanned: number
    violationsFound: number
    completedAt: string
  }
}

const MODE_LABELS: Record<string, string> = {
  regex_only: "Pattern Only",
  smart: "Smart",
  analyze_all: "Analyze All",
}

export function LastScanSummary({ lastScan, lastScanCost, lastScanStats }: LastScanSummaryProps) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Last Scan</h3>
        {lastScan && (
          <span className="px-2 py-1 rounded bg-white/10 text-xs text-white/60 border border-white/10">
            {MODE_LABELS[lastScan.scanMode] ?? lastScan.scanMode}
          </span>
        )}
      </div>

      {lastScan ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-white/40 mb-1">Completed</p>
            <p className="text-lg font-bold">{formatDateTime(lastScanStats.completedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Files Scanned</p>
            <p className="text-lg font-bold tabular-nums">{lastScanStats.filesScanned || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Violations Found</p>
            <p className="text-lg font-bold tabular-nums">{lastScanStats.violationsFound}</p>
          </div>

          <div className="pt-4 border-t border-white/10">
            {lastScan.scanMode === "regex_only" ? (
              <p className="text-sm text-white/40 italic">AI disabled for this scan</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">Files Analyzed with AI</p>
                  <p className="text-sm font-bold tabular-nums">{lastScanCost?.filesAnalyzedWithLlm ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">AI Cost</p>
                  <p className="text-sm font-bold tabular-nums">
                    ${lastScanCost ? lastScanCost.totalCostUsd.toFixed(4) : "0.0000"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/40">No scans yet</p>
      )}
    </div>
  )
}
