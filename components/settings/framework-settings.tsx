"use client"

import { Code2 } from "lucide-react"

export function FrameworkSettings() {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Code2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Framework Detection</h2>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-surface rounded-lg">
          <h3 className="text-sm font-medium text-foreground mb-2">Override Framework</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Manually specify framework if auto-detection is incorrect
          </p>
          <select
            className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground"
            defaultValue="auto"
          >
            <option value="auto">Auto-detect</option>
            <option value="django">Django</option>
            <option value="flask">Flask</option>
            <option value="express">Express.js</option>
            <option value="fastapi">FastAPI</option>
            <option value="rails">Ruby on Rails</option>
            <option value="spring">Spring Boot</option>
          </select>
        </div>
      </div>
    </div>
  )
}
