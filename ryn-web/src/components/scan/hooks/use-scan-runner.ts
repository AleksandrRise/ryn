"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Scan } from "@/lib/types"

export interface ScanProgress {
  percentage: number
  currentFile: string
  filesScanned: number
  totalFiles: number
}

interface CostLimitData {
  currentCost: number
  costLimit: number
  filesAnalyzed: number
  totalFiles: number
}

interface UseScanRunnerOptions {
  onScanCompleted?: (scan: Scan) => void | Promise<void>
  onScanStopped?: (scanId: string) => void | Promise<void>
}

const initialProgress: ScanProgress = {
  percentage: 0,
  currentFile: "",
  filesScanned: 0,
  totalFiles: 0,
}

export function useScanRunner(
  projectId?: string,
  options: UseScanRunnerOptions = {}
) {
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress>(initialProgress)
  const [currentScanId, setCurrentScanId] = useState<string | null>(null)
  const [costLimitPrompt, setCostLimitPrompt] = useState<{
    open: boolean
    data: CostLimitData | null
  }>({
    open: false,
    data: null,
  })
  const scanIdRef = useRef<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on project change
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [projectId])

  const startScan = useCallback(async () => {
    if (!projectId) {
      throw new Error("No project selected")
    }

    scanIdRef.current = null
    setCurrentScanId(null)
    setIsScanning(true)
    setProgress(initialProgress)

    try {
      const supabase = createClient()

      // Call the scan API endpoint
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to start scan")
      }

      const { scanId } = await response.json()
      scanIdRef.current = scanId
      setCurrentScanId(scanId)

      // Poll for scan completion
      let completed = false
      const pollCount = 0
      const maxPolls = 300 // 5 minutes with 1 second intervals

      while (!completed && pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const { data: scan, error } = await supabase
          .from("scans")
          .select("*")
          .eq("id", scanId)
          .single()

        if (error) {
          console.error("Failed to poll scan status:", error)
          continue
        }

        if (scan) {
          // Update progress
          setProgress({
            percentage:
              scan.total_files > 0
                ? Math.round((scan.files_scanned / scan.total_files) * 100)
                : 0,
            currentFile: `Processed ${scan.files_scanned} files`,
            filesScanned: scan.files_scanned,
            totalFiles: scan.total_files,
          })

          if (scan.status === "completed" || scan.status === "failed") {
            completed = true
            setIsScanning(false)

            if (scan.status === "completed") {
              await options.onScanCompleted?.(scan)
            }
          }
        }
      }

      return await supabase
        .from("scans")
        .select("*")
        .eq("id", scanId)
        .single()
        .then(({ data }) => data)
    } catch (error) {
      setIsScanning(false)
      console.error("Failed to start scan:", error)
      throw error
    }
  }, [projectId, options])

  const continueAfterCostLimit = useCallback(async () => {
    // Placeholder for cost limit continuation
    setCostLimitPrompt({ open: false, data: null })
  }, [])

  const stopAfterCostLimit = useCallback(async () => {
    if (currentScanId) {
      await options.onScanStopped?.(currentScanId)
    }
    setIsScanning(false)
    setCostLimitPrompt({ open: false, data: null })
  }, [currentScanId, options])

  const cancelScan = useCallback(async () => {
    if (currentScanId) {
      try {
        await fetch(`/api/scan/${currentScanId}`, {
          method: "DELETE",
        })
      } catch (error) {
        console.error("Failed to cancel scan:", error)
      }
      await options.onScanStopped?.(currentScanId)
    }
    setIsScanning(false)
    setProgress(initialProgress)
    setCostLimitPrompt({ open: false, data: null })
  }, [currentScanId, options])

  return {
    isScanning,
    progress,
    costLimitPrompt,
    currentScanId,
    startScan,
    cancelScan,
    continueAfterCostLimit,
    stopAfterCostLimit,
  }
}
