"use client"

interface DiffViewProps {
  originalCode: string
  fixedCode: string
}

export function DiffView({ originalCode, fixedCode }: DiffViewProps) {
  const originalLines = originalCode.split("\n")
  const fixedLines = fixedCode.split("\n")

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Side-by-Side Comparison</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Original Code */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="bg-danger-bg border-b border-danger/20 px-4 py-2">
            <span className="text-xs font-medium text-danger">Original (Before)</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm font-mono">
              {originalLines.map((line, index) => (
                <div key={`original-${index}-${line.substring(0, 30)}`} className="flex gap-4 bg-danger-bg/20">
                  <span className="text-muted-foreground select-none w-8 text-right flex-shrink-0">{index + 1}</span>
                  <code className="text-foreground flex-1">{line}</code>
                </div>
              ))}
            </pre>
          </div>
        </div>

        {/* Fixed Code */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="bg-success-bg border-b border-success/20 px-4 py-2">
            <span className="text-xs font-medium text-success">Fixed (After)</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm font-mono">
              {fixedLines.map((line, index) => (
                <div key={`fixed-${index}-${line.substring(0, 30)}`} className="flex gap-4 bg-success-bg/20">
                  <span className="text-muted-foreground select-none w-8 text-right flex-shrink-0">{index + 1}</span>
                  <code className="text-foreground flex-1">{line}</code>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
