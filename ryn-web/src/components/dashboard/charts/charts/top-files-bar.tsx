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
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            backgroundColor: "rgba(13,13,20,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            fontSize: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.6)" }}
          formatter={(value: number, _name: string, props?: { payload?: BarDataPoint & { displayName: string } }) => [
            `${value} violations`,
            props?.payload?.name ?? 'Unknown', // Show full name in tooltip
          ]}
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
