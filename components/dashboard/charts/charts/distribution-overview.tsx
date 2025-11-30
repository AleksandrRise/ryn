"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { memo, useMemo } from "react"
import type { DonutDataPoint } from "@/lib/utils/chart-data"

interface DistributionOverviewProps {
  severityData: DonutDataPoint[]
  statusData: DonutDataPoint[]
  detectionMethodData: DonutDataPoint[]
  height?: number | string
}

function MiniDonutComponent({
  data,
  label,
  centerValue,
  centerLabel,
  secondaryLabel,
}: {
  data: DonutDataPoint[]
  label: string
  centerValue: number | string
  centerLabel: string
  secondaryLabel?: string
}) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  if (data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center">
        <span className="text-xs text-white/40 mb-2">{label}</span>
        <div className="h-[140px] flex items-center justify-center text-xs text-white/30">
          No data
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center min-w-0">
      <span className="text-xs text-white/50 mb-1">{label}</span>
      <div className="w-full h-[140px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={55}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as DonutDataPoint
                const percent = ((item.value / total) * 100).toFixed(1)
                return (
                  <div className="rounded-lg border border-white/10 bg-[rgba(13,13,20,0.98)] px-2 py-1.5 text-xs shadow-lg">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-white/80">{item.name}</span>
                    </div>
                    <div className="mt-0.5 text-white/60">
                      {item.value} ({percent}%)
                    </div>
                  </div>
                )
              }}
            />
            <text
              x="50%"
              y={secondaryLabel ? "46%" : "50%"}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-lg font-bold"
            >
              {centerValue}
            </text>
            <text
              x="50%"
              y={secondaryLabel ? "56%" : "60%"}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white/40 text-[9px] uppercase tracking-wider"
            >
              {centerLabel}
            </text>
            {secondaryLabel && (
              <text
                x="50%"
                y="66%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-emerald-400 text-[9px]"
              >
                {secondaryLabel}
              </text>
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-white/50">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MiniDonut = memo(MiniDonutComponent, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.label === next.label &&
    prev.centerValue === next.centerValue &&
    prev.centerLabel === next.centerLabel &&
    prev.secondaryLabel === next.secondaryLabel
  )
})

function DistributionOverviewComponent({
  severityData,
  statusData,
  detectionMethodData,
}: DistributionOverviewProps) {
  const severityTotal = useMemo(() => severityData.reduce((sum, d) => sum + d.value, 0), [severityData])
  const statusTotal = useMemo(() => statusData.reduce((sum, d) => sum + d.value, 0), [statusData])
  const openCount = useMemo(() => statusData.find((d) => d.name === "Open")?.value ?? 0, [statusData])
  const fixedCount = useMemo(() => statusData.find((d) => d.name === "Fixed")?.value ?? 0, [statusData])
  const fixRate = useMemo(
    () => statusTotal > 0 ? `${((fixedCount / statusTotal) * 100).toFixed(0)}% fixed` : undefined,
    [statusTotal, fixedCount]
  )
  const detectionTotal = useMemo(() => detectionMethodData.reduce((sum, d) => sum + d.value, 0), [detectionMethodData])

  return (
    <div className="h-full flex items-center justify-center gap-4 px-2">
      <MiniDonut
        data={severityData}
        label="Severity"
        centerValue={severityTotal}
        centerLabel="Total"
      />
      <MiniDonut
        data={statusData}
        label="Status"
        centerValue={openCount}
        centerLabel="Open"
        secondaryLabel={fixRate}
      />
      <MiniDonut
        data={detectionMethodData}
        label="Detection"
        centerValue={detectionTotal}
        centerLabel="Detections"
      />
    </div>
  )
}

export const DistributionOverview = memo(DistributionOverviewComponent, (prev, next) => {
  return (
    prev.severityData === next.severityData &&
    prev.statusData === next.statusData &&
    prev.detectionMethodData === next.detectionMethodData &&
    prev.height === next.height
  )
})
