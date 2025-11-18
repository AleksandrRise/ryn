import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Project } from '@/lib/tauri/commands'

interface ProjectStore {
  selectedProject: Project | null
  setSelectedProject: (project: Project) => void
  clearProject: () => void
}

/**
 * Validates that a project has all required fields
 */
function isValidProject(project: any): project is Project {
  if (!project || typeof project !== 'object') {
    return false
  }

  // Check required fields exist and are the right type
  const hasId = typeof project.id === 'number' && project.id > 0
  const hasPath = typeof project.path === 'string' && project.path.length > 0
  const hasName = typeof project.name === 'string' && project.name.length > 0

  return hasId && hasPath && hasName
}

/**
 * Global project state store using Zustand
 *
 * Persists selected project to localStorage for app restarts
 * Used across all components that need access to the current project
 *
 * Automatically validates and clears invalid projects on startup
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
      onRehydrateStorage: () => (state) => {
        // Validate loaded project and clear if invalid
        if (state?.selectedProject) {
          const isValid = isValidProject(state.selectedProject)

          if (!isValid) {
            console.warn(
              '[project-store] Invalid project in localStorage, clearing:',
              state.selectedProject
            )
            state.clearProject()
          } else {
            console.log('[project-store] Loaded valid project:', state.selectedProject.id)
          }
        }
      },
    }
  )
)
