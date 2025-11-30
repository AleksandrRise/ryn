"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { TrendDataPoint } from "@/lib/utils/chart-data"
import { SEVERITY_COLORS } from "@/lib/utils/chart-data"

interface TrendAreaProps {
  data: TrendDataPoint[]
  height?: number
}

export function TrendArea({ data, height = 220 }: TrendAreaProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        No scan history available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="gradCritical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SEVERITY_COLORS.high} stopOpacity={0.3} />
            <stop offset="100%" stopColor={SEVERITY_COLORS.high} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradMedium" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SEVERITY_COLORS.medium} stopOpacity={0.25} />
            <stop offset="100%" stopColor={SEVERITY_COLORS.medium} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="rgba(255,255,255,0.6)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
        />

        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(13,13,20,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            fontSize: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.6)" }}
        />

        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingBottom: 10 }}
          formatter={(value: string) => (
            <span className="text-xs text-white/50">{value}</span>
          )}
        />

        <Area
          type="monotone"
          dataKey="critical"
          name="Critical"
          stackId="1"
          stroke={SEVERITY_COLORS.critical}
          strokeWidth={2}
          fill="url(#gradCritical)"
        />
        <Area
          type="monotone"
          dataKey="high"
          name="High"
          stackId="1"
          stroke={SEVERITY_COLORS.high}
          strokeWidth={2}
          fill="url(#gradHigh)"
        />
        <Area
          type="monotone"
          dataKey="medium"
          name="Medium"
          stackId="1"
          stroke={SEVERITY_COLORS.medium}
          strokeWidth={2}
          fill="url(#gradMedium)"
        />
        <Area
          type="monotone"
          dataKey="low"
          name="Low"
          stackId="1"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={2}
          fill="url(#gradLow)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
