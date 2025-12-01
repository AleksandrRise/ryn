"use client"

import { memo, useMemo, useCallback } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { getLanguageFromPath, SNIPPET_CODE_STYLE } from "./utils"

interface CodeSnippetProps {
  /** The source code to display */
  code: string
  /** Programming language for syntax highlighting (overrides filePath detection) */
  language?: string
  /** File path used for automatic language detection */
  filePath?: string
  /** Starting line number (default: 1) */
  startLineNumber?: number
  /** Array of line numbers to highlight (e.g., violation lines) */
  highlightLines?: number[]
  /** CSS max-height for scrollable container (default: "200px") */
  maxHeight?: string
  /** Show line numbers (default: true) */
  showLineNumbers?: boolean
  /** Additional CSS classes for the container */
  className?: string
  /** Custom CSS styles to merge with defaults */
  customStyle?: React.CSSProperties
}

/**
 * CodeSnippet - Code display with line numbers and line highlighting
 *
 * Use for displaying violation code snippets where specific lines need highlighting.
 * Supports custom starting line numbers for accurate context display.
 *
 * @example
 * ```tsx
 * <CodeSnippet
 *   code={snippet}
 *   filePath="src/components/example.tsx"
 *   startLineNumber={95}
 *   highlightLines={[100, 101]}
 *   maxHeight="200px"
 * />
 * ```
 */
export const CodeSnippet = memo(function CodeSnippet({
  code,
  language,
  filePath,
  startLineNumber = 1,
  highlightLines = [],
  maxHeight = "200px",
  showLineNumbers = true,
  className = "",
  customStyle,
}: CodeSnippetProps) {
  const detectedLanguage = useMemo(() => {
    if (language) return language
    if (filePath) return getLanguageFromPath(filePath)
    return "text"
  }, [language, filePath])

  // When maxHeight is "100%", we want the element to fill its parent
  // This requires height instead of maxHeight for proper flex behavior
  const isFlexible = maxHeight === "100%"

  const mergedStyle = useMemo(
    () => ({
      ...SNIPPET_CODE_STYLE,
      ...(isFlexible ? { height: "100%", minHeight: 0 } : { maxHeight }),
      overflow: "auto",
      ...customStyle,
    }),
    [customStyle, maxHeight, isFlexible]
  )

  // Filter out invalid line numbers (negative, zero, etc.)
  const validHighlightLines = useMemo(
    () => highlightLines.filter((n) => n > 0),
    [highlightLines]
  )

  // Callback for applying line-specific styles
  const getLineProps = useCallback(
    (lineNumber: number) => {
      const style: React.CSSProperties = {}

      if (validHighlightLines.includes(lineNumber)) {
        style.backgroundColor = "rgba(255, 255, 255, 0.1)"
        style.display = "block"
        style.paddingLeft = "0.5rem"
        style.paddingRight = "0.5rem"
        style.marginLeft = "-0.5rem"
        style.marginRight = "-0.5rem"
        style.borderRadius = "0.25rem"
      }

      return { style }
    },
    [validHighlightLines]
  )

  // Handle empty or missing code
  if (!code || code.trim().length === 0) {
    return (
      <div className={`p-4 text-white/50 text-sm bg-[#0a0a0a] border border-white/10 ${className}`}>
        No code snippet available
      </div>
    )
  }

  // Add flex classes when using flexible height
  const containerClasses = isFlexible
    ? `border border-white/10 overflow-hidden rounded-lg flex flex-col ${className}`
    : `border border-white/10 overflow-hidden rounded-lg ${className}`

  return (
    <div className={containerClasses}>
      <SyntaxHighlighter
        language={detectedLanguage}
        style={vscDarkPlus}
        customStyle={mergedStyle}
        showLineNumbers={showLineNumbers}
        startingLineNumber={startLineNumber}
        wrapLines={true}
        lineProps={getLineProps}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
})
