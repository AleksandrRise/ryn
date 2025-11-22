"use client"

import type { Severity } from "@/lib/types/violation"

interface ViolationFiltersProps {
  selectedSeverity: Severity | "all"
  selectedControl: string
  onSeverityChange: (severity: Severity | "all") => void
  onControlChange: (control: string) => void
}

export function ViolationFilters({
  selectedSeverity,
  selectedControl,
  onSeverityChange,
  onControlChange,
}: ViolationFiltersProps) {
  const severities: (Severity | "all")[] = ["all", "critical", "high", "medium", "low"]
  const controls = ["all", "CC6.1", "CC6.7", "CC7.2", "CC8.1"]

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Severity:</span>
        <div className="flex gap-2">
          {severities.map((severity) => (
            <button
              key={severity}
              onClick={() => onSeverityChange(severity)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedSeverity === severity
                  ? "bg-primary text-white"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="control-filter">Control:</label>
        <select
          id="control-filter"
          value={selectedControl}
          onChange={(e) => onControlChange(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-accent border border-border text-foreground"
        >
          {controls.map((control) => (
            <option key={control} value={control}>
              {control === "all" ? "All Controls" : control}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
