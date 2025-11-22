import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Project } from '@/lib/tauri/commands'
import { get_projects } from '@/lib/tauri/commands'

interface ProjectStore {
  selectedProject: Project | null
  setSelectedProject: (project: Project) => void
  clearProject: () => void
}

/**
 * Validates that a project has all required fields
 */
function isValidProject(project: unknown): project is Project {
  if (!project || typeof project !== 'object') {
    return false
  }

  // Check required fields exist and are the right type
  const p = project as Partial<Project>
  const hasId = typeof p.id === 'number' && p.id > 0
  const hasPath = typeof p.path === 'string' && p.path.length > 0
  const hasName = typeof p.name === 'string' && p.name.length > 0

  return hasId && hasPath && hasName
}

/**
 * Verifies that a project exists in the database
 */
async function projectExistsInDatabase(projectId: number): Promise<boolean> {
  try {
    const projects = await get_projects()
    return projects.some(p => p.id === projectId)
  } catch (error) {
    console.error('[project-store] Failed to verify project in database:', error)
    return false
  }
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
      onRehydrateStorage: () => async (state) => {
        // Validate loaded project and clear if invalid
        if (state?.selectedProject) {
          const isValid = isValidProject(state.selectedProject)

          if (!isValid) {
            console.warn(
              '[project-store] Invalid project structure in localStorage, clearing:',
              state.selectedProject
            )
            state.clearProject()
            return
          }

          // Verify project exists in database
          const exists = await projectExistsInDatabase(state.selectedProject.id)
          if (!exists) {
            console.warn(
              `[project-store] Project ${state.selectedProject.id} not found in database, clearing from localStorage`
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
