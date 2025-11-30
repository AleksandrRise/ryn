"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { BarDataPoint } from "@/lib/utils/chart-data"

interface TopFilesBarProps {
  data: BarDataPoint[]
  height?: number | string
}

export function TopFilesBar({ data, height = "100%" }: TopFilesBarProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        No violation data available
      </div>
    )
  }

  // Truncate long file names for display
  const displayData = data.map((d) => ({
    ...d,
    displayName: d.name.length > 20 ? `...${d.name.slice(-17)}` : d.name,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={displayData}
        layout="vertical"
        margin={{ top: 10, right: 30, bottom: 10, left: 120 }}
      >
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="displayName"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
          width={115}
        />

        <Tooltip
          allowEscapeViewBox={{ x: true, y: true }}
          isAnimationActive={false}
          wrapperStyle={{ pointerEvents: "none" }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const item = payload[0].payload as BarDataPoint & { displayName: string }
            return (
              <div className="rounded-xl border border-white/10 bg-[rgba(13,13,20,0.98)] px-3 py-2 text-xs shadow-lg">
                <span className="text-white/60">{item.name} : {item.value} violations</span>
              </div>
            )
          }}
        />

        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {displayData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
