"use client"

import { Clock, FileSearch, AlertTriangle } from "lucide-react"

export function ScanMetadata() {
  // Mock data
  const metadata = {
    timestamp: "2025-01-10 14:32:15",
    filesScanned: 147,
    duration: "2.3s",
    violationsFound: 18,
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="grid grid-cols-4 gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Scan Time</p>
            <p className="text-sm font-medium text-foreground">{metadata.timestamp}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Files Scanned</p>
            <p className="text-sm font-medium text-foreground">{metadata.filesScanned}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm font-medium text-foreground">{metadata.duration}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-danger-bg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-danger" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Violations Found</p>
            <p className="text-sm font-medium text-foreground">{metadata.violationsFound}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
