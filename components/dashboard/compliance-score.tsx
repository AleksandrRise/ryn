"use client"

import { memo } from "react"

export const ComplianceScore = memo(function ComplianceScore() {
  // Mock data - will be fetched from backend
  const score = 73
  const totalControls = 64
  const compliantControls = 47

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Compliance Score</h3>

      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          {/* SVG Circle Progress */}
          <svg className="w-full h-full -rotate-90">
            <circle cx="64" cy="64" r="56" className="stroke-border" strokeWidth="8" fill="none" />
            <circle
              cx="64"
              cy="64"
              r="56"
              className="stroke-primary"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - score / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{score}%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Compliant Controls</span>
          <span className="text-foreground font-medium">
            {compliantControls}/{totalControls}
          </span>
        </div>
      </div>
    </div>
  )
})
