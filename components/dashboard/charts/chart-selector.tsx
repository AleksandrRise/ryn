"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CHART_CONFIGS,
  TIME_RANGE_OPTIONS,
  getChartsForMode,
  type DashboardChartType,
  type TrendTimeRange,
} from "@/lib/types/chart"

interface ChartSelectorProps {
  chartType: DashboardChartType
  onChartTypeChange: (type: DashboardChartType) => void
  mode: "local" | "github"
  timeRange?: TrendTimeRange
  onTimeRangeChange?: (range: TrendTimeRange) => void
  showTimeRange?: boolean
}

export function ChartSelector({
  chartType,
  onChartTypeChange,
  mode,
  timeRange = "last-10",
  onTimeRangeChange,
  showTimeRange = false,
}: ChartSelectorProps) {
  const availableCharts = getChartsForMode(mode)
  const currentConfig = CHART_CONFIGS.find((c) => c.id === chartType)

  return (
    <div className="flex items-center gap-2">
      {/* Chart Type Selector */}
      <Select value={chartType} onValueChange={(v) => onChartTypeChange(v as DashboardChartType)}>
        <SelectTrigger size="sm" className="w-[180px] bg-white/[0.06] border-white/10">
          <SelectValue>
            {currentConfig && (
              <span className="flex items-center gap-2">
                <i className={`las ${currentConfig.icon} text-sm text-white/60`} />
                <span className="truncate">{currentConfig.label}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-[#0f0f16] border-white/10">
          {availableCharts.map((chart) => (
            <SelectItem
              key={chart.id}
              value={chart.id}
              label={
                <span className="flex items-center gap-2">
                  <i className={`las ${chart.icon} text-sm text-white/60`} />
                  <span>{chart.label}</span>
                </span>
              }
              description={chart.description}
            />
          ))}
        </SelectContent>
      </Select>

      {/* Time Range Selector (only shown for trend chart) */}
      {showTimeRange && onTimeRangeChange && (
        <Select value={timeRange} onValueChange={(v) => onTimeRangeChange(v as TrendTimeRange)}>
          <SelectTrigger size="sm" className="w-[130px] bg-white/[0.06] border-white/10">
            <SelectValue>
              {TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[#0f0f16] border-white/10">
            {TIME_RANGE_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                label={option.label}
              />
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
