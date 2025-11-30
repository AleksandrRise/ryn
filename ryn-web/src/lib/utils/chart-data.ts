/**
 * Data transformation utilities for dashboard charts
 */

import type { Violation, Severity, DetectionMethod, ViolationStatus } from "@/lib/types/violation"
import type { ScanSummary } from "@/lib/types/scan"
import type { TrackedRepoWithDetails } from "@/lib/tauri/commands"
import type { TrendTimeRange } from "@/lib/types/chart"

// ============================================================================
// Color Palettes (consistent with existing dashboard styling)
// ============================================================================

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "rgb(248, 113, 113)", // red-400
  high: "rgb(251, 191, 36)",      // amber-400
  medium: "rgb(250, 204, 21)",    // yellow-400
  low: "rgba(255, 255, 255, 0.6)",
}

export const DETECTION_METHOD_COLORS: Record<DetectionMethod, string> = {
  regex: "rgb(147, 197, 253)",    // blue-300
  llm: "rgb(196, 181, 253)",      // violet-300
  hybrid: "rgb(110, 231, 183)",   // emerald-300
}

export const STATUS_COLORS: Record<ViolationStatus, string> = {
  open: "rgb(248, 113, 113)",     // red-400
  fixed: "rgb(110, 231, 183)",    // emerald-400
  dismissed: "rgba(255, 255, 255, 0.4)",
}

export const CONTROL_COLORS: Record<string, string> = {
  "CC6.1": "rgb(147, 197, 253)",  // blue-300 - Access Controls
  "CC6.7": "rgb(196, 181, 253)",  // violet-300 - Encryption & Secrets
  "CC7.2": "rgb(110, 231, 183)",  // emerald-300 - Logging & Monitoring
  "A1.2": "rgb(251, 191, 36)",    // amber-300 - Data Availability
}

export const CONTROL_LABELS: Record<string, string> = {
  "CC6.1": "Access Controls",
  "CC6.7": "Encryption & Secrets",
  "CC7.2": "Logging & Monitoring",
  "A1.2": "Data Availability",
}

// ============================================================================
// Chart Data Types
// ============================================================================

export interface DonutDataPoint {
  name: string
  value: number
  color: string
}

export interface BarDataPoint {
  name: string
  value: number
  color: string
}

export interface TrendDataPoint {
  name: string       // Scan date/label
  critical: number
  high: number
  medium: number
  low: number
  total: number
}

// ============================================================================
// Data Transformation Functions
// ============================================================================

/**
 * Transform violations into severity breakdown data for donut chart
 */
export function toSeverityBreakdown(violations: Violation[]): DonutDataPoint[] {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  for (const v of violations) {
    counts[v.severity]++
  }

  return [
    { name: "Critical", value: counts.critical, color: SEVERITY_COLORS.critical },
    { name: "High", value: counts.high, color: SEVERITY_COLORS.high },
    { name: "Medium", value: counts.medium, color: SEVERITY_COLORS.medium },
    { name: "Low", value: counts.low, color: SEVERITY_COLORS.low },
  ].filter(d => d.value > 0) // Only include non-zero values
}

/**
 * Transform scan history into trend data for area chart
 */
export function toTrendData(
  scans: ScanSummary[],
  timeRange: TrendTimeRange = "last-10"
): TrendDataPoint[] {
  // Sort by date ascending (oldest first for chart display)
  const sorted = [...scans]
    .filter(s => s.status === "completed")
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  // Apply time range filter
  let filtered = sorted
  if (timeRange === "last-5") {
    filtered = sorted.slice(-5)
  } else if (timeRange === "last-10") {
    filtered = sorted.slice(-10)
  }
  // "all-time" uses all data

  return filtered.map(scan => {
    const date = new Date(scan.startedAt)
    const name = `${date.getMonth() + 1}/${date.getDate()}`

    return {
      name,
      critical: scan.criticalCount,
      high: scan.highCount,
      medium: scan.mediumCount,
      low: scan.lowCount,
      total: scan.violationsFound,
    }
  })
}

/**
 * Transform violations into rule category data for bar chart
 */
