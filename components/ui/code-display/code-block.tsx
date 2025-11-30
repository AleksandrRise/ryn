"use client"

import { memo, useMemo } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { getLanguageFromPath, DEFAULT_CODE_STYLE } from "./utils"

interface CodeBlockProps {
  /** The source code to display */
  code: string
  /** Programming language for syntax highlighting (overrides filePath detection) */
  language?: string
  /** File path used for automatic language detection */
  filePath?: string
  /** Custom CSS styles to merge with defaults */
  customStyle?: React.CSSProperties
  /** Show line numbers (default: false) */
  showLineNumbers?: boolean
  /** Additional CSS classes for the container */
  className?: string
}

/**
 * CodeBlock - Basic syntax-highlighted code display
 *
 * Use for simple code displays like AI-generated fixes or code previews.
 * For code with line highlighting (violation lines), use CodeSnippet instead.
 *
 * @example
 * ```tsx
 * <CodeBlock
 *   code={sourceCode}
 *   filePath="src/example.ts"
 *   showLineNumbers={true}
 * />
 * ```
 */
export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  filePath,
  customStyle,
  showLineNumbers = false,
  className = "",
}: CodeBlockProps) {
  const detectedLanguage = useMemo(() => {
    if (language) return language
    if (filePath) return getLanguageFromPath(filePath)
    return "text"
  }, [language, filePath])

  const mergedStyle = useMemo(
    () => ({ ...DEFAULT_CODE_STYLE, ...customStyle }),
    [customStyle]
  )

  // Handle empty or missing code
  if (!code || code.trim().length === 0) {
    return (
      <div className={`p-4 text-white/50 text-sm bg-[#0a0a0a] border border-[#1a1a1a] ${className}`}>
        No code available
      </div>
    )
  }

  return (
    <div className={`border border-[#1a1a1a] overflow-hidden ${className}`}>
      <SyntaxHighlighter
        language={detectedLanguage}
        style={vscDarkPlus}
        customStyle={mergedStyle}
        showLineNumbers={showLineNumbers}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
})
