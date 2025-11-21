"use client"

import type { ScanProgress } from "@/lib/types/scan"
import { FileSearch, Brain, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ScanProgressCardProps {
  progress: ScanProgress
  onCancel?: () => void
}

export function ScanProgressCard({ progress, onCancel }: ScanProgressCardProps) {
  const isWaitingForAI = progress.percentage === 100 && progress.filesScanned === progress.totalFiles

  return (
    <div className="mb-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 animate-fade-in-up delay-200">
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-3 ${isWaitingForAI ? "bg-purple-500/20" : "bg-blue-500/20"} rounded-xl animate-pulse`}>
          {isWaitingForAI ? (
            <Brain className="w-6 h-6 text-purple-400" />
          ) : (
            <FileSearch className="w-6 h-6 text-blue-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {isWaitingForAI ? "Waiting for AI analysis..." : "Scanning files..."}
            </h3>
            {onCancel && (
              <Button
                onClick={onCancel}
                size="sm"
                variant="ghost"
                className="h-7 px-3 gap-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            )}
          </div>
          <p className="text-sm text-white/60 font-mono truncate mt-1">
            {isWaitingForAI
              ? "Processing results from AI model..."
              : (progress.currentFile || "Initializing scan...")
            }
          </p>
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
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
            isWaitingForAI
              ? "bg-gradient-to-r from-purple-500 to-pink-500"
              : "bg-gradient-to-r from-blue-500 to-purple-500"
          }`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  )
}
