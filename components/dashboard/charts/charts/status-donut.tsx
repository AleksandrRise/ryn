"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import type { DonutDataPoint } from "@/lib/utils/chart-data"

interface StatusDonutProps {
  data: DonutDataPoint[]
  height?: number
}

export function StatusDonut({ data, height = 220 }: StatusDonutProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        No violation data available
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)
  const openCount = data.find((d) => d.name === "Open")?.value ?? 0
  const fixedCount = data.find((d) => d.name === "Fixed")?.value ?? 0
  const fixRate = total > 0 ? ((fixedCount / total) * 100).toFixed(0) : 0

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={85}
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
              <div className="rounded-xl border border-white/10 bg-[rgba(13,13,20,0.98)] px-3 py-2 text-xs shadow-lg">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-white/80">{item.name}</span>
                </div>
                <div className="mt-1 text-white/60">
                  {item.value} violations ({percent}%)
                </div>
              </div>
            )
          }}
        />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span className="text-xs text-white/60">{value}</span>
          )}
        />
        {/* Center text showing open count or fix rate */}
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-white text-2xl font-bold"
        >
          {openCount}
        </text>
        <text
          x="50%"
          y="54%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-white/40 text-[10px] uppercase tracking-wider"
        >
          Open
        </text>
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-emerald-400 text-[10px]"
        >
          {fixRate}% fixed
        </text>
      </PieChart>
    </ResponsiveContainer>
  )
}
