"use client"

import { useCallback, useEffect, useState } from "react"
import { useFileWatcher } from "@/lib/hooks/useFileWatcher"
import { useProjectStore } from "@/lib/stores/project-store"
import {
  get_audit_events,
  get_projects,
  get_scans,
  get_violations,
  get_settings,
} from "@/lib/tauri/commands"
import { toAuditEvent, toScanSummary, toViolation } from "@/lib/tauri/transformers"
import type { AuditEvent } from "@/lib/types/audit"
import type { ScanSummary, SeverityCounts } from "@/lib/types/scan"
import { handleTauriError } from "@/lib/utils/error-handler"

export interface ScanHistoryPoint {
  scanNumber: number
  date: string
  violations: number
  critical: number
  high: number
  medium: number
  low: number
}

interface UseDashboardDataResult {
  isLoading: boolean
  lastScan: ScanSummary | null
  severityCounts: SeverityCounts
  recentActivity: AuditEvent[]
  totalScansCount: number
  fixesAppliedCount: number
  complianceScore: number
  totalViolations: number
  scanHistory: ScanHistoryPoint[]
  refresh: () => Promise<void>
}

const EMPTY_COUNTS: SeverityCounts = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
}

export function useDashboardData(projectId?: number): UseDashboardDataResult {
  const { clearProject } = useProjectStore.getState()
  const [isLoading, setIsLoading] = useState(true)
  const [lastScan, setLastScan] = useState<ScanSummary | null>(null)
  const [severityCounts, setSeverityCounts] = useState<SeverityCounts>(EMPTY_COUNTS)
  const [recentActivity, setRecentActivity] = useState<AuditEvent[]>([])
  const [totalScansCount, setTotalScansCount] = useState(0)
  const [fixesAppliedCount, setFixesAppliedCount] = useState(0)
  const [complianceScore, setComplianceScore] = useState(0)
  const [totalViolations, setTotalViolations] = useState(0)
  const [scanHistory, setScanHistory] = useState<ScanHistoryPoint[]>([])
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(true)

  // Load notification preference once on mount
  useEffect(() => {
    const loadNotificationSetting = async () => {
      try {
        const settings = await get_settings()
        const desktop = settings.find((s) => s.key === "desktop_notifications")
        if (desktop) {
          setDesktopNotificationsEnabled(desktop.value === "true")
        }
      } catch (error) {
        console.error("[ryn] Failed to load desktop notification setting:", error)
      }
    }

    void loadNotificationSetting()
  }, [])

  const refresh = useCallback(async () => {
    if (!projectId) {
      setLastScan(null)
      setSeverityCounts({ ...EMPTY_COUNTS })
      setRecentActivity([])
      setTotalScansCount(0)
      setFixesAppliedCount(0)
      setComplianceScore(0)
      setTotalViolations(0)
      setScanHistory([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const scans = await get_scans(projectId)
      // Filter to completed scans only
      const completedScans = scans.filter(s => s.status === "completed")
      setTotalScansCount(completedScans.length)

      const latest = completedScans[0] ? toScanSummary(completedScans[0]) : null
      setLastScan(latest)

      // Build scan history from last 10 scans (reversed for chart: oldest first)
      const historyScans = completedScans.slice(0, 10).reverse()
      const history: ScanHistoryPoint[] = historyScans.map((scan, idx) => ({
        scanNumber: idx + 1,
        date: new Date(scan.completed_at || scan.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        violations: scan.violations_found,
        critical: scan.critical_count,
        high: scan.high_count,
        medium: scan.medium_count,
        low: scan.low_count,
      }))
      setScanHistory(history)

      if (latest) {
        const violations = (await get_violations(latest.id, {})).map(toViolation)
        const counts: SeverityCounts = { ...EMPTY_COUNTS }
        violations.forEach((v) => {
          counts[v.severity] = (counts[v.severity] ?? 0) + 1
        })
        const total = counts.critical + counts.high + counts.medium + counts.low
        setSeverityCounts(counts)
        setTotalViolations(total)

        // Calculate compliance score based on severity-weighted violations
        // Critical = 10pts, High = 5pts, Medium = 2pts, Low = 1pt
        const maxPenalty = 100
        const penalty = Math.min(maxPenalty, counts.critical * 10 + counts.high * 5 + counts.medium * 2 + counts.low)
        const score = Math.max(0, 100 - penalty)
        setComplianceScore(score)
      } else {
        setSeverityCounts({ ...EMPTY_COUNTS })
        setTotalViolations(0)
        setComplianceScore(100) // No violations = 100%
      }

      const events = (await get_audit_events({ limit: 4 })).map(toAuditEvent)
      setRecentActivity(events)
      setFixesAppliedCount(events.filter((e) => e.eventType === "fix_applied").length)
    } catch (error) {
      try {
        const projects = await get_projects()
        const exists = projects.some((p) => p.id === projectId)
        if (!exists) {
          clearProject()
        }
      } catch {
        // if we can't verify, fall back to bubbling the original error
      }
      handleTauriError(error, "Failed to load dashboard data")
    } finally {
      setIsLoading(false)
    }
  }, [projectId, clearProject])

  // Refresh when project changes
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Refresh on file change
  useFileWatcher(projectId, {
    autoStart: !!projectId,
    onFileChanged: () => {
      void refresh()
    },
    showNotifications: desktopNotificationsEnabled,
  })

  return {
    isLoading,
    lastScan,
    severityCounts,
    recentActivity,
    totalScansCount,
    fixesAppliedCount,
    complianceScore,
    totalViolations,
    scanHistory,
    refresh,
  }
}
