"use client"

import { useMemo } from "react"
import type { DashboardChartType, TrendTimeRange } from "@/lib/types/chart"
import type { Violation } from "@/lib/types/violation"
import type { ScanSummary } from "@/lib/types/scan"
import type { TrackedRepoWithDetails } from "@/lib/tauri/commands"
import {
  toSeverityBreakdown,
  toTrendData,
  toRuleCategoryData,
  toDetectionMethodData,
  toTopFilesData,
  toStatusData,
  toRepoComparisonData,
  toSeverityBreakdownFromRepos,
} from "@/lib/utils/chart-data"

// Import individual chart components
import { DistributionOverview } from "./charts/distribution-overview"
import { TrendArea } from "./charts/trend-area"
import { RuleCategoryBar } from "./charts/rule-category-bar"
import { TopFilesBar } from "./charts/top-files-bar"
import { RepoComparisonBar } from "./charts/repo-comparison-bar"

interface ChartContainerProps {
  chartType: DashboardChartType
  mode: "local" | "github"
  // Data sources
  violations: Violation[]
  scans: ScanSummary[]
  trackedRepos?: TrackedRepoWithDetails[]
  // Options
  timeRange?: TrendTimeRange
  height?: number | string
}

export function ChartContainer({
  chartType,
  mode,
  violations,
  scans,
  trackedRepos = [],
  timeRange = "last-10",
  height = "100%",
}: ChartContainerProps) {
  // Memoize data transformations to prevent unnecessary re-renders
  const severityData = useMemo(() => {
    // For GitHub mode without individual violations, use repo aggregates
    if (mode === "github" && violations.length === 0 && trackedRepos.length > 0) {
      return toSeverityBreakdownFromRepos(trackedRepos)
    }
    return toSeverityBreakdown(violations)
  }, [violations, trackedRepos, mode])

  const trendData = useMemo(
    () => toTrendData(scans, timeRange),
    [scans, timeRange]
  )

  const ruleCategoryData = useMemo(
    () => toRuleCategoryData(violations),
    [violations]
  )

  const detectionMethodData = useMemo(
    () => toDetectionMethodData(violations),
    [violations]
  )

  const topFilesData = useMemo(
    () => toTopFilesData(violations, 8),
    [violations]
  )

  const statusData = useMemo(
    () => toStatusData(violations),
    [violations]
  )

  const repoComparisonData = useMemo(
    () => toRepoComparisonData(trackedRepos),
    [trackedRepos]
  )

  // Render the appropriate chart based on type
  switch (chartType) {
    case "distribution-overview":
      if (mode === "github" && violations.length === 0) {
        return (
          <div className="h-full flex items-center justify-center text-sm text-white/40">
            Distribution overview requires individual violation data
          </div>
        )
      }
      return (
        <DistributionOverview
          severityData={severityData}
          statusData={statusData}
          detectionMethodData={detectionMethodData}
          height={height}
        />
      )

    case "trend-over-time":
      return <TrendArea data={trendData} height={height} />

    case "by-rule-category":
      if (mode === "github" && violations.length === 0) {
        return (
          <div className="h-full flex items-center justify-center text-sm text-white/40">
            Rule category breakdown requires individual violation data
          </div>
        )
      }
      return <RuleCategoryBar data={ruleCategoryData} height={height} />

    case "top-problem-files":
      if (mode === "github" && violations.length === 0) {
        return (
          <div className="h-full flex items-center justify-center text-sm text-white/40">
            Top files breakdown requires individual violation data
          </div>
        )
      }
      return <TopFilesBar data={topFilesData} height={height} />

    case "repository-comparison":
      if (mode === "local") {
        return (
          <div className="h-full flex items-center justify-center text-sm text-white/40">
            Repository comparison is only available in GitHub mode
          </div>
        )
      }
      return <RepoComparisonBar data={repoComparisonData} height={height} />

    default:
      return (
        <div className="h-full flex items-center justify-center text-sm text-white/40">
          Unknown chart type
        </div>
      )
  }
}
