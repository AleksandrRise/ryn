"use client"

import { useState, memo, useMemo, useEffect } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { get_violation, generate_fix, apply_fix, dismiss_violation, type ViolationDetail } from "@/lib/tauri/commands"
import { handleTauriError, showSuccess, showInfo } from "@/lib/utils/error-handler"
import { DetectionBadge } from "@/components/scan/detection-badge"

interface ViolationDetailProps {
  violationId: number
}

// Memoized code block component
const MemoizedCodeBlock = memo(function MemoizedCodeBlock({
  code,
  language,
}: {
  code: string
  language: string
}) {
  const customStyle = useMemo(
    () => ({
      margin: 0,
      padding: "1.5rem",
      background: "#0a0a0a",
      fontSize: "13px",
    }),
    []
  )

  return (
    <div className="border border-[#1a1a1a] overflow-hidden">
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={customStyle}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
})

// Memoized diff block component
const MemoizedDiffBlock = memo(function MemoizedDiffBlock({
  beforeCode,
  afterCode,
  language,
}: {
  beforeCode: string
  afterCode: string
  language: string
}) {
  const customStyle = useMemo(
    () => ({
      margin: 0,
      padding: "1rem",
      background: "#0a0a0a",
      fontSize: "12px",
    }),
    []
  )

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="border border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#050505] px-4 py-2 border-b border-[#1a1a1a]">
          <p className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">Before</p>
        </div>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={customStyle}
          showLineNumbers
        >
          {beforeCode}
        </SyntaxHighlighter>
      </div>
      <div className="border border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#050505] px-4 py-2 border-b border-[#1a1a1a]">
          <p className="text-[11px] uppercase tracking-wider text-[#10b981]">After (Proposed)</p>
        </div>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={customStyle}
          showLineNumbers
        >
          {afterCode}
        </SyntaxHighlighter>
      </div>
    </div>
  )
})

