"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useProjectStore } from "@/lib/stores/project-store"
import { open } from "@tauri-apps/plugin-dialog"
import { Folder, Github } from "lucide-react"
import {
  create_project,
  detect_framework,
  get_projects,
  delete_project,
  delete_all_projects,
  type Project,
} from "@/lib/tauri/commands"
import { handleTauriError, showSuccess } from "@/lib/utils/error-handler"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FrameworkBadge } from "@/components/ui/framework-badge"

export function TopNav() {
  const pathname = usePathname()
  const { selectedProject, setSelectedProject, clearProject } = useProjectStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/scan/", label: "Scan Results" },
    { href: "/audit/", label: "Audit Trail" },
    { href: "/settings/", label: "Settings" },
  ]

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true)
      const list = await get_projects()
      setProjects(list)
    } catch (error) {
      handleTauriError(error, "Failed to load projects")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const handleSelectProjectFromDisk = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      })

      if (selected && typeof selected === "string") {
        const framework = await detect_framework(selected)
        const project = await create_project(selected, undefined, framework)
        setSelectedProject(project)
        showSuccess(`Project "${project.name}" loaded successfully`)
        await loadProjects()
      }
    } catch (error) {
      handleTauriError(error, "Failed to select project")
    }
  }

  const handleProjectChange = async (value: string) => {
    if (value === "__add_new__") {
      await handleSelectProjectFromDisk()
      return
    }

    const projectId = Number(value)
    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    setSelectedProject(project)
    showSuccess(`Switched to project "${project.name}"`)
  }

  const handleDeleteProject = async (id: number, name: string) => {
    if (!confirm(`Delete project "${name}" and all related scan data? This cannot be undone.`)) {
      return
    }
    try {
      setIsDeleting(true)
      await delete_project(id)
      await loadProjects()
      if (selectedProject?.id === id) {
        clearProject()
      }
      showSuccess(`Deleted project "${name}"`)
    } catch (error) {
      handleTauriError(error, "Failed to delete project")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL projects and scan data? This cannot be undone.")) {
      return
    }
    try {
      setIsDeleting(true)
      await delete_all_projects()
      await loadProjects()
      clearProject()
      showSuccess("Deleted all projects")
    } catch (error) {
      handleTauriError(error, "Failed to delete all projects")
    } finally {
      setIsDeleting(false)
    }
  }

  const currentProjectId = selectedProject ? String(selectedProject.id) : undefined

  // Separate projects into local and GitHub repos
  const { localProjects, githubProjects } = useMemo(() => {
    const local: Project[] = []
    const github: Project[] = []
    for (const project of projects) {
      if (project.path.includes("ryn-github-cache")) {
        github.push(project)
      } else {
        local.push(project)
      }
    }
    return { localProjects: local, githubProjects: github }
  }, [projects])

  if (pathname?.startsWith("/onboarding")) {
    return null
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/10">
      <div className="flex items-center h-10 px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight hover:text-white/80 transition-colors">
            ryn
          </Link>

          <div className="flex gap-4">
            {links.map((link) => {
              // Normalize paths by removing trailing slashes for comparison
              const normalizedPathname = pathname?.replace(/\/$/, "") || ""
              const normalizedHref = link.href.replace(/\/$/, "") || ""
              const isActive = normalizedPathname === normalizedHref
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-medium ${
                    isActive ? "text-white" : "text-white/60 hover:text-white/90"
                  } transition-colors`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center">
          <Select value={currentProjectId} onValueChange={handleProjectChange}>
            <SelectTrigger
              className="!gap-2 !text-[13px] !h-9 !px-3 !min-w-[216px] !rounded-[11px] !bg-white/[0.04] !border !border-white/8 hover:!bg-white/[0.07] hover:!border-white/12 shadow-sm backdrop-blur-sm !overflow-hidden"
            >
              <Folder className="w-3 h-3" />
              <SelectValue
                className="truncate text-left"
                placeholder={
                  isLoadingProjects
                    ? "Loading projects..."
                    : selectedProject
                    ? selectedProject.name
                    : "Select project"
                }
                aria-label={selectedProject?.name || undefined}
              />
            </SelectTrigger>
            <SelectContent className="!bg-black/85 !border !border-white/10 !backdrop-blur-2xl !rounded-2xl !shadow-2xl px-1 py-1">
              {projects.length > 0 ? (
                <>
                  {/* Local Projects Section */}
                  {localProjects.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                        <Folder className="w-3 h-3" />
                        Local Projects
                      </div>
                      {localProjects.map((project) => (
                        <div key={project.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-white/5">
                          <SelectItem
                            value={String(project.id)}
                            textValue={project.name}
                            className="flex-1 rounded-lg px-0 py-0 hover:bg-transparent focus:bg-transparent"
                            label={project.name}
                            description={
                              <span className="flex items-center gap-1.5">
                                <FrameworkBadge framework={project.framework} showLabel={false} className="!bg-transparent !border-0 !p-0" />
                                <span className="truncate max-w-[180px]">{project.framework || project.path}</span>
                              </span>
                            }
                          />
                          <button
                            className="text-red-400 hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProject(project.id, project.name)
                            }}
                            disabled={isDeleting}
                            title="Delete project"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Divider between sections */}
                  {localProjects.length > 0 && githubProjects.length > 0 && <SelectSeparator />}

                  {/* GitHub Projects Section */}
                  {githubProjects.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                        <Github className="w-3 h-3" />
                        GitHub Snapshots
                      </div>
                      {githubProjects.map((project) => (
                        <div key={project.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-white/5">
                          <SelectItem
                            value={String(project.id)}
                            textValue={project.name}
                            className="flex-1 rounded-lg px-0 py-0 hover:bg-transparent focus:bg-transparent"
                            label={project.name}
                            description={
                              <span className="flex items-center gap-1.5">
                                <FrameworkBadge framework={project.framework} showLabel={false} className="!bg-transparent !border-0 !p-0" />
                                <span className="truncate max-w-[180px]">{project.framework || "GitHub"}</span>
                              </span>
                            }
                          />
                          <button
                            className="text-red-400 hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProject(project.id, project.name)
                            }}
                            disabled={isDeleting}
                            title="Delete project"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <SelectItem value="__no_projects__" label="No projects yet" disabled />
              )}
              <SelectSeparator />
              <SelectItem
                value="__add_new__"
                label="Add new project…"
                className="rounded-lg px-3 py-2 hover:bg-white/5 focus:bg-white/8"
              />
              {projects.length > 0 && (
                <div className="px-3 py-2">
                  <button
                    className="text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full rounded-md px-3 py-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAll()
                    }}
                    disabled={isDeleting}
                  >
                    Delete all projects
                  </button>
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </nav>
  )
}
