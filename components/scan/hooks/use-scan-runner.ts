"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { cancel_scan, respond_to_cost_limit, scan_project } from "@/lib/tauri/commands"
import { toScanSummary } from "@/lib/tauri/transformers"
import type {
  ScanProgress,
  ScanSummary,
  AiActivity,
  AiFileStream,
  AiFileStartedEvent,
  AiReasoningChunkEvent,
  AiFileCompletedEvent,
  AiBatchStartedEvent,
} from "@/lib/types/scan"

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

const initialAiActivity: AiActivity = {
  phase: "idle",
  currentBatch: 0,
  totalBatches: 0,
  filesAnalyzed: 0,
  totalLlmFiles: 0,
  activeStreams: new Map(),
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
  // AI activity state for real-time transparency into AI analysis
  const [aiActivity, setAiActivity] = useState<AiActivity>(initialAiActivity)
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
    setAiActivity(initialAiActivity)

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

  // Listen for AI transparency events while scanning
  useEffect(() => {
    if (!isScanning) return

    const unlisteners: Array<() => void> = []

    const register = async () => {
      // AI file started
      const unlistenStarted = await listen<{
        scan_id: number
        file_path: string
        file_index: number
        total_llm_files: number
        selection_reason: string
      }>("ai-file-started", (event) => {
        const { file_path, file_index, total_llm_files, selection_reason } = event.payload
        setAiActivity((prev) => {
          const newStreams = new Map(prev.activeStreams)
          const newStream: AiFileStream = {
            filePath: file_path,
            status: "analyzing",
            streamingText: "",
            selectionReason: selection_reason as AiFileStream["selectionReason"],
            violationsFound: 0,
            startedAt: Date.now(),
          }
          newStreams.set(file_path, newStream)
          return {
            ...prev,
            phase: "analyzing",
            totalLlmFiles: total_llm_files,
            activeStreams: newStreams,
          }
        })
      })
      unlisteners.push(unlistenStarted)

      // AI reasoning chunk (streaming text)
      const unlistenChunk = await listen<{
        scan_id: number
        file_path: string
        chunk: string
        accumulated: string
      }>("ai-reasoning-chunk", (event) => {
        const { file_path, accumulated } = event.payload
        setAiActivity((prev) => {
          const newStreams = new Map(prev.activeStreams)
          const existing = newStreams.get(file_path)
          if (existing) {
            newStreams.set(file_path, {
              ...existing,
              streamingText: accumulated,
            })
          }
          return { ...prev, activeStreams: newStreams }
        })
      })
      unlisteners.push(unlistenChunk)

      // AI file completed
      const unlistenCompleted = await listen<{
        scan_id: number
        file_path: string
        violations_found: number
        confidence_scores: number[]
        summary: string
      }>("ai-file-completed", (event) => {
        const { file_path, violations_found } = event.payload
        setAiActivity((prev) => {
          const newStreams = new Map(prev.activeStreams)
          const existing = newStreams.get(file_path)
          if (existing) {
            newStreams.set(file_path, {
              ...existing,
              status: "complete",
              violationsFound: violations_found,
            })
          }
          return {
            ...prev,
            filesAnalyzed: prev.filesAnalyzed + 1,
            activeStreams: newStreams,
          }
        })
      })
      unlisteners.push(unlistenCompleted)

      // AI batch started
      const unlistenBatch = await listen<{
        scan_id: number
        batch_number: number
        total_batches: number
        files_in_batch: string[]
      }>("ai-batch-started", (event) => {
        const { batch_number, total_batches } = event.payload
        setAiActivity((prev) => ({
          ...prev,
          currentBatch: batch_number,
          totalBatches: total_batches,
        }))
      })
      unlisteners.push(unlistenBatch)
    }

    void register()

    return () => {
      unlisteners.forEach((unlisten) => unlisten())
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
    aiActivity,
    startScan,
    cancelScan,
    continueAfterCostLimit,
    stopAfterCostLimit,
  }
}
