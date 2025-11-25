"use client"

import { useState } from "react"
import { ScanSearch } from "lucide-react"

export function ScanPreferences() {
  const [settings, setSettings] = useState({
    continuousMonitoring: true,
    scanOnSave: true,
    excludedPaths: "node_modules/\n.git/\ndist/\nbuild/",
  })

  const handleToggle = (key: "continuousMonitoring" | "scanOnSave") => {
    setSettings({ ...settings, [key]: !settings[key] })
    console.log("[v0] Scan preference updated:", key)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <ScanSearch className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Scan Preferences</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
          <div>
            <h3 className="text-sm font-medium text-foreground">Continuous Monitoring</h3>
            <p className="text-xs text-muted-foreground mt-1">Watch for file changes and scan automatically</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <span className="sr-only">Toggle continuous monitoring</span>
            <input
              type="checkbox"
              checked={settings.continuousMonitoring}
              onChange={() => handleToggle("continuousMonitoring")}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
          <div>
            <h3 className="text-sm font-medium text-foreground">Scan on File Save</h3>
            <p className="text-xs text-muted-foreground mt-1">Trigger scan whenever you save a file</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <span className="sr-only">Toggle scan on save</span>
            <input
              type="checkbox"
              checked={settings.scanOnSave}
              onChange={() => handleToggle("scanOnSave")}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        <div className="p-4 bg-surface rounded-lg">
          <h3 className="text-sm font-medium text-foreground mb-2">Excluded Paths</h3>
          <p className="text-xs text-muted-foreground mb-3">Paths to exclude from scanning (one per line)</p>
          <textarea
            value={settings.excludedPaths}
            onChange={(e) => setSettings({ ...settings, excludedPaths: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-background border border-border text-foreground resize-none"
          />
        </div>
      </div>
    </div>
  )
}
