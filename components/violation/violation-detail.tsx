"use client"

import { useState, useEffect, memo, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { ArrowLeft, Sparkles } from "lucide-react"
import { get_violation, dismiss_violation, generate_fix, type ViolationDetail as ViolationDetailType, type Fix } from "@/lib/tauri/commands"
import { handleTauriError, showSuccess, showInfo } from "@/lib/utils/error-handler"

interface ViolationDetailProps {
  violationId: number
}

// SOC 2 Control Metadata
const SOC2_CONTROLS: Record<string, {
  name: string
  description: string
  requirement: string
}> = {
  "CC6.1": {
    name: "Logical Access Controls",
    description: "The entity implements logical access security software, infrastructure, and architectures to support access control policies that restrict access to authorized users.",
    requirement: "Ensure proper authentication and authorization checks are in place for all sensitive operations. Avoid hardcoded user IDs and implement role-based access control."
  },
  "CC6.7": {
    name: "Restricted Access - Encryption & Secrets",
    description: "The entity uses encryption to protect data at rest and in transit. Cryptographic keys and secrets must be securely stored, rotated regularly, and never hardcoded in source code.",
    requirement: "Ensure all API keys, passwords, and sensitive credentials are stored in secure vaults or environment variables, not in source code."
  },
  "CC7.2": {
    name: "System Monitoring - Logging",
    description: "The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors.",
    requirement: "Implement comprehensive logging for security-relevant events including authentication attempts, authorization failures, and data access."
  },
  "A1.2": {
    name: "Data Availability & Resilience",
    description: "The entity maintains, monitors, and evaluates current processing capacity and use of system components to manage capacity demand and to enable the implementation of additional capacity.",
    requirement: "Ensure external service calls have proper error handling, timeouts, and retry mechanisms to maintain system availability."
  }
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
  const router = useRouter()
  const [violationDetail, setViolationDetail] = useState<ViolationDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [generatedFix, setGeneratedFix] = useState<Fix | null>(null)
  const [isGeneratingFix, setIsGeneratingFix] = useState(false)

  // Load violation data
  useEffect(() => {
    const loadViolation = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log(`[ViolationDetail] Loading violation ${violationId}...`)
        const data = await get_violation(violationId)
        console.log('[ViolationDetail] Successfully loaded:', data)

        setViolationDetail(data)
      } catch (err) {
        console.error('[ViolationDetail] Error loading violation:', err)
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(`Failed to load violation: ${errorMessage}`)
        handleTauriError(err, "Failed to load violation")
      } finally {
        setLoading(false)
      }
    }

    loadViolation()
  }, [violationId])

  const handleDismiss = async () => {
    if (!violationDetail) return

    try {
      await dismiss_violation(violationDetail.violation.id)
      showSuccess("Violation dismissed")
      router.push('/scan')
    } catch (err) {
      handleTauriError(err, "Failed to dismiss violation")
    }
  }

  const handleGenerateFix = async () => {
    if (!violationDetail || isGeneratingFix) return

    try {
      setIsGeneratingFix(true)
      showInfo("Generating AI-powered fix...")

      const fix = await generate_fix(violationDetail.violation.id)
      setGeneratedFix(fix)
      setShowDiff(true)

      showSuccess("Fix generated successfully!")
    } catch (err) {
      handleTauriError(err, "Failed to generate fix")
    } finally {
      setIsGeneratingFix(false)
    }
  }

  const handleApplyFix = () => {
    // Placeholder - will connect to backend
    console.log("Applying fix for violation:", violationId)
    setShowApplyConfirm(false)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-[#ef4444]"
      case "high":
        return "text-[#f97316]"
      case "medium":
        return "text-[#eab308]"
      case "low":
        return "text-[#e8e8e8]"
      default:
        return "text-white"
    }
  }

  const getSeverityText = (severity: string) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1)
  }

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: "bg-[#10b981] text-black",
      medium: "bg-[#eab308] text-black",
      low: "bg-[#ef4444] text-white",
    }
    return colors[confidence as keyof typeof colors] || colors.medium
  }

  // Detect language from file extension
  const detectLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'php': 'php',
      'cs': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
    }
    return languageMap[ext] || 'javascript'
  }

  // Loading state
  if (loading) {
    return (
      <div className="px-8 py-12">
        <div className="flex items-center justify-center h-64">
          <div className="text-[14px] text-[#aaaaaa]">Loading violation details...</div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !violationDetail) {
    return (
      <div className="px-8 py-12">
        <div className="flex items-center justify-center h-64">
          <div className="text-[14px] text-[#ef4444]">{error || "Violation not found"}</div>
        </div>
      </div>
    )
  }

  const { violation, control: backendControl } = violationDetail

  if (!violation) {
    return (
      <div className="px-8 py-12">
        <div className="flex items-center justify-center h-64">
          <div className="text-[14px] text-[#ef4444]">Invalid violation data received from backend</div>
        </div>
      </div>
    )
  }

  // Use backend control if available, otherwise fall back to hardcoded
  const controlInfo = backendControl || SOC2_CONTROLS[violation.control_id] || {
    id: violation.control_id,
    name: violation.control_id,
    description: "No description available",
    requirement: "No requirement information available",
    category: "Unknown"
  }

  const language = detectLanguage(violation.file_path)
  const confidence = "high" // Placeholder - backend doesn't track this yet

  return (
    <div className="px-8 py-12">
      {/* Return button */}
      <button
        onClick={() => router.push('/scan')}
        className="mb-8 flex items-center gap-2 text-[13px] text-[#aaaaaa] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Scan Results
      </button>

      <div className="grid grid-cols-[2fr,1fr] gap-16">
        {/* Left column - Main content */}
        <div>
          {/* Violation header */}
          <div className="mb-12 pb-8 border-b border-[#1a1a1a]">
            <div className="flex items-baseline gap-4 mb-3">
              <span className={`text-[11px] uppercase tracking-wider font-medium ${getSeverityColor(violation.severity)}`}>
                {getSeverityText(violation.severity)}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">{violation.control_id}</span>
              <span
                className={`text-[11px] uppercase tracking-wider px-2 py-1 ${getConfidenceBadge(confidence)}`}
              >
                {confidence} confidence
              </span>
            </div>
            <h1 className="text-[42px] font-bold leading-tight tracking-tight mb-3">{violation.description}</h1>
            <p className="text-[13px] text-[#aaaaaa] font-mono">
              {violation.file_path}:{violation.line_number}
            </p>
          </div>

          {/* Toggle between current code and diff */}
          <div className="mb-6 flex gap-4 items-center text-[12px]">
            <button
              onClick={() => setShowDiff(false)}
              className={`uppercase tracking-wider ${!showDiff ? "text-white" : "text-[#aaaaaa] hover:text-white"}`}
            >
              Current
            </button>
            <button
              onClick={() => generatedFix ? setShowDiff(true) : handleGenerateFix()}
              disabled={isGeneratingFix}
              className={`uppercase tracking-wider ${showDiff ? "text-white" : "text-[#aaaaaa] hover:text-white"} ${isGeneratingFix ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isGeneratingFix ? "Generating..." : generatedFix ? "Proposed Fix" : "Generate Fix"}
            </button>
            {!generatedFix && !isGeneratingFix && (
              <button
                onClick={handleGenerateFix}
                className="flex items-center gap-1 px-3 py-1 bg-[#10b981] text-black text-[11px] font-medium rounded hover:bg-[#0ea472] transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Generate with AI
              </button>
            )}
          </div>

          {/* Code display with syntax highlighting */}
          <div className="mb-8">
            {!showDiff ? (
              <MemoizedCodeBlock code={violation.code_snippet} language={language} />
            ) : generatedFix ? (
              <MemoizedDiffBlock
                beforeCode={generatedFix.original_code}
                afterCode={generatedFix.fixed_code}
                language={language}
              />
            ) : (
              <div className="border border-[#1a1a1a] p-8 text-center text-[#aaaaaa]">
                <p className="text-[14px] mb-4">Click "Generate with AI" to create a proposed fix using Claude AI</p>
                <button
                  onClick={handleGenerateFix}
                  disabled={isGeneratingFix}
                  className="px-6 py-3 bg-[#10b981] text-black text-[13px] font-medium hover:bg-[#0ea472] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingFix ? "Generating..." : "Generate Fix"}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setShowApplyConfirm(true)}
              disabled={!generatedFix}
              className={`px-6 py-3 text-[13px] font-medium transition-colors ${
                generatedFix
                  ? "bg-white text-black hover:bg-[#e5e5e5]"
                  : "bg-white/20 text-white/40 cursor-not-allowed"
              }`}
            >
              Apply Fix
            </button>
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
          <div className="mb-8 p-6 border border-[#1a1a1a] bg-[#050505]">
            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">SOC 2 Control</h3>
              <span className="text-[11px] font-mono text-white">{violation.control_id}</span>
            </div>
            <h4 className="text-[14px] font-medium mb-2">{controlInfo.name}</h4>
            <p className="text-[12px] leading-relaxed text-[#aaaaaa] mb-4">{controlInfo.description}</p>
            <div className="pt-4 border-t border-[#1a1a1a]">
              <p className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-2">Requirement</p>
              <p className="text-[12px] text-[#aaaaaa]">{controlInfo.requirement}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Why This Matters</h3>
            <p className="text-[13px] leading-relaxed text-[#aaaaaa]">{violation.description}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Trust Level</h3>
            <p className="text-[13px]">Requires review before applying</p>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Status</h3>
            <p className="text-[13px] text-[#aaaaaa]">{violation.status}</p>
          </div>
        </div>
      </div>

      {/* Apply Fix Confirmation Dialog */}
      {showApplyConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-8 max-w-md">
            <h3 className="text-[24px] font-bold mb-4">Apply Fix?</h3>
            <p className="text-[14px] text-[#aaaaaa] mb-6">
              This will modify <span className="font-mono text-white">{violation.file_path}</span> and apply the proposed
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
