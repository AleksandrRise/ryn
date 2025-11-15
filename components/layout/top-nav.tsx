"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useProjectStore } from "@/lib/stores/project-store"
import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { Folder } from "lucide-react"
import {
  create_project,
  detect_framework,
  type Project,
} from "@/lib/tauri/commands"
import { handleTauriError, showSuccess } from "@/lib/utils/error-handler"

export function TopNav() {
  const pathname = usePathname()
  const { selectedProject, setSelectedProject } = useProjectStore()

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/scan", label: "Scan Results" },
    { href: "/audit", label: "Audit Trail" },
    { href: "/settings", label: "Settings" },
  ]

  // Get breadcrumb path based on current pathname
  const getBreadcrumbLabel = (path: string) => {
    const pathMap: Record<string, string> = {
      "/": "Dashboard",
      "/scan": "Scan Results",
      "/audit": "Audit Trail",
      "/settings": "Settings",
    }
    return pathMap[path] || "Page"
  }

  // Handle project selection
  const handleSelectProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      })

      if (selected && typeof selected === "string") {
        // Detect framework
        const framework = await detect_framework(selected)

        // Create project in database
        const project = await create_project(selected, undefined, framework)

        // Update global state
        setSelectedProject(project)

        showSuccess(`Project "${project.name}" loaded successfully`)
      }
    } catch (error) {
      handleTauriError(error, "Failed to select project")
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/10">
      <div className="flex items-center h-12 px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight hover:text-white/80 transition-colors">
            ryn
          </Link>

          {/* Navigation links */}
          <div className="flex gap-6">
            {links.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium ${
                    isActive ? "text-white" : "text-white/60 hover:text-white/90"
                  } transition-colors`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right side - breadcrumbs + project selector */}
        <div className="ml-auto flex items-center gap-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-white/40">
            {selectedProject ? (
              <>
                <Link href="/" className="hover:text-white/60 transition-colors">
                  {selectedProject.name}
                </Link>
                <span>•</span>
                <span>{getBreadcrumbLabel(pathname)}</span>
              </>
            ) : (
              <span>No project selected</span>
            )}
          </div>

          {/* Project selector button */}
          <Button
            onClick={handleSelectProject}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Folder className="w-3 h-3" />
            {selectedProject ? "Change" : "Select"}
          </Button>
        </div>
      </div>
    </nav>
  )
}
