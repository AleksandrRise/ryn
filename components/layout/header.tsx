"use client"

import { Folder, Play, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header() {
  // Mock project state - will be connected to Tauri backend
  const projectName = "my-startup-app"
  const projectPath = "/Users/dev/projects/my-startup-app"
  const framework = "Django"
  const isScanning = false

  const handleSelectProject = () => {
    // TODO: Connect to Tauri file picker
    console.log("[v0] Select project clicked")
  }

  const handleScanNow = () => {
    // TODO: Connect to Tauri scan_project command
    console.log("[v0] Scan now clicked")
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
            <span className="text-sm font-medium text-foreground">{projectName}</span>
            <span className="text-xs text-muted-foreground">{projectPath}</span>
          </div>
        </button>

        {/* Framework Badge */}
        <div className="px-3 py-1 rounded-full bg-primary-bg border border-primary/20">
          <span className="text-xs font-medium text-primary">{framework}</span>
        </div>
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
