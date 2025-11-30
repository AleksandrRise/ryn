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

interface RepoComparisonBarProps {
  data: BarDataPoint[]
  height?: number | string
}

export function RepoComparisonBar({ data, height = "100%" }: RepoComparisonBarProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        No repositories have been scanned yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 30, left: -10 }}>
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          allowDecimals={false}
        />

        <Tooltip
          allowEscapeViewBox={{ x: true, y: true }}
          isAnimationActive={false}
          wrapperStyle={{ pointerEvents: "none" }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const item = payload[0].payload as BarDataPoint
            return (
              <div className="rounded-xl border border-white/10 bg-[rgba(13,13,20,0.98)] px-3 py-2 text-xs shadow-lg">
                <span className="text-white/60">{item.name} : {item.value} violations</span>
              </div>
            )
          }}
        />

        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
