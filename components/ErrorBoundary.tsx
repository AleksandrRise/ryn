"use client"

import type { ErrorInfo } from "react"
import {
  ErrorBoundary as ReactErrorBoundary,
  FallbackProps,
} from "react-error-boundary"
import { AlertTriangle, RotateCw, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Error Fallback Component
 *
 * Displays user-friendly error UI when React component errors occur.
 * Provides options to reload the page or report the bug.
 */
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isDevelopment = process.env.NODE_ENV === "development"

  const handleReportBug = () => {
    // Pre-fill GitHub issue with error details
    const title = encodeURIComponent(`Bug: ${error.message.slice(0, 50)}...`)
    const body = encodeURIComponent(`## Error Report

**Error Message:**
\`\`\`
${error.message}
\`\`\`

**Stack Trace:**
\`\`\`
${error.stack || "No stack trace available"}
\`\`\`

**User Agent:**
\`\`\`
${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}
\`\`\`

**Timestamp:**
${new Date().toISOString()}

## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Actual Behavior

`)

    // TODO: Replace with actual GitHub repository URL when available
    const githubUrl = `https://github.com/anthropics/ryn/issues/new?title=${title}&body=${body}`
    window.open(githubUrl, "_blank")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="max-w-2xl w-full space-y-6 bg-neutral-950 border border-red-900/30 rounded-lg p-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-red-950/50 border border-red-900/50">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Something Went Wrong</h1>
            <p className="text-neutral-400 text-sm mt-1">
              An unexpected error occurred while rendering this page
            </p>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
            Error Message
          </h2>
          <div className="bg-black border border-neutral-800 rounded-md p-4">
            <code className="text-red-400 text-sm font-mono break-words">
              {error.message}
            </code>
          </div>
        </div>

        {/* Stack Trace (Development Only) */}
        {isDevelopment && error.stack && (
          <details className="space-y-2">
            <summary className="text-sm font-semibold text-neutral-300 uppercase tracking-wide cursor-pointer hover:text-white transition-colors">
              Stack Trace (Development Only)
            </summary>
            <div className="bg-black border border-neutral-800 rounded-md p-4 mt-2 max-h-64 overflow-auto">
              <pre className="text-neutral-500 text-xs font-mono whitespace-pre-wrap">
                {error.stack}
              </pre>
            </div>
          </details>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4">
          <Button
            onClick={resetErrorBoundary}
            variant="default"
            className="flex items-center gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Reload Page
          </Button>
          <Button
            onClick={handleReportBug}
            variant="outline"
            className="flex items-center gap-2 border-neutral-700 hover:bg-neutral-900"
          >
            <Bug className="w-4 h-4" />
            Report Bug
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-800">
          <p>
            If this error persists, please report it using the button above.
            Include any steps that led to this error to help us fix it faster.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Global Error Boundary Component
 *
 * Wraps application sections to catch and handle React component errors.
 * Logs errors to console with component stack for debugging.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const handleError = (error: Error, info: ErrorInfo) => {
    // Log error to console with component stack
    console.error("❌ React Error Boundary caught an error:")
    console.error("Error:", error)
    console.error("Error Message:", error.message)
    console.error("Error Stack:", error.stack)
    console.error("Component Stack:", info.componentStack ?? "No component stack available")

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // Example:
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: info.componentStack,
    //     },
    //   },
    // })
  }

  const handleReset = (
    details:
      | { reason: "imperative-api"; args: unknown[] }
      | { reason: "keys"; prev: unknown[] | undefined; next: unknown[] | undefined }
  ) => {
    // Log reset event for debugging
    if (details.reason === "imperative-api") {
      console.log("🔄 Error boundary reset via API with args:", details.args)
    } else if (details.reason === "keys") {
      console.log("🔄 Error boundary reset due to key change:", {
        previous: details.prev,
        next: details.next,
      })
    }
  }

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={handleReset}
    >
      {children}
    </ReactErrorBoundary>
  )
}
