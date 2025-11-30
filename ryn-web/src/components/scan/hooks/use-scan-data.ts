"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Scan, Violation } from "@/lib/types"

interface LastScanStats {
  filesScanned: number
  violationsFound: number
  completedAt: string
}

interface UseScanDataResult {
  isLoading: boolean
  lastScan: Scan | null
  violations: Violation[]
  lastScanStats: LastScanStats
  reload: () => Promise<void>
  // For scan history feature
  allScans: Scan[]
  loadScanData: (scanId: string) => Promise<{ violations: Violation[] }>
}

export function useScanData(projectId?: string): UseScanDataResult {
  const [isLoading, setIsLoading] = useState(false)
  const [lastScan, setLastScan] = useState<Scan | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [allScans, setAllScans] = useState<Scan[]>([])
  const [lastScanStats, setLastScanStats] = useState<LastScanStats>({
    filesScanned: 0,
    violationsFound: 0,
    completedAt: "",
  })

  const reset = useCallback(() => {
    setLastScan(null)
    setViolations([])
    setAllScans([])
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
    const supabase = createClient()

    try {
      // Get all scans for history feature
      const { data: allScansData, error: allScansError } = await supabase
        .from("scans")
        .select("*")
        .eq("project_id", projectId)
        .order("completed_at", { ascending: false })

      if (allScansError) throw allScansError

      setAllScans(allScansData || [])

      // Get the most recent completed scan
      const { data: scans, error: scansError } = await supabase
        .from("scans")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)

      if (scansError) throw scansError

      const completedScan = scans?.[0]

      if (!completedScan) {
        setLastScan(null)
        setViolations([])
        setLastScanStats({
          filesScanned: 0,
          violationsFound: 0,
          completedAt: "",
        })
        setIsLoading(false)
        return
      }

      setLastScan(completedScan)

      // Get violations for this scan
      const { data: viols, error: violsError } = await supabase
        .from("violations")
        .select("*")
        .eq("scan_id", completedScan.id)

      if (violsError) throw violsError

      setViolations(viols || [])
      setLastScanStats({
        filesScanned: completedScan.files_scanned || 0,
        violationsFound: viols?.length || 0,
        completedAt: completedScan.completed_at || completedScan.created_at,
      })
    } catch (error) {
      console.error("Failed to load scan data:", error)
      reset()
    } finally {
      setIsLoading(false)
    }
  }, [projectId, reset])

  // Load data for any scan (used when viewing historical scans)
  const loadScanData = useCallback(async (scanId: string): Promise<{ violations: Violation[] }> => {
    try {
      const supabase = createClient()
      const { data: viols, error: violsError } = await supabase
        .from("violations")
        .select("*")
        .eq("scan_id", scanId)

      if (violsError) throw violsError

      return { violations: viols || [] }
    } catch (error) {
      console.error("Failed to load scan data:", error)
      return { violations: [] }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return {
    isLoading,
    lastScan,
    violations,
    lastScanStats,
    reload: load,
    allScans,
    loadScanData,
  }
}
