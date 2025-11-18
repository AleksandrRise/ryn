"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, DollarSign } from "lucide-react"

interface CostLimitDialogProps {
  currentCost: number
  costLimit: number
  filesAnalyzed: number
  totalFiles: number
  onContinue: () => void
  onStop: () => void
}

export function CostLimitDialog({
  currentCost,
  costLimit,
  filesAnalyzed,
  totalFiles,
  onContinue,
  onStop,
}: CostLimitDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleContinue = () => {
    setIsProcessing(true)
    onContinue()
  }

  const handleStop = () => {
    setIsProcessing(true)
    onStop()
  }

  const remainingFiles = totalFiles - filesAnalyzed
  const percentComplete = (filesAnalyzed / totalFiles) * 100

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border-2 border-[#f97316] rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-[#f97316]/10 rounded-full">
            <AlertTriangle className="w-6 h-6 text-[#f97316]" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Cost Limit Reached</h3>
            <p className="text-sm text-[#aaaaaa]">AI scanning paused</p>
          </div>
        </div>

        {/* Cost Information */}
        <div className="mb-6 p-4 bg-[#f97316]/5 border border-[#f97316]/20 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#f97316]" />
              <span className="text-sm font-medium text-[#aaaaaa]">Current Cost</span>
            </div>
            <span className="text-xl font-bold text-[#f97316]">${currentCost.toFixed(3)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#aaaaaa]">Limit</span>
            <span className="text-sm font-mono text-white">${costLimit.toFixed(2)}</span>
          </div>
        </div>

        {/* Progress Information */}
        <div className="mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#aaaaaa]">Files analyzed with AI</span>
            <span className="font-mono text-white">
              {filesAnalyzed} / {totalFiles}
            </span>
          </div>
          <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#f97316] to-[#eab308] transition-all duration-300"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
          {remainingFiles > 0 && (
            <p className="text-xs text-[#aaaaaa]">{remainingFiles} files remaining to analyze</p>
          )}
        </div>

        {/* Information */}
        <div className="mb-6 p-4 bg-white/5 rounded-lg">
          <p className="text-sm text-white/80 mb-2">What happens next?</p>
          <ul className="text-xs text-white/60 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-[#10b981] mt-0.5">✓</span>
              <span>
                <strong>Continue:</strong> Analyze remaining files (cost will increase)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#ef4444] mt-0.5">✗</span>
              <span>
                <strong>Stop:</strong> Use violations found so far (regex + AI analyzed files)
              </span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            onClick={handleStop}
            disabled={isProcessing}
            variant="outline"
            className="flex-1 bg-transparent border-[#1a1a1a] hover:bg-[#0a0a0a] text-white"
          >
            {isProcessing ? "Processing..." : "Stop Scan"}
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isProcessing}
            className="flex-1 bg-[#f97316] hover:bg-[#f97316]/90 text-black font-medium"
          >
            {isProcessing ? "Processing..." : "Continue Scanning"}
          </Button>
        </div>

        {/* Footer Note */}
        <p className="mt-4 text-xs text-center text-[#777]">
          You can adjust the cost limit in Settings
        </p>
      </div>
    </div>
  )
}
