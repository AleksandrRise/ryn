"use client"

import { useCallback, useEffect, useState } from "react"
import { get_scan_cost, get_scans, get_violations } from "@/lib/tauri/commands"
import { toScanCost, toScanSummary, toViolation } from "@/lib/tauri/transformers"
import type { ScanCost, ScanSummary } from "@/lib/types/scan"
import type { Violation } from "@/lib/types/violation"
import { handleTauriError } from "@/lib/utils/error-handler"

interface LastScanStats {
  filesScanned: number
  violationsFound: number
  completedAt: string
}

interface UseScanDataResult {
  isLoading: boolean
  lastScan: ScanSummary | null
  lastScanCost: ScanCost | null
  violations: Violation[]
  lastScanStats: LastScanStats
  reload: () => Promise<void>
}

export function useScanData(projectId?: number): UseScanDataResult {
  const [isLoading, setIsLoading] = useState(false)
  const [lastScan, setLastScan] = useState<ScanSummary | null>(null)
  const [lastScanCost, setLastScanCost] = useState<ScanCost | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [lastScanStats, setLastScanStats] = useState<LastScanStats>({
    filesScanned: 0,
    violationsFound: 0,
    completedAt: "",
  })

  const reset = useCallback(() => {
    setLastScan(null)
    setLastScanCost(null)
    setViolations([])
    setLastScanStats({
      filesScanned: 0,
      violationsFound: 0,
      completedAt: "",
    })
  }, [])

  const load = useCallback(async () => {
    if (!projectId) {
      reset()
      return
    }

    setIsLoading(true)
    try {
      const scans = await get_scans(projectId)
      const latest = scans[0]

      if (!latest) {
        reset()
        return
      }

      const mappedScan = toScanSummary(latest)
      setLastScan(mappedScan)

      try {
        const cost = await get_scan_cost(mappedScan.id)
        setLastScanCost(toScanCost(cost))
      } catch (costError) {
        console.warn("Failed to load scan cost", costError)
        setLastScanCost(null)
      }

      const viols = await get_violations(mappedScan.id, {})
      const mappedViolations = viols.map(toViolation)
      setViolations(mappedViolations)
      setLastScanStats({
        filesScanned: mappedScan.filesScanned || 0,
        violationsFound: mappedViolations.length,
        completedAt: mappedScan.createdAt || mappedScan.startedAt,
      })
    } catch (error) {
      handleTauriError(error, "Failed to load scan data")
      reset()
    } finally {
      setIsLoading(false)
    }
  }, [projectId, reset])

  useEffect(() => {
    void load()
  }, [load])

  return {
    isLoading,
    lastScan,
    lastScanCost,
    violations,
    lastScanStats,
    reload: load,
  }
}
