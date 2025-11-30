import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type DetailLevel = 'minimal' | 'summary' | 'detailed'

interface ScanHistoryStore {
  // Panel expanded state
  isExpanded: boolean
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void

  // Detail level preference (persisted)
  detailLevel: DetailLevel
  setDetailLevel: (level: DetailLevel) => void

  // Selected historical scan (null = viewing latest)
  selectedScanId: number | null
  setSelectedScanId: (id: number | null) => void
}

/**
 * Store for scan history panel preferences
 *
 * Persists detail level to localStorage so users
 * keep their preferred view across sessions
 */
export const useScanHistoryStore = create<ScanHistoryStore>()(
  persist(
    (set) => ({
      isExpanded: false,
      toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setExpanded: (expanded) => set({ isExpanded: expanded }),

      detailLevel: 'summary',
      setDetailLevel: (level) => set({ detailLevel: level }),

      selectedScanId: null,
      setSelectedScanId: (id) => set({ selectedScanId: id }),
    }),
    {
      name: 'ryn-scan-history-prefs',
      storage: createJSONStorage(() => localStorage),
      // Only persist detailLevel, not transient UI state
      partialize: (state) => ({ detailLevel: state.detailLevel }),
    }
  )
)
