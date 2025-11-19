"use client"

import { useCallback, useEffect, useState } from "react"
import { useFileWatcher } from "@/lib/hooks/useFileWatcher"
import { useProjectStore } from "@/lib/stores/project-store"
import {
  get_audit_events,
  get_projects,
  get_scans,
  get_violations,
} from "@/lib/tauri/commands"
import { toAuditEvent, toScanSummary, toViolation } from "@/lib/tauri/transformers"
import type { AuditEvent } from "@/lib/types/audit"
import type { ScanSummary, SeverityCounts } from "@/lib/types/scan"
import { handleTauriError } from "@/lib/utils/error-handler"

interface UseDashboardDataResult {
  isLoading: boolean
  lastScan: ScanSummary | null
  severityCounts: SeverityCounts
  recentActivity: AuditEvent[]
  totalScansCount: number
  fixesAppliedCount: number
  complianceScore: number
  totalViolations: number
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

  const refresh = useCallback(async () => {
    if (!projectId) {
      setLastScan(null)
      setSeverityCounts({ ...EMPTY_COUNTS })
      setRecentActivity([])
      setTotalScansCount(0)
      setFixesAppliedCount(0)
      setComplianceScore(0)
      setTotalViolations(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const scans = await get_scans(projectId)
      setTotalScansCount(scans.length)

      const latest = scans[0] ? toScanSummary(scans[0]) : null
      setLastScan(latest)

      if (latest) {
        const violations = (await get_violations(latest.id, {})).map(toViolation)
        const counts: SeverityCounts = { ...EMPTY_COUNTS }
        violations.forEach((v) => {
          counts[v.severity] = (counts[v.severity] ?? 0) + 1
        })
        const total = counts.critical + counts.high + counts.medium + counts.low
        setSeverityCounts(counts)
        setTotalViolations(total)

        const score = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (1 -
                total /
                  Math.max(1, latest.violationsFound || total || 1)) *
                100,
            ),
          ),
        )
        setComplianceScore(score)
      } else {
        setSeverityCounts({ ...EMPTY_COUNTS })
        setTotalViolations(0)
        setComplianceScore(0)
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
    showNotifications: true,
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
    refresh,
  }
}
