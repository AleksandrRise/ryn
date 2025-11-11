"use client"

interface AuditFiltersProps {
  selectedEventType: string
  dateRange: { start: string; end: string }
  onEventTypeChange: (type: string) => void
  onDateRangeChange: (range: { start: string; end: string }) => void
}

export function AuditFilters({
  selectedEventType,
  dateRange,
  onEventTypeChange,
  onDateRangeChange,
}: AuditFiltersProps) {
  const eventTypes = [
    { value: "all", label: "All Events" },
    { value: "scan", label: "Scans" },
    { value: "violation", label: "Violations" },
    { value: "fix", label: "Fixes Applied" },
  ]

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Event Type:</label>
          <select
            value={selectedEventType}
            onChange={(e) => onEventTypeChange(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-accent border border-border text-foreground"
          >
            {eventTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Date Range:</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
            className="px-3 py-1.5 text-sm rounded-lg bg-accent border border-border text-foreground"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="px-3 py-1.5 text-sm rounded-lg bg-accent border border-border text-foreground"
          />
        </div>
      </div>
    </div>
  )
}
