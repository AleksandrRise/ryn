"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileDown, Check } from "lucide-react"

export function ExportReport() {
  const [isExporting, setIsExporting] = useState(false)
  const [exported, setExported] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    console.log("[v0] Generating audit report")

    // TODO: Call Tauri backend to generate report
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setIsExporting(false)
    setExported(true)

    setTimeout(() => setExported(false), 3000)
  }

  return (
    <div className="flex items-center gap-3">
      <select
        className="px-3 py-2 text-sm rounded-lg bg-accent border border-border text-foreground"
        defaultValue="pdf"
      >
        <option value="pdf">PDF Report</option>
        <option value="json">JSON Export</option>
        <option value="csv">CSV Export</option>
      </select>

      <Button onClick={handleExport} disabled={isExporting} className="gap-2">
        {exported ? (
          <>
            <Check className="w-4 h-4" />
            Exported
          </>
        ) : (
          <>
            <FileDown className="w-4 h-4" />
            {isExporting ? "Generating..." : "Export Report"}
          </>
        )}
      </Button>
    </div>
  )
}