export function ViolationDetail({ violationId }: ViolationDetailProps) {
  const [showDiff, setShowDiff] = useState(false)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [violationDetail, setViolationDetail] = useState<ViolationDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingFix, setIsGeneratingFix] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Fetch violation detail on mount
  useEffect(() => {
    const loadViolation = async () => {
      try {
        setIsLoading(true)
        const detail = await get_violation(violationId)
        setViolationDetail(detail)
      } catch (error) {
        handleTauriError(error, "Failed to load violation details")
      } finally {
        setIsLoading(false)
      }
    }

    loadViolation()
  }, [violationId])

  // Derive language from file extension
  const getLanguage = (filePath: string): string => {
    const ext = filePath.split(".").pop()?.toLowerCase() || ""
    const langMap: Record<string, string> = {
      py: "python",
      js: "javascript",
      ts: "typescript",
      tsx: "typescript",
      jsx: "javascript",
      rs: "rust",
      go: "go",
      java: "java",
      rb: "ruby",
      php: "php",
      cs: "csharp",
      cpp: "cpp",
      c: "c",
    }
    return langMap[ext] || "text"
  }

  const getConfidenceBadge = (trustLevel: string) => {
    const colors = {
      auto: "bg-[#10b981] text-black",
      review: "bg-[#eab308] text-black",
      manual: "bg-[#ef4444] text-white",
    }
    return colors[trustLevel as keyof typeof colors] || colors.review
  }

  const handleGenerateFix = async () => {
    if (!violationDetail) return

    try {
      setIsGeneratingFix(true)
      showInfo("Generating fix with AI...")
      const fix = await generate_fix(violationId)
      setViolationDetail({
        ...violationDetail,
        fix,
      })
      showSuccess("Fix generated successfully!")
      setShowDiff(true) // Auto-show diff when fix is ready
    } catch (error) {
      handleTauriError(error, "Failed to generate fix")
    } finally {
      setIsGeneratingFix(false)
    }
  }

  const handleApplyFix = async () => {
    if (!violationDetail?.fix) return

    try {
      setIsApplying(true)
      showInfo("Applying fix...")
      await apply_fix(violationDetail.fix.id)
      showSuccess("Fix applied successfully!")
      setShowApplyConfirm(false)
      // Reload violation to get updated status
      const detail = await get_violation(violationId)
      setViolationDetail(detail)
    } catch (error) {
      handleTauriError(error, "Failed to apply fix")
    } finally {
      setIsApplying(false)
    }
  }

  const handleDismiss = async () => {
    try {
      await dismiss_violation(violationId)
      showSuccess("Violation dismissed")
      // Could navigate back to scan results here
    } catch (error) {
      handleTauriError(error, "Failed to dismiss violation")
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="px-8 py-12 flex items-center justify-center">
        <p className="text-[14px] text-[#aaaaaa]">Loading violation details...</p>
      </div>
    )
  }

  // Error state
  if (!violationDetail) {
    return (
      <div className="px-8 py-12 flex items-center justify-center">
        <p className="text-[14px] text-[#ef4444]">Failed to load violation details</p>
      </div>
    )
  }

  const { violation, control, fix } = violationDetail
  const language = getLanguage(violation.file_path)
  const trustLevel = fix?.trust_level || "review"

  return (
    <div className="px-8 py-12">
      <div className="grid grid-cols-[2fr,1fr] gap-16">
        {/* Left column - Main content */}
        <div>
          {/* Violation header */}
          <div className="mb-12 pb-8 border-[#1a1a1a]">
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`text-[11px] uppercase tracking-wider font-medium ${
                  violation.severity === "critical"
                    ? "text-[#ef4444]"
                    : violation.severity === "high"
                      ? "text-[#f97316]"
                      : violation.severity === "medium"
                        ? "text-[#eab308]"
                        : "text-[#525252]"
                }`}
              >
                {violation.severity}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">{violation.control_id}</span>
              <DetectionBadge method={violation.detection_method} />
              <span className={`text-[11px] uppercase tracking-wider px-2 py-1 ${getConfidenceBadge(trustLevel)}`}>
                {trustLevel} trust
              </span>
            </div>
            <h1 className="text-[42px] font-bold leading-tight tracking-tight mb-3">{violation.description}</h1>
            <p className="text-[13px] text-[#aaaaaa] font-mono">
              {violation.file_path}:{violation.line_number}
            </p>
          </div>

          {/* Toggle between current code and diff */}
          {fix && (
            <div className="mb-6 flex gap-4 text-[12px]">
              <button
                onClick={() => setShowDiff(false)}
                className={`uppercase tracking-wider ${!showDiff ? "text-white" : "text-[#aaaaaa] hover:text-[#aaaaaa]"}`}
              >
                Current
              </button>
              <button
                onClick={() => setShowDiff(true)}
                className={`uppercase tracking-wider ${showDiff ? "text-white" : "text-[#aaaaaa] hover:text-[#aaaaaa]"}`}
              >
                Proposed Fix
              </button>
            </div>
          )}

          {/* Code display with syntax highlighting */}
          <div className="mb-8">
            {!showDiff || !fix ? (
              <MemoizedCodeBlock code={violation.code_snippet} language={language} />
            ) : (
              <MemoizedDiffBlock
                beforeCode={fix.original_code}
                afterCode={fix.fixed_code}
                language={language}
              />
            )}
          </div>

          {/* Detection Reasoning Cards - For Hybrid/LLM/Regex violations */}
          {(violation.llm_reasoning || violation.regex_reasoning) && (
            <div className="mb-8 grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* AI Analysis Card */}
              {violation.llm_reasoning && (
                <div className="border border-purple-500/20 bg-purple-500/5 p-6 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <h3 className="text-[11px] uppercase tracking-wider text-purple-400 font-medium">
                      AI Analysis
                    </h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[#e5e5e5]">{violation.llm_reasoning}</p>
                  {violation.confidence_score !== undefined && violation.confidence_score !== null && (
                    <div className="mt-4 pt-4 border-t border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">Confidence</span>
                        <span className="text-[13px] font-medium text-purple-400">
                          {Math.round(violation.confidence_score * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                          style={{ width: `${violation.confidence_score * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pattern Match Card */}
              {violation.regex_reasoning && (
                <div className="border border-blue-500/20 bg-blue-500/5 p-6 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <h3 className="text-[11px] uppercase tracking-wider text-blue-400 font-medium">
                      Pattern Match
                    </h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[#e5e5e5]">{violation.regex_reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Fix explanation */}
          {showDiff && fix && (
            <div className="mb-8">
              <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Why This Fix Works</h3>
              <p className="text-[14px] leading-relaxed">{fix.explanation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            {!fix ? (
              <button
                onClick={handleGenerateFix}
                disabled={isGeneratingFix}
                className="px-6 py-3 bg-white text-black text-[13px] font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-50"
              >
                {isGeneratingFix ? "Generating..." : "Generate Fix"}
              </button>
            ) : (
              <button
                onClick={() => setShowApplyConfirm(true)}
                disabled={isApplying || fix.applied_at !== null}
                className="px-6 py-3 bg-white text-black text-[13px] font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-50"
              >
                {fix.applied_at !== null ? "Already Applied" : "Apply Fix"}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="px-6 py-3 border border-[#1a1a1a] text-[13px] hover:bg-[#0a0a0a] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Right column - Context sidebar */}
        <div>
          {/* SOC 2 Control Explanation */}
          {control && (
            <div className="mb-8 p-6 border border-[#1a1a1a] bg-[#050505]">
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">SOC 2 Control</h3>
                <span className="text-[11px] font-mono text-white">{control.id}</span>
              </div>
              <h4 className="text-[14px] font-medium mb-2">{control.name}</h4>
              <p className="text-[12px] leading-relaxed text-[#aaaaaa] mb-4">{control.description}</p>
              <div className="pt-4 border-t border-[#1a1a1a]">
                <p className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-2">Requirement</p>
                <p className="text-[12px] text-[#aaaaaa]">{control.requirement}</p>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Violation Details</h3>
            <p className="text-[13px] leading-relaxed text-[#aaaaaa]">{violation.description}</p>
          </div>

          {/* Detection Confidence Score */}
          {violation.confidence_score !== undefined && violation.confidence_score !== null && (
            <div className="mb-8 p-4 border border-purple-500/20 bg-purple-500/5 rounded-lg">
              <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">AI Confidence</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-[#aaaaaa]">Detection Certainty</span>
                <span className="text-[18px] font-bold text-purple-400">
                  {Math.round(violation.confidence_score * 100)}%
                </span>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                  style={{ width: `${violation.confidence_score * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-[#777] mt-2">
                {violation.confidence_score >= 0.9
                  ? "Very high confidence"
                  : violation.confidence_score >= 0.7
                    ? "High confidence"
                    : violation.confidence_score >= 0.5
                      ? "Moderate confidence"
                      : "Low confidence - review recommended"}
              </p>
            </div>
          )}

          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Trust Level</h3>
            <p className="text-[13px]">
              {trustLevel === "auto"
                ? "Can be applied automatically"
                : trustLevel === "review"
                  ? "Requires review before applying"
                  : "Manual intervention required"}
            </p>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Severity Impact</h3>
            <p className="text-[13px] text-[#aaaaaa]">
              {violation.severity === "critical"
                ? "Critical - Immediate attention required"
                : violation.severity === "high"
                  ? "High - Should be resolved soon"
                  : violation.severity === "medium"
                    ? "Medium - Address when possible"
                    : "Low - Minor issue"}
            </p>
          </div>
        </div>
      </div>

      {/* Apply Fix Confirmation Dialog */}
      {showApplyConfirm && fix && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-8 max-w-md">
            <h3 className="text-[24px] font-bold mb-4">Apply Fix?</h3>
            <p className="text-[14px] text-[#aaaaaa] mb-6">
              This will modify <span className="font-mono text-white">{violation.file_path}</span> and apply the
              proposed changes. A git commit will be created automatically.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleApplyFix}
                disabled={isApplying}
                className="flex-1 px-6 py-3 bg-white text-black text-[13px] font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-50"
              >
                {isApplying ? "Applying..." : "Apply"}
              </button>
              <button
                onClick={() => setShowApplyConfirm(false)}
                disabled={isApplying}
                className="flex-1 px-6 py-3 border border-[#1a1a1a] text-[13px] hover:bg-[#050505] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
