"use client"

import { useState, memo, useMemo } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

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
          <p className="text-[11px] uppercase tracking-wider text-[#666]">Before</p>
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

  const violation = {
    id: 1,
    severity: "critical",
    control: "CC6.7",
    title: "Hardcoded API key in settings.py",
    description:
      "Storing secrets directly in source code violates SOC 2 CC6.7 (Restricted Access). API keys must be stored in environment variables or secure vaults.",
    file: "config/settings.py",
    line: 47,
    language: "python",
    confidence: "high",
    currentCode: `# config/settings.py
API_KEY = "sk_live_51H8x9dKj3..."
STRIPE_SECRET = "sk_test_4eC39H..."

def get_api_credentials():
    return API_KEY`,
    proposedFix: `# config/settings.py
import os

API_KEY = os.environ.get("API_KEY")
STRIPE_SECRET = os.environ.get("STRIPE_SECRET")

def get_api_credentials():
    if not API_KEY:
        raise ValueError("API_KEY not set")
    return API_KEY`,
    explanation:
      "Move secrets to environment variables. This ensures credentials are never committed to version control and can be rotated without code changes.",
    trustLevel: "review",
    controlInfo: {
      id: "CC6.7",
      name: "Restricted Access - Encryption & Secrets",
      description:
        "The entity uses encryption to protect data at rest and in transit. Cryptographic keys and secrets must be securely stored, rotated regularly, and never hardcoded in source code.",
      requirement:
        "Ensure all API keys, passwords, and sensitive credentials are stored in secure vaults or environment variables, not in source code.",
    },
  }

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: "bg-[#10b981] text-black",
      medium: "bg-[#eab308] text-black",
      low: "bg-[#ef4444] text-white",
    }
    return colors[confidence as keyof typeof colors] || colors.medium
  }

  const handleApplyFix = () => {
    // Placeholder - will connect to backend
    console.log("Applying fix for violation:", violationId)
    setShowApplyConfirm(false)
  }

  return (
    <div className="px-8 py-12">
      <div className="grid grid-cols-[2fr,1fr] gap-16">
        {/* Left column - Main content */}
        <div>
          {/* Violation header */}
          <div className="mb-12 pb-8 border-b border-[#1a1a1a]">
            <div className="flex items-baseline gap-4 mb-3">
              <span className="text-[11px] uppercase tracking-wider text-[#ef4444] font-medium">Critical</span>
              <span className="text-[11px] uppercase tracking-wider text-[#404040]">{violation.control}</span>
              <span
                className={`text-[11px] uppercase tracking-wider px-2 py-1 ${getConfidenceBadge(violation.confidence)}`}
              >
                {violation.confidence} confidence
              </span>
            </div>
            <h1 className="text-[42px] font-bold leading-tight tracking-tight mb-3">{violation.title}</h1>
            <p className="text-[13px] text-[#666] font-mono">
              {violation.file}:{violation.line}
            </p>
          </div>

          {/* Toggle between current code and diff */}
          <div className="mb-6 flex gap-4 text-[12px]">
            <button
              onClick={() => setShowDiff(false)}
              className={`uppercase tracking-wider ${!showDiff ? "text-white" : "text-[#404040] hover:text-[#666]"}`}
            >
              Current
            </button>
            <button
              onClick={() => setShowDiff(true)}
              className={`uppercase tracking-wider ${showDiff ? "text-white" : "text-[#404040] hover:text-[#666]"}`}
            >
              Proposed Fix
            </button>
          </div>

          {/* Code display with syntax highlighting */}
          <div className="mb-8">
            {!showDiff ? (
              <MemoizedCodeBlock code={violation.currentCode} language={violation.language} />
            ) : (
              <MemoizedDiffBlock
                beforeCode={violation.currentCode}
                afterCode={violation.proposedFix}
                language={violation.language}
              />
            )}
          </div>

          {/* Fix explanation */}
          {showDiff && (
            <div className="mb-8">
              <h3 className="text-[11px] uppercase tracking-wider text-[#666] mb-3">Why This Fix Works</h3>
              <p className="text-[14px] leading-relaxed">{violation.explanation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setShowApplyConfirm(true)}
              className="px-6 py-3 bg-white text-black text-[13px] font-medium hover:bg-[#e5e5e5] transition-colors"
            >
              Apply Fix
            </button>
            <button className="px-6 py-3 border border-[#1a1a1a] text-[13px] hover:bg-[#0a0a0a] transition-colors">
              Reject
            </button>
          </div>
        </div>

        {/* Right column - Context sidebar */}
        <div>
          {/* SOC 2 Control Explanation */}
          <div className="mb-8 p-6 border border-[#1a1a1a] bg-[#050505]">
            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="text-[11px] uppercase tracking-wider text-[#666]">SOC 2 Control</h3>
              <span className="text-[11px] font-mono text-white">{violation.controlInfo.id}</span>
            </div>
            <h4 className="text-[14px] font-medium mb-2">{violation.controlInfo.name}</h4>
            <p className="text-[12px] leading-relaxed text-[#a3a3a3] mb-4">{violation.controlInfo.description}</p>
            <div className="pt-4 border-t border-[#1a1a1a]">
              <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Requirement</p>
              <p className="text-[12px] text-[#a3a3a3]">{violation.controlInfo.requirement}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#666] mb-3">Why This Matters</h3>
            <p className="text-[13px] leading-relaxed text-[#a3a3a3]">{violation.description}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#666] mb-3">Trust Level</h3>
            <p className="text-[13px]">Requires review before applying</p>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-[#666] mb-3">Impact</h3>
            <p className="text-[13px] text-[#a3a3a3]">
              High - Exposed credentials could lead to unauthorized system access
            </p>
          </div>
        </div>
      </div>

      {/* Apply Fix Confirmation Dialog */}
      {showApplyConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-8 max-w-md">
            <h3 className="text-[24px] font-bold mb-4">Apply Fix?</h3>
            <p className="text-[14px] text-[#a3a3a3] mb-6">
              This will modify <span className="font-mono text-white">{violation.file}</span> and apply the proposed
              changes. You can review the changes before committing.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleApplyFix}
                className="flex-1 px-6 py-3 bg-white text-black text-[13px] font-medium hover:bg-[#e5e5e5] transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setShowApplyConfirm(false)}
                className="flex-1 px-6 py-3 border border-[#1a1a1a] text-[13px] hover:bg-[#050505] transition-colors"
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
