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

interface RuleCategoryBarProps {
  data: BarDataPoint[]
  height?: number | string
}

export function RuleCategoryBar({ data, height = "100%" }: RuleCategoryBarProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        No violation data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, bottom: 10, left: 100 }}
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
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          width={95}
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
          formatter={(value: number) => [`${value} violations`, "Count"]}
        />

        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
