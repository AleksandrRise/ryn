"use client"

import { useState, useEffect, memo, useMemo } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { get_violation, type Violation } from "@/lib/tauri/commands"

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
  const [violation, setViolation] = useState<Violation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchViolation() {
      try {
        setIsLoading(true)
        setError(null)
        const data = await get_violation(violationId)
        setViolation(data)
      } catch (err) {
        console.error("Failed to fetch violation:", err)
        setError(err instanceof Error ? err.message : "Failed to load violation")
      } finally {
        setIsLoading(false)
      }
    }

    fetchViolation()
  }, [violationId])

  // Helper functions
  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      'py': 'python',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'rb': 'ruby',
      'php': 'php',
    }
    return languageMap[ext || ''] || 'text'
  }

  const getControlInfo = (controlId: string) => {
    const controls: Record<string, { name: string; description: string; requirement: string }> = {
      'CC6.1': {
        name: 'Logical and Physical Access Controls',
        description: 'The entity implements controls to protect against unauthorized logical and physical access to systems and data.',
        requirement: 'Implement proper authentication and authorization checks for all sensitive operations.',
      },
      'CC6.7': {
        name: 'Restricted Access - Encryption & Secrets',
        description: 'The entity uses encryption to protect data at rest and in transit. Cryptographic keys and secrets must be securely stored, rotated regularly, and never hardcoded in source code.',
        requirement: 'Ensure all API keys, passwords, and sensitive credentials are stored in secure vaults or environment variables, not in source code.',
      },
      'CC7.2': {
        name: 'System Monitoring - Logging',
        description: 'The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity\'s ability to meet its objectives.',
        requirement: 'Implement comprehensive audit logging for all security-relevant events and administrative actions.',
      },
      'A1.2': {
        name: 'Availability - System Resilience',
        description: 'The entity maintains, monitors, and evaluates system components to provide for the prevention and detection of component failures.',
        requirement: 'Implement error handling, timeouts, and retry logic to ensure system resilience and prevent cascading failures.',
      },
    }
    return controls[controlId] || {
      name: controlId,
      description: 'Security control violation detected.',
      requirement: 'Follow security best practices.',
    }
  }

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#525252',
    }
    return colors[severity.toLowerCase()] || colors.medium
  }

  const handleApplyFix = () => {
    // Placeholder - will connect to backend
    console.log("Applying fix for violation:", violationId)
    setShowApplyConfirm(false)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="px-8 py-12">
        <div className="flex items-center justify-center h-96">
          <p className="text-[#aaaaaa] text-[14px]">Loading violation details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !violation) {
    return (
      <div className="px-8 py-12">
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-[#ef4444] text-[16px] font-medium mb-2">Failed to load violation</p>
          <p className="text-[#aaaaaa] text-[13px]">{error || "Violation not found"}</p>
        </div>
      </div>
    )
  }

  const language = getLanguageFromPath(violation.file_path)
  const controlInfo = getControlInfo(violation.control_id)

  return (
    <div className="px-8 py-12">
      <div className="grid grid-cols-[2fr,1fr] gap-16">
        {/* Left column - Main content */}
        <div>
          {/* Violation header */}
          <div className="mb-12 pb-8 border-b border-[#1a1a1a]">
            <div className="flex items-baseline gap-4 mb-3">
              <span
                className="text-[11px] uppercase tracking-wider font-medium"
                style={{ color: getSeverityColor(violation.severity) }}
              >
                {violation.severity}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">{violation.control_id}</span>
            </div>
            <h1 className="text-[42px] font-bold leading-tight tracking-tight mb-3">{violation.description}</h1>
            <p className="text-[13px] text-[#aaaaaa] font-mono">
              {violation.file_path}:{violation.line_number}
            </p>
          </div>

          {/* Code display with syntax highlighting */}
          <div className="mb-8">
            <MemoizedCodeBlock code={violation.code_snippet} language={language} />
          </div>

          {/* Explanation */}
          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Why This Violates {violation.control_id}</h3>
            <p className="text-[14px] leading-relaxed text-[#aaaaaa]">{controlInfo.requirement}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setShowApplyConfirm(true)}
              className="px-6 py-3 bg-white text-black text-[13px] font-medium hover:bg-[#e5e5e5] transition-colors"
              disabled
              title="AI fix generation coming soon"
            >
              Generate Fix (Coming Soon)
            </button>
            <button className="px-6 py-3 border border-[#1a1a1a] text-[13px] hover:bg-[#0a0a0a] transition-colors">
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
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Location</h3>
            <p className="text-[13px] font-mono text-white mb-1">{violation.file_path}</p>
            <p className="text-[11px] text-[#aaaaaa]">Line {violation.line_number}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-[11px] uppercase tracking-wider text-[#aaaaaa] mb-3">Severity</h3>
            <p className="text-[13px]" style={{ color: getSeverityColor(violation.severity) }}>
              {violation.severity.toUpperCase()}
            </p>
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
            <h3 className="text-[24px] font-bold mb-4">Generate Fix?</h3>
            <p className="text-[14px] text-[#aaaaaa] mb-6">
              AI-powered fix generation is coming soon. This feature will use Claude AI to analyze the violation and generate a secure, compliant fix for{" "}
              <span className="font-mono text-white">{violation.file_path}</span>.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowApplyConfirm(false)}
                className="flex-1 px-6 py-3 bg-white text-black text-[13px] font-medium hover:bg-[#e5e5e5] transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
