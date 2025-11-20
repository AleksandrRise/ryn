"use client"

import type { ScanProgress } from "@/lib/types/scan"
import { FileSearch } from "lucide-react"

interface ScanProgressCardProps {
  progress: ScanProgress
}

export function ScanProgressCard({ progress }: ScanProgressCardProps) {
  return (
    <div className="mb-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 animate-fade-in-up delay-200">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-blue-500/20 rounded-xl animate-pulse">
          <FileSearch className="w-6 h-6 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-1">Scanning in progress...</h3>
          <p className="text-sm text-white/60 font-mono truncate">{progress.currentFile || "Initializing scan..."}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{progress.percentage}%</div>
          <p className="text-xs text-white/40">
            {progress.filesScanned} / {progress.totalFiles} files
          </p>
        </div>
      </div>
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  )
}
