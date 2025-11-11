"use client"

import { Button } from "@/components/ui/button"
import { FileDown, ScanSearch, Settings } from "lucide-react"

export function QuickActions() {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Quick Actions</h3>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2 bg-transparent">
          <ScanSearch className="w-4 h-4" />
          Run Full Scan
        </Button>

        <Button variant="outline" className="gap-2 bg-transparent">
          <FileDown className="w-4 h-4" />
          Export Audit Report
        </Button>

        <Button variant="outline" className="gap-2 bg-transparent">
          <Settings className="w-4 h-4" />
          Configure Trust Levels
        </Button>
      </div>
    </div>
  )
}
