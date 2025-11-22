"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { cancel_scan, respond_to_cost_limit, scan_project } from "@/lib/tauri/commands"
import { toScanSummary } from "@/lib/tauri/transformers"
import type { ScanProgress, ScanSummary } from "@/lib/types/scan"

interface CostLimitData {
  currentCost: number
  costLimit: number
  filesAnalyzed: number
  totalFiles: number
}

interface UseScanRunnerOptions {
  onScanCompleted?: (scan: ScanSummary) => void | Promise<void>
  onScanStopped?: (scanId: number) => void | Promise<void>
}

const initialProgress: ScanProgress = {
  percentage: 0,
  currentFile: "",
  filesScanned: 0,
  totalFiles: 0,
}

export function useScanRunner(
  projectId?: number,
  options: UseScanRunnerOptions = {}
) {
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress>(initialProgress)
  const [currentScanId, setCurrentScanId] = useState<number | null>(null)
  const [costLimitPrompt, setCostLimitPrompt] = useState<{
    open: boolean
    data: CostLimitData | null
  }>({
    open: false,
    data: null,
  })
  // Ref to track scan ID for cleanup effects (avoids stale closure issues)
  const scanIdRef = useRef<number | null>(null)

  // Cancel scan when project changes
  useEffect(() => {
    return () => {
      // Cleanup runs before effect runs again with new projectId
      if (scanIdRef.current) {
        console.log("[useScanRunner] Project changed, cancelling scan:", scanIdRef.current)
        cancel_scan(scanIdRef.current).catch((e) => {
          console.error("[useScanRunner] Failed to cancel scan on project change:", e)
        })
        scanIdRef.current = null
      }
    }
  }, [projectId])

  const startScan = useCallback(async () => {
    if (!projectId) {
      throw new Error("No project selected")
    }

    // Reset state for new scan
    scanIdRef.current = null
    setCurrentScanId(null)
    setIsScanning(true)
    setProgress(initialProgress)

    try {
      const scan = await scan_project(projectId)
      const mapped = toScanSummary(scan)
      setCurrentScanId(mapped.id)
      await options.onScanCompleted?.(mapped)
      return mapped
    } finally {
      setIsScanning(false)
    }
  }, [projectId, options])

  const continueAfterCostLimit = useCallback(async () => {
    if (!currentScanId) return
    await respond_to_cost_limit(currentScanId, true)
    setCostLimitPrompt({ open: false, data: null })
  }, [currentScanId])

  const stopAfterCostLimit = useCallback(async () => {
    if (!currentScanId) return
    await respond_to_cost_limit(currentScanId, false)
    setCostLimitPrompt({ open: false, data: null })
    setIsScanning(false)
    await options.onScanStopped?.(currentScanId)
  }, [currentScanId, options])

  const cancelScan = useCallback(async () => {
    // Cancel on the backend first to stop AI processing
    if (currentScanId) {
      try {
        await cancel_scan(currentScanId)
      } catch (e) {
        console.error("[useScanRunner] Failed to cancel scan on backend:", e)
      }
      void options.onScanStopped?.(currentScanId)
    }
    setIsScanning(false)
    setProgress(initialProgress)
    setCostLimitPrompt({ open: false, data: null })
  }, [currentScanId, options])

  // Listen for scan progress events when a scan is running
  useEffect(() => {
    if (!isScanning) return

    let unlisten: (() => void) | null = null

    const register = async () => {
      unlisten = await listen<{
        scan_id: number
        files_scanned: number
        total_files: number
        violations_found: number
        current_file: string
      }>("scan-progress", (event) => {
        const payload = event.payload
        // Capture scan_id from progress events (emitted before scan_project returns)
        if (payload.scan_id && !scanIdRef.current) {
          scanIdRef.current = payload.scan_id
          setCurrentScanId(payload.scan_id)
        }
        setProgress({
          percentage: payload.total_files > 0
            ? Math.round((payload.files_scanned / payload.total_files) * 100)
            : 0,
          currentFile: payload.current_file,
          filesScanned: payload.files_scanned,
          totalFiles: payload.total_files,
        })
      })
    }

    void register()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [isScanning])

  // Listen for cost limit prompts while scanning
  useEffect(() => {
    if (!isScanning) return

    let unlisten: (() => void) | null = null

    const register = async () => {
      unlisten = await listen<{
        scan_id: number
        current_cost_usd: number
        cost_limit_usd: number
        files_analyzed: number
        total_files: number
      }>("cost-limit-reached", (event) => {
        const data = event.payload
        setCurrentScanId((prev) => prev ?? data.scan_id)
        setCostLimitPrompt({
          open: true,
          data: {
            currentCost: data.current_cost_usd,
            costLimit: data.cost_limit_usd,
            filesAnalyzed: data.files_analyzed,
            totalFiles: data.total_files,
          },
        })
      })
    }

    void register()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [isScanning])

  // Cleanup: Cancel scan on component unmount (page navigation, project switch)
  useEffect(() => {
    return () => {
      // If scan is running when component unmounts, cancel it on the backend
      if (scanIdRef.current) {
        console.log("[useScanRunner] Component unmounting, cancelling scan:", scanIdRef.current)
        cancel_scan(scanIdRef.current).catch((e) => {
          console.error("[useScanRunner] Failed to cancel scan on unmount:", e)
        })
      }
    }
  }, [])

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
