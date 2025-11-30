"use client"

import { useEffect, useRef } from "react"
import type { ScanProgress, AiActivity, AiFileStream, SelectionReason } from "@/lib/types/scan"
import { FileSearch, Brain, X, CheckCircle2, Loader2, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ScanProgressCardProps {
  progress: ScanProgress
  aiActivity?: AiActivity
  onCancel?: () => void
}

/** Badge colors for different selection reasons */
const reasonColors: Record<SelectionReason, string> = {
  auth: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  db: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  api: "bg-green-500/20 text-green-300 border-green-500/30",
  secrets: "bg-red-500/20 text-red-300 border-red-500/30",
  file_io: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  network: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  all: "bg-white/10 text-white/70 border-white/20",
}

/** Human-readable labels for selection reasons */
const reasonLabels: Record<SelectionReason, string> = {
  auth: "Auth",
  db: "Database",
  api: "API",
  secrets: "Secrets",
  file_io: "File I/O",
  network: "Network",
  all: "Full Scan",
}

/** Single file stream card showing real-time AI analysis */
function AiStreamCard({ stream }: { stream: AiFileStream }) {
  const textRef = useRef<HTMLDivElement>(null)
  const fileName = stream.filePath.split("/").pop() || stream.filePath
  const dir = stream.filePath.includes("/")
    ? stream.filePath.slice(0, stream.filePath.lastIndexOf("/"))
    : ""
  const isComplete = stream.status === "complete"
  const elapsedMs = Date.now() - stream.startedAt
  const elapsedSec = Math.floor(elapsedMs / 1000)

  // Auto-scroll to bottom as text streams in
  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight
    }
  }, [stream.streamingText])

  return (
    <div
      className={`rounded-lg border p-3 transition-all duration-300 ${
        isComplete
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-white/5 border-white/10"
      }`}
    >
      {/* Header: filename, reason badge, status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-white/50 shrink-0" />
            <span className="text-sm font-medium text-white truncate">{fileName}</span>
          </div>
          {dir && (
            <span className="text-[10px] text-white/40 truncate block ml-5">{dir}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${reasonColors[stream.selectionReason]}`}
          >
            {reasonLabels[stream.selectionReason]}
          </span>
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Streaming text area */}
      <div
        ref={textRef}
        className="h-16 overflow-y-auto rounded bg-black/30 px-2 py-1.5 text-[11px] font-mono text-white/70 leading-relaxed"
      >
        {stream.streamingText || (
          <span className="text-white/30 italic">Waiting for AI response...</span>
        )}
        {!isComplete && stream.streamingText && (
          <span className="inline-block w-1.5 h-3 bg-purple-400 ml-0.5 animate-pulse" />
        )}
      </div>

      {/* Footer: timing and violations */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-white/50">
        <span>{elapsedSec}s elapsed</span>
        {isComplete && (
          <span className={stream.violationsFound > 0 ? "text-amber-300" : "text-emerald-300"}>
            {stream.violationsFound} violation{stream.violationsFound !== 1 ? "s" : ""} found
          </span>
        )}
      </div>
    </div>
  )
}

export function ScanProgressCard({ progress, aiActivity, onCancel }: ScanProgressCardProps) {
  const isWaitingForAI = progress.percentage === 100 && progress.filesScanned === progress.totalFiles
  const isAiAnalyzing = aiActivity?.phase === "analyzing"
  const hasActiveStreams = aiActivity && aiActivity.activeStreams.size > 0

  // Convert Map to sorted array for rendering (active first, then completed)
  const streamsList = aiActivity
    ? Array.from(aiActivity.activeStreams.values()).sort((a, b) => {
        // Sort: analyzing files first, then by start time
        if (a.status !== b.status) {
          return a.status === "analyzing" ? -1 : 1
        }
        return b.startedAt - a.startedAt
      })
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl mx-4 bg-[#0a0a0a] border border-white/[0.06] rounded-2xl p-6 shadow-2xl animate-fade-in-up">
      {/* Main progress header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 ${isAiAnalyzing || isWaitingForAI ? "bg-purple-500/20" : "bg-blue-500/20"} rounded-xl animate-pulse`}>
          {isAiAnalyzing || isWaitingForAI ? (
            <Brain className="w-6 h-6 text-purple-400" />
          ) : (
            <FileSearch className="w-6 h-6 text-blue-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {isAiAnalyzing
                ? "AI analyzing files..."
                : isWaitingForAI
                  ? "Waiting for AI analysis..."
                  : "Scanning files..."}
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
            {isAiAnalyzing && aiActivity
              ? `Batch ${aiActivity.currentBatch} of ${aiActivity.totalBatches} • ${aiActivity.filesAnalyzed}/${aiActivity.totalLlmFiles} files analyzed`
              : isWaitingForAI
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

      {/* Progress bar */}
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-4">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
            isAiAnalyzing || isWaitingForAI
              ? "bg-gradient-to-r from-purple-500 to-pink-500"
              : "bg-gradient-to-r from-blue-500 to-purple-500"
          }`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* AI Activity Panel - shows when AI is analyzing */}
      {hasActiveStreams && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white/80 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              Live AI Analysis
            </h4>
            <span className="text-xs text-white/50">
              {streamsList.filter(s => s.status === "analyzing").length} active •{" "}
              {streamsList.filter(s => s.status === "complete").length} complete
            </span>
          </div>

          {/* Grid of stream cards - responsive: 1 col on mobile, 2 on medium, 3 on large */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {streamsList.map((stream) => (
              <AiStreamCard key={stream.filePath} stream={stream} />
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
