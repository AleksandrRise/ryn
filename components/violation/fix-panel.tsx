"use client"

import { Sparkles, Check, X, RotateCcw, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodePreview } from "./code-preview"
import { DiffView } from "./diff-view"
import type { Fix } from "@/lib/types/fix"

interface FixPanelProps {
  fix: Fix
  showDiff: boolean
  fixApplied: boolean
  onShowDiffToggle: () => void
  onApplyFix: () => void
  onReject: () => void
  onUndo: () => void
}

export function FixPanel({ fix, showDiff, fixApplied, onShowDiffToggle, onApplyFix, onReject, onUndo }: FixPanelProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">AI-Generated Fix</h2>
        </div>

        <button
          onClick={onShowDiffToggle}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-accent hover:bg-accent/80 transition-colors"
        >
          <Code2 className="w-4 h-4" />
          {showDiff ? "Side-by-Side" : "Diff View"}
        </button>
      </div>

      {/* Trust Level Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Trust Level:</span>
        <div className="px-3 py-1 rounded-full bg-warning-bg border border-warning/20">
          <span className="text-xs font-medium text-warning capitalize">{fix.trustLevel}</span>
        </div>
        <span className="text-xs text-muted-foreground">Requires preview before applying</span>
      </div>

      {/* Success Message */}
      {fixApplied && (
        <div className="bg-success-bg border border-success/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-success" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Fix applied successfully!</p>
              <p className="text-xs text-muted-foreground mt-1">
                The violation has been resolved. Changes have been written to the file.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">How This Fix Works</h3>
        <div className="prose prose-sm prose-invert">
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{fix.explanation}</div>
        </div>
      </div>

      {/* Code Display */}
      {showDiff ? (
        <DiffView originalCode={fix.originalCode} fixedCode={fix.fixedCode} />
      ) : (
        <CodePreview
          title="Proposed Fix"
          code={fix.fixedCode}
          language="python"
          filePath="config/settings.py"
          lineNumber={47}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        {fixApplied ? (
          <Button onClick={onUndo} variant="outline" className="gap-2 flex-1 bg-transparent">
            <RotateCcw className="w-4 h-4" />
            Undo Changes
          </Button>
        ) : (
          <>
            <Button onClick={onApplyFix} className="gap-2 flex-1">
              <Check className="w-4 h-4" />
              Apply Fix
            </Button>
            <Button onClick={onReject} variant="outline" className="gap-2 bg-transparent">
              <X className="w-4 h-4" />
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
