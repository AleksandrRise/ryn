/**
 * Chart type definitions for customizable dashboard visualizations
 */

export type DashboardChartType =
  | "severity-breakdown"
  | "trend-over-time"
  | "by-rule-category"
  | "by-detection-method"
  | "top-problem-files"
  | "status-overview"
  | "repository-comparison"

export type TrendTimeRange = "last-5" | "last-10" | "all-time"

export interface ChartConfig {
  id: DashboardChartType
  label: string
  description: string
  icon: string // Line Awesome icon class (e.g., "la-chart-pie")
  availableFor: ("local" | "github")[]
}

/**
 * All available chart configurations
 * Order determines display order in the dropdown
 */
export const CHART_CONFIGS: ChartConfig[] = [
  {
    id: "severity-breakdown",
    label: "Severity Breakdown",
    description: "Violations by severity level",
    icon: "la-chart-pie",
    availableFor: ["local", "github"],
  },
  {
    id: "trend-over-time",
    label: "Trend Over Time",
    description: "Violations across recent scans",
    icon: "la-chart-area",
    availableFor: ["local", "github"],
  },
  {
    id: "by-rule-category",
    label: "By Rule Category",
    description: "Violations by SOC 2 control",
    icon: "la-list-alt",
    availableFor: ["local", "github"],
  },
  {
    id: "by-detection-method",
    label: "By Detection Method",
    description: "Regex vs LLM vs Hybrid detections",
    icon: "la-robot",
    availableFor: ["local", "github"],
  },
  {
    id: "top-problem-files",
    label: "Top Problem Files",
    description: "Files with most violations",
    icon: "la-file-code",
    availableFor: ["local", "github"],
  },
  {
    id: "status-overview",
    label: "Status Overview",
    description: "Open vs Fixed vs Dismissed",
    icon: "la-tasks",
    availableFor: ["local", "github"],
  },
  {
    id: "repository-comparison",
    label: "Repository Comparison",
    description: "Violations per tracked repository",
    icon: "la-code-branch",
    availableFor: ["github"],
  },
]

export const TIME_RANGE_OPTIONS: { value: TrendTimeRange; label: string }[] = [
  { value: "last-5", label: "Last 5 scans" },
  { value: "last-10", label: "Last 10 scans" },
  { value: "all-time", label: "All time" },
]

/**
 * Get chart configs available for a specific mode
 */
export function getChartsForMode(mode: "local" | "github"): ChartConfig[] {
  return CHART_CONFIGS.filter((c) => c.availableFor.includes(mode))
}

/**
 * Get a chart config by its ID
 */
export function getChartConfig(id: DashboardChartType): ChartConfig | undefined {
  return CHART_CONFIGS.find((c) => c.id === id)
}
