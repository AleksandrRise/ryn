"use client"

import { useCallback, useEffect, useState } from "react"
import {
  get_projects,
  get_scans,
  get_violations,
} from "@/lib/tauri/commands"
import type { Project } from "@/lib/tauri/commands"
import { toScanSummary, toViolation } from "@/lib/tauri/transformers"
import type { SeverityCounts } from "@/lib/types/scan"
import { handleTauriError } from "@/lib/utils/error-handler"
import type { ScanSummary } from "@/lib/types/scan"

export interface ProjectHealth {
  project: Project
  lastScanDate: string | null
  totalViolations: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  scanCount: number
  status: "healthy" | "warning" | "critical" | "no-scans"
}

export interface ScanTrendPoint {
  date: string
  violations: number
}

interface UseDashboardDataResult {
  isLoading: boolean
  // Aggregate stats
  totalProjects: number
  totalViolations: number
  totalScans: number
  severityCounts: SeverityCounts
  // Per-project data
  projectHealthList: ProjectHealth[]
  // Trend data
  scanTrend: ScanTrendPoint[]
  recentScans: RecentScan[]
  refresh: () => Promise<void>
}

export interface RecentScan extends ScanSummary {
  projectName: string
}

const EMPTY_COUNTS: SeverityCounts = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
}

export function useDashboardData(): UseDashboardDataResult {
  const [isLoading, setIsLoading] = useState(true)
  const [totalProjects, setTotalProjects] = useState(0)
  const [totalViolations, setTotalViolations] = useState(0)
  const [totalScans, setTotalScans] = useState(0)
  const [severityCounts, setSeverityCounts] = useState<SeverityCounts>(EMPTY_COUNTS)
  const [projectHealthList, setProjectHealthList] = useState<ProjectHealth[]>([])
  const [scanTrend, setScanTrend] = useState<ScanTrendPoint[]>([])
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const projects = await get_projects()
      setTotalProjects(projects.length)

      if (projects.length === 0) {
        setTotalViolations(0)
        setTotalScans(0)
        setSeverityCounts({ ...EMPTY_COUNTS })
        setProjectHealthList([])
        setScanTrend([])
        setIsLoading(false)
        return
      }

      // Aggregate data across all projects
      let aggViolations = 0
      let aggScans = 0
      const aggCounts: SeverityCounts = { ...EMPTY_COUNTS }
      const healthList: ProjectHealth[] = []
      const allScansForTrend: { date: Date; violations: number }[] = []
      const allCompletedScans: { project: Project; scan: ScanSummary }[] = []

      for (const project of projects) {
        try {
          const scans = (await get_scans(project.id)).map(toScanSummary)
          const completedScans = scans.filter(s => s.status === "completed")
          aggScans += completedScans.length

          // Get latest scan for this project
          const latestScan = completedScans[0]
          let projectViolations = 0
          let projectCritical = 0
          let projectHigh = 0
          let projectMedium = 0
          let projectLow = 0

          if (latestScan) {
            const violations = (await get_violations(latestScan.id, {})).map(toViolation)
            projectViolations = violations.length

            for (const v of violations) {
              if (v.severity === "critical") projectCritical++
              else if (v.severity === "high") projectHigh++
              else if (v.severity === "medium") projectMedium++
              else if (v.severity === "low") projectLow++
            }

            aggViolations += projectViolations
            aggCounts.critical += projectCritical
            aggCounts.high += projectHigh
            aggCounts.medium += projectMedium
            aggCounts.low += projectLow

            // Collect scans for trend (last 10 scans across all projects)
            for (const scan of completedScans.slice(0, 5)) {
              allScansForTrend.push({
                date: new Date(scan.completedAt || scan.startedAt),
                violations: scan.violationsFound,
              })
            }

            // Collect for recent scans feed
            for (const scan of completedScans) {
              allCompletedScans.push({ project, scan })
            }
          }

          // Determine project health status
          let status: ProjectHealth["status"] = "no-scans"
          if (latestScan) {
            if (projectCritical > 0) status = "critical"
            else if (projectHigh > 0) status = "warning"
            else status = "healthy"
          }

          healthList.push({
            project,
            lastScanDate: latestScan?.completedAt || latestScan?.startedAt || null,
            totalViolations: projectViolations,
            criticalCount: projectCritical,
            highCount: projectHigh,
            mediumCount: projectMedium,
            lowCount: projectLow,
            scanCount: completedScans.length,
            status,
          })
        } catch {
          // If a project fails, still include it with no-scans status
          healthList.push({
            project,
            lastScanDate: null,
            totalViolations: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            scanCount: 0,
            status: "no-scans",
          })
        }
      }

      // Sort projects: critical first, then warning, then healthy, then no-scans
      const statusOrder = { critical: 0, warning: 1, healthy: 2, "no-scans": 3 }
      healthList.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

      // Build trend data (last 10 scans sorted by date)
      allScansForTrend.sort((a, b) => a.date.getTime() - b.date.getTime())
      const trendData = allScansForTrend.slice(-10).map(s => ({
        date: s.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        violations: s.violations,
      }))

      // Build recent scans (most recent first)
      allCompletedScans.sort((a, b) => {
        const aDate = new Date(a.scan.completedAt || a.scan.startedAt).getTime()
        const bDate = new Date(b.scan.completedAt || b.scan.startedAt).getTime()
        return bDate - aDate
      })

      const recent = allCompletedScans.slice(0, 10).map(({ project, scan }) => ({
        ...scan,
        projectName: project.name,
      }))

      setTotalViolations(aggViolations)
      setTotalScans(aggScans)
      setSeverityCounts(aggCounts)
      setProjectHealthList(healthList)
      setScanTrend(trendData)
      setRecentScans(recent)
    } catch (error) {
      handleTauriError(error, "Failed to load dashboard data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    isLoading,
    totalProjects,
    totalViolations,
    totalScans,
    severityCounts,
    projectHealthList,
    scanTrend,
    recentScans,
    refresh,
  }
}
