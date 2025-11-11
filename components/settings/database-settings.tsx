"use client"

import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DatabaseSettings() {
  const handleClearHistory = () => {
    console.log("[v0] Clearing database history")
    // TODO: Call Tauri backend to clear history
  }

  const handleExportData = () => {
    console.log("[v0] Exporting all data")
    // TODO: Call Tauri backend to export data
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Database</h2>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-surface rounded-lg">
          <h3 className="text-sm font-medium text-foreground mb-2">Clear History</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Remove all scan history and audit events from local database
          </p>
          <Button onClick={handleClearHistory} variant="outline" size="sm">
            Clear All History
          </Button>
        </div>

        <div className="p-4 bg-surface rounded-lg">
          <h3 className="text-sm font-medium text-foreground mb-2">Export Data</h3>
          <p className="text-xs text-muted-foreground mb-3">Export all scans, violations, and audit events to JSON</p>
          <Button onClick={handleExportData} variant="outline" size="sm">
            Export All Data
          </Button>
        </div>
      </div>
    </div>
  )
}
