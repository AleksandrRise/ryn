import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DashboardChartType, TrendTimeRange } from '@/lib/types/chart'

interface DashboardChartStore {
  // Selected chart type per mode (separate preferences)
  localChartType: DashboardChartType
  githubChartType: DashboardChartType

  // Time range for trend charts
  trendTimeRange: TrendTimeRange

  // Actions
  setLocalChartType: (type: DashboardChartType) => void
  setGithubChartType: (type: DashboardChartType) => void
  setTrendTimeRange: (range: TrendTimeRange) => void
}

/**
 * Store for dashboard chart preferences
 *
 * Persists chart type and time range selections to localStorage
 * so users keep their preferred views across sessions
 */
export const useDashboardChartStore = create<DashboardChartStore>()(
  persist(
    (set) => ({
      // Defaults per user preference
      localChartType: "distribution-overview",
      githubChartType: "trend-over-time",
      trendTimeRange: "last-10",

      setLocalChartType: (type) => set({ localChartType: type }),
      setGithubChartType: (type) => set({ githubChartType: type }),
      setTrendTimeRange: (range) => set({ trendTimeRange: range }),
    }),
    {
      name: 'ryn-dashboard-chart-prefs',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
