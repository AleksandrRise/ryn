"use client"

import { File } from "lucide-react"

interface CodePreviewProps {
  title: string
  code: string
  language: string
  filePath: string
  lineNumber: number
  highlightLines?: number[]
}

export function CodePreview({ title, code, language, filePath, lineNumber, highlightLines = [] }: CodePreviewProps) {
  const lines = code.split("\n")

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <File className="w-3.5 h-3.5" />
          <span className="font-mono">
            {filePath}:{lineNumber}
          </span>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="bg-surface-elevated border-b border-border px-4 py-2">
          <span className="text-xs font-mono text-muted-foreground">{language}</span>
        </div>
        <div className="p-4 overflow-x-auto">
          <pre className="text-sm font-mono">
            {lines.map((line, index) => {
              const lineNum = lineNumber + index
              const isHighlighted = highlightLines.includes(lineNum)

              return (
                <div key={`${lineNum}-${line.substring(0, 30)}`} className={`flex gap-4 ${isHighlighted ? "bg-danger-bg" : ""}`}>
                  <span className="text-muted-foreground select-none w-8 text-right flex-shrink-0">{lineNum}</span>
                  <code className="text-foreground flex-1">{line}</code>
                </div>
              )
            })}
          </pre>
        </div>
      </div>
    </div>
  )
}