export function toRuleCategoryData(violations: Violation[]): BarDataPoint[] {
  const counts: Record<string, number> = {}

  for (const v of violations) {
    const controlId = v.controlId
    counts[controlId] = (counts[controlId] || 0) + 1
  }

  return Object.entries(counts)
    .map(([controlId, value]) => ({
      name: CONTROL_LABELS[controlId] || controlId,
      value,
      color: CONTROL_COLORS[controlId] || "rgba(255, 255, 255, 0.6)",
    }))
    .sort((a, b) => b.value - a.value) // Sort by count descending
}

/**
 * Transform violations into detection method data for donut chart
 */
export function toDetectionMethodData(violations: Violation[]): DonutDataPoint[] {
  const counts: Record<DetectionMethod, number> = {
    regex: 0,
    llm: 0,
    hybrid: 0,
  }

  for (const v of violations) {
    counts[v.detectionMethod]++
  }

  return [
    { name: "Regex", value: counts.regex, color: DETECTION_METHOD_COLORS.regex },
    { name: "LLM", value: counts.llm, color: DETECTION_METHOD_COLORS.llm },
    { name: "Hybrid", value: counts.hybrid, color: DETECTION_METHOD_COLORS.hybrid },
  ].filter(d => d.value > 0)
}

/**
 * Transform violations into top files data for bar chart
 */
export function toTopFilesData(violations: Violation[], limit = 10): BarDataPoint[] {
  const fileCounts: Record<string, number> = {}

  for (const v of violations) {
    // Extract just the filename from the full path
    const fileName = v.filePath.split("/").pop() || v.filePath
    fileCounts[fileName] = (fileCounts[fileName] || 0) + 1
  }

  return Object.entries(fileCounts)
    .map(([name, value]) => ({
      name,
      value,
      color: "rgb(248, 113, 113)", // red-400 for all
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/**
 * Transform violations into status data for donut chart
 */
export function toStatusData(violations: Violation[]): DonutDataPoint[] {
  const counts: Record<ViolationStatus, number> = {
    open: 0,
    fixed: 0,
    dismissed: 0,
  }

  for (const v of violations) {
    counts[v.status]++
  }

  return [
    { name: "Open", value: counts.open, color: STATUS_COLORS.open },
    { name: "Fixed", value: counts.fixed, color: STATUS_COLORS.fixed },
    { name: "Dismissed", value: counts.dismissed, color: STATUS_COLORS.dismissed },
  ].filter(d => d.value > 0)
}

/**
 * Transform tracked repos into comparison data for bar chart
 */
export function toRepoComparisonData(repos: TrackedRepoWithDetails[]): BarDataPoint[] {
  return repos
    .filter(r => r.last_scanned_at) // Only repos that have been scanned
    .map(repo => ({
      name: repo.github_repo.name,
      value: repo.total_violations ?? 0,
      color: (repo.critical_violations ?? 0) > 0
        ? SEVERITY_COLORS.critical
        : (repo.total_violations ?? 0) > 0
          ? SEVERITY_COLORS.high
          : "rgb(110, 231, 183)", // emerald for clean
    }))
    .sort((a, b) => b.value - a.value) // Sort by violations descending
}

// ============================================================================
// Aggregate Functions (for GitHub mode without individual violations)
// ============================================================================

/**
 * Create severity breakdown from repo aggregate counts
 */
export function toSeverityBreakdownFromRepos(repos: TrackedRepoWithDetails[]): DonutDataPoint[] {
  let critical = 0
  let total = 0

  for (const repo of repos) {
    if (repo.last_scanned_at) {
      critical += repo.critical_violations ?? 0
      total += repo.total_violations ?? 0
    }
  }

  // We only have critical and total counts from repos
  // Estimate others as (total - critical) split evenly
  const nonCritical = total - critical
  const estimated = Math.floor(nonCritical / 3)

  return [
    { name: "Critical", value: critical, color: SEVERITY_COLORS.critical },
    { name: "High", value: estimated, color: SEVERITY_COLORS.high },
    { name: "Medium", value: estimated, color: SEVERITY_COLORS.medium },
    { name: "Low", value: nonCritical - (estimated * 2), color: SEVERITY_COLORS.low },
  ].filter(d => d.value > 0)
}
