"use client"

import { Folder, Play, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { open } from "@tauri-apps/plugin-dialog"
import { create_project, detect_framework } from "@/lib/tauri/commands"
import { useProjectStore } from "@/lib/stores/project-store"
import { handleTauriError, showSuccess } from "@/lib/utils/error-handler"
import { useMemo } from "react"
import { FrameworkBadge } from "@/components/ui/framework-badge"

export function Header() {
  const router = useRouter()
  const { selectedProject, setSelectedProject } = useProjectStore()
  const isScanning = useMemo(() => false, [])

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

  const handleScanNow = () => {
    if (!selectedProject) {
      handleTauriError("No project selected", "Please select a project first")
      return
    }

    // Navigate to scan page
    router.push("/scan")
  }

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Project Info */}
        <button
          onClick={handleSelectProject}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
        >
          <Folder className="w-4 h-4 text-muted-foreground" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium text-foreground">
              {selectedProject?.name || "Select Project"}
            </span>
            <span className="text-xs text-muted-foreground">
              {selectedProject?.path || "No project selected"}
            </span>
          </div>
        </button>

        {/* Framework Badge */}
        {selectedProject?.framework && (
          <FrameworkBadge framework={selectedProject.framework} />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <Circle className={`w-2 h-2 fill-current ${isScanning ? "text-warning animate-pulse" : "text-success"}`} />
          <span className="text-sm text-muted-foreground">{isScanning ? "Scanning..." : "Ready"}</span>
        </div>

        {/* Scan Button */}
        <Button onClick={handleScanNow} disabled={isScanning} className="gap-2">
          <Play className="w-4 h-4" />
          Scan Now
        </Button>
      </div>
    </header>
  )
}
