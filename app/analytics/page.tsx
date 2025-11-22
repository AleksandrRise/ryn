'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { CalendarIcon, TrendingUpIcon, DollarSignIcon, ActivityIcon, Sparkles } from 'lucide-react'
import { get_scan_costs, type TimeRange, type ScanCost } from "@/lib/tauri/commands"
import type { CategoricalChartState } from 'recharts/types/chart/types'

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [scanCosts, setScanCosts] = useState<ScanCost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number
    y: number
  } | null>(null)

  const loadScanCosts = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const costs = await get_scan_costs(timeRange)
      setScanCosts(costs)
    } catch (err) {
      console.error('[ryn] Failed to load scan costs:', err)
      setError('Failed to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    void loadScanCosts()
  }, [loadScanCosts])

  const handleChartMouseMove = (state: CategoricalChartState) => {
    if (typeof state?.chartX !== 'number' || typeof state?.chartY !== 'number') {
      return
    }

    setTooltipPosition({
      x: state.chartX + 12,
      y: state.chartY - 32,
    })
  }

  const handleChartMouseLeave = () => {
    setTooltipPosition(null)
  }

  // Calculate cumulative stats
  const totalCost = scanCosts.reduce((sum, cost) => sum + cost.total_cost_usd, 0)
  const totalFiles = scanCosts.reduce((sum, cost) => sum + cost.files_analyzed_with_llm, 0)
  const totalTokens = scanCosts.reduce((sum, cost) =>
    sum + cost.input_tokens + cost.output_tokens + cost.cache_read_tokens + cost.cache_write_tokens, 0)
  const avgCostPerScan = scanCosts.length > 0 ? totalCost / scanCosts.length : 0

  const primaryRangeLabel =
    timeRange === '24h' ? 'Last 24 hours' :
    timeRange === '7d' ? 'Last 7 days' :
    timeRange === '30d' ? 'Last 30 days' : 'All time'

  // Group costs by date for bar chart
  const dailyData = scanCosts.reduce((acc, cost) => {
    const date = new Date(cost.created_at).toLocaleDateString()
    const existing = acc.find(d => d.date === date)

    if (existing) {
      existing.cost += cost.total_cost_usd
      existing.scans += 1
    } else {
      acc.push({
        date,
        cost: cost.total_cost_usd,
        scans: 1,
      })
    }

    return acc
  }, [] as Array<{ date: string; cost: number; scans: number }>)

  // Sort by date and take most recent entries (limit to 30 days max for readability)
  const chartData = dailyData
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30)

  return (
    <>
      <main className="px-4 pb-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Hero */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-r from-amber-500/10 via-orange-500/8 to-purple-500/10 px-6 py-6 shadow-[0_10px_80px_-30px_rgba(255,180,80,0.55)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                  <Sparkles className="size-4" />
                  LLM Spend Overview
                </div>
                <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight">${totalCost.toFixed(2)}</h1>
                <p className="text-sm text-white/70">Consumed {primaryRangeLabel.toLowerCase()} across {scanCosts.length || '0'} scans.</p>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-4 text-white/70" />
                  <div className="flex gap-2">
                    {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
                      <Button
                        key={range}
                        variant={timeRange === range ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTimeRange(range)}
                        className={`min-w-[88px] ${timeRange === range ? 'bg-white text-black hover:bg-white/90' : 'border-white/20 text-white/80 hover:text-white hover:border-white/30'}`}
                      >
                        {range === '24h' ? 'Last 24h' :
                         range === '7d' ? 'Last 7 days' :
                         range === '30d' ? 'Last 30 days' : 'All time'}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/80 shadow-inner">
                  <div className="flex items-center gap-2">
                    <TrendingUpIcon className="size-4 text-emerald-300" />
                    <div>
                      <div className="font-semibold">${avgCostPerScan.toFixed(3)} per scan</div>
                      <div className="text-xs text-white/60">Avg in {primaryRangeLabel.toLowerCase()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Cost
                </CardTitle>
                <DollarSignIcon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  ${totalCost.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {scanCosts.length} scans
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Cost Per Scan
                </CardTitle>
                <TrendingUpIcon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  ${avgCostPerScan.toFixed(3)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {scanCosts.length > 0 ? 'Average' : 'No data'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Files Analyzed
                </CardTitle>
                <ActivityIcon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {totalFiles.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  With LLM analysis
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tokens
                </CardTitle>
                <TrendingUpIcon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {(totalTokens / 1000).toFixed(1)}K
                </div>
                <p className="text-xs text-muted-foreground">
                  All token types
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost Over Time Chart */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
            <CardHeader>
              <CardTitle>Cost Over Time</CardTitle>
              <CardDescription>
                Daily breakdown of LLM scanning costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  Loading...
                </div>
              ) : error ? (
                <div className="h-[400px] flex items-center justify-center text-destructive">
                  {error}
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                  <DollarSignIcon className="size-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium">No scan costs yet</p>
                  <p className="text-sm">Run a scan with AI analysis to see cost data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    onMouseMove={handleChartMouseMove}
                    onMouseLeave={handleChartMouseLeave}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip
                      position={tooltipPosition ?? undefined}
                      isAnimationActive={false}
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ pointerEvents: 'none' }}
                      cursor={{ fill: 'hsl(var(--primary))', opacity: 0.08 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as { date: string; cost: number; scans: number }
                          return (
                            <div className="bg-black/90 border border-white/20 rounded-md px-3 py-2 shadow-lg text-white">
                              <p className="font-medium">{data.date}</p>
                              <p className="text-sm text-white/70">
                                ${data.cost.toFixed(3)} ({data.scans} scan{data.scans !== 1 ? 's' : ''})
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="cost" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill="hsl(var(--primary))"
                          opacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent Scans Table */}
          {scanCosts.length > 0 && (
            <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
              <CardHeader>
                <CardTitle>Recent Scans</CardTitle>
                <CardDescription>
                  Detailed breakdown of your most recent LLM-powered scans
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Files</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Input Tokens</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Output Tokens</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Cache Read</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanCosts.slice(0, 10).map((cost) => (
                        <tr key={cost.id} className="border-b border-white/10 last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4">
                            {new Date(cost.created_at).toLocaleDateString()} {new Date(cost.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {cost.files_analyzed_with_llm}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {cost.input_tokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {cost.output_tokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {cost.cache_read_tokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">
                            ${cost.total_cost_usd.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
