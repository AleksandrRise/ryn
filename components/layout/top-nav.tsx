"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useProjectStore } from "@/lib/stores/project-store"
import { open } from "@tauri-apps/plugin-dialog"
import { Folder } from "lucide-react"
import {
  create_project,
  detect_framework,
  get_projects,
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
  const { selectedProject, setSelectedProject } = useProjectStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/scan", label: "Scan Results" },
    { href: "/audit", label: "Audit Trail" },
    { href: "/settings", label: "Settings" },
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

  const currentProjectId = selectedProject ? String(selectedProject.id) : undefined

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
              const isActive = pathname === link.href
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
              className="!gap-2 !text-[13px] !h-9 !px-3 !min-w-[216px] !rounded-[11px] !bg-white/[0.04] !border !border-white/8 hover:!bg-white/[0.07] hover:!border-white/12 shadow-sm backdrop-blur-sm"
            >
              <Folder className="w-3 h-3" />
              <SelectValue
                placeholder={
                  isLoadingProjects
                    ? "Loading projects..."
                    : selectedProject
                    ? selectedProject.name
                    : "Select project"
                }
              />
            </SelectTrigger>
            <SelectContent className="!bg-black/85 !border !border-white/10 !backdrop-blur-2xl !rounded-2xl !shadow-2xl px-1 py-1">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)} className="rounded-lg px-3 py-2 hover:bg-white/5 focus:bg-white/8">
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium">{project.name}</span>
                      <span className="flex items-center gap-1.5">
                        <FrameworkBadge framework={project.framework} showLabel={false} className="!bg-transparent !border-0 !p-0" />
                        <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                          {project.framework || project.path}
                        </span>
                      </span>
                    </span>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__no_projects__" disabled>
                  No projects yet
                </SelectItem>
              )}
              <SelectSeparator />
              <SelectItem value="__add_new__" className="rounded-lg px-3 py-2 hover:bg-white/5 focus:bg-white/8">
                <span className="flex items-center gap-2 text-sm">
                  <Folder className="w-3 h-3" />
                  <span>Add new project…</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </nav>
  )
}
