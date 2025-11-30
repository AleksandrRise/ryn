"use client"

import { memo, useMemo } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { getLanguageFromPath } from "./utils"

interface CodeDiffProps {
  /** The original code (before fix) */
  beforeCode: string
  /** The modified code (after fix) */
  afterCode: string
  /** Programming language for syntax highlighting (overrides filePath detection) */
  language?: string
  /** File path used for automatic language detection */
  filePath?: string
  /** Additional CSS classes for the container */
  className?: string
}

/**
 * CodeDiff - Side-by-side before/after code comparison
 *
 * Use for displaying fix proposals with the original and modified code.
 * Both panels have syntax highlighting and line numbers.
 *
 * @example
 * ```tsx
 * <CodeDiff
 *   beforeCode={originalCode}
 *   afterCode={fixedCode}
 *   filePath="src/components/example.tsx"
 * />
 * ```
 */
export const CodeDiff = memo(function CodeDiff({
  beforeCode,
  afterCode,
  language,
  filePath,
  className = "",
}: CodeDiffProps) {
  const detectedLanguage = useMemo(() => {
    if (language) return language
    if (filePath) return getLanguageFromPath(filePath)
    return "text"
  }, [language, filePath])

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
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {/* Before panel */}
      <div className="border border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#050505] px-4 py-2 border-b border-[#1a1a1a]">
          <p className="text-[11px] uppercase tracking-wider text-[#aaaaaa]">
            Before
          </p>
        </div>
        {beforeCode && beforeCode.trim().length > 0 ? (
          <SyntaxHighlighter
            language={detectedLanguage}
            style={vscDarkPlus}
            customStyle={customStyle}
            showLineNumbers
          >
            {beforeCode}
          </SyntaxHighlighter>
        ) : (
          <div className="p-4 text-white/50 text-sm bg-[#0a0a0a]">
            No code available
          </div>
        )}
      </div>

      {/* After panel */}
      <div className="border border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#050505] px-4 py-2 border-b border-[#1a1a1a]">
          <p className="text-[11px] uppercase tracking-wider text-[#10b981]">
            After (Proposed)
          </p>
        </div>
        {afterCode && afterCode.trim().length > 0 ? (
          <SyntaxHighlighter
            language={detectedLanguage}
            style={vscDarkPlus}
            customStyle={customStyle}
            showLineNumbers
          >
            {afterCode}
          </SyntaxHighlighter>
        ) : (
          <div className="p-4 text-white/50 text-sm bg-[#0a0a0a]">
            No code available
          </div>
        )}
      </div>
    </div>
  )
})
