import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Project } from '@/lib/tauri/commands'

interface ProjectStore {
  selectedProject: Project | null
  setSelectedProject: (project: Project) => void
  clearProject: () => void
}

/**
 * Global project state store using Zustand
 *
 * Persists selected project to localStorage for app restarts
 * Used across all components that need access to the current project
 */
export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      selectedProject: null,
      setSelectedProject: (project) => set({ selectedProject: project }),
      clearProject: () => set({ selectedProject: null }),
    }),
    {
      name: 'ryn-project-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
