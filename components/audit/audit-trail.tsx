"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, FileSearch, CheckCircle, AlertCircle, Play, Filter, Loader2 } from "lucide-react"
import {
  get_audit_events,
  export_data,
  type AuditEvent,
} from "@/lib/tauri/commands"
import { handleTauriError, showSuccess, showInfo } from "@/lib/error-handler"
import { save } from "@tauri-apps/plugin-dialog"
import { writeTextFile } from "@tauri-apps/plugin-fs"
import { useProjectStore } from "@/lib/store/project-store"

// Display event interface (mapped from backend AuditEvent)
interface DisplayEvent {
  id: number
  type: string
  description: string
  timestamp: string
  details: string
}

export function AuditTrail() {
  const { selectedProject } = useProjectStore()
  const [selectedType, setSelectedType] = useState<string>("all")
  const [events, setEvents] = useState<DisplayEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch audit events from backend
  useEffect(() => {
    const fetchAuditEvents = async () => {
      try {
        setIsLoading(true)

        // Fetch events, optionally filtered by selected project
        const filters = selectedProject ? { project_id: selectedProject.id } : undefined
        const auditEvents = await get_audit_events(filters)

        // Map backend AuditEvent to DisplayEvent for UI
        const displayEvents: DisplayEvent[] = auditEvents.map((event) => ({
          id: event.id,
          type: event.event_type,
          description: event.description,
          timestamp: formatTimestamp(event.created_at),
          details: event.metadata || "",
        }))

        setEvents(displayEvents)
      } catch (error) {
        handleTauriError(error, "Failed to load audit events")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAuditEvents()
  }, [selectedProject])

  // Format ISO timestamp to display format
  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).replace(/(\d+)\/(\d+)\/(\d+),/, "$3-$1-$2")
    } catch {
      return isoString
    }
  }

  const filteredEvents = selectedType === "all" ? events : events.filter(e => e.type === selectedType)

  // Calculate stats from real events
  const stats = {
    totalScans: events.filter(e => e.type === "scan_started" || e.type === "scan_completed").length,
    fixesApplied: events.filter(e => e.type === "fix_applied").length,
    violations: events.filter(e => e.type === "violation_detected").length,
    totalEvents: events.length,
  }

  // Handle export audit report
  const handleExportReport = async () => {
    try {
      showInfo("Exporting audit report...")
      const jsonData = await export_data()

      // Open save dialog
      const filePath = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `ryn-audit-report-${new Date().toISOString().split("T")[0]}.json`,
      })

      if (filePath) {
        await writeTextFile(filePath, jsonData)
        showSuccess(`Audit report exported successfully to ${filePath}`)
      }
    } catch (error) {
      handleTauriError(error, "Failed to export audit report")
    }
  }

  const getEventIcon = (type: string) => {
    // Map backend event types to icons
    if (type.includes("scan")) {
      return <FileSearch className="w-5 h-5" />
    } else if (type.includes("fix")) {
      return <CheckCircle className="w-5 h-5" />
    } else if (type.includes("violation")) {
      return <AlertCircle className="w-5 h-5" />
    } else {
      return <Play className="w-5 h-5" />
    }
  }

  const getEventColor = (type: string) => {
    // Map backend event types to colors
    if (type.includes("scan")) {
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    } else if (type.includes("fix")) {
      return "bg-green-500/20 text-green-400 border-green-500/30"
    } else if (type.includes("violation")) {
      return "bg-red-500/20 text-red-400 border-red-500/30"
    } else {
      return "bg-white/10 text-white/60 border-white/20"
    }
  }

  const getEventTypeLabel = (type: string) => {
    // Simplify event type for display
    if (type.includes("scan")) return "scan"
    if (type.includes("fix")) return "fix"
    if (type.includes("violation")) return "violation"
    return type
  }

  return (
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">Audit Trail</h1>
          <p className="text-lg text-white/60">
            {selectedProject
              ? `Compliance activity log for ${selectedProject.name}`
              : "Complete compliance activity log and event history"}
          </p>
        </div>
        <Button size="lg" variant="outline" className="gap-2" onClick={handleExportReport}>
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-6 mb-8 animate-fade-in-up delay-100">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileSearch className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/60">Total Scans</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : stats.totalScans}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/60">Fixes Applied</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : stats.fixesApplied}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/60">Violations</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : stats.violations}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/5 rounded-lg">
              <Filter className="w-5 h-5 text-white/60" />
            </div>
            <h3 className="text-sm font-semibold text-white/60">Total Events</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : stats.totalEvents}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-3 animate-fade-in-up delay-200">
        {(["all", "scan", "fix", "violation"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-all ${
              selectedType === type
                ? "bg-white/20 text-white shadow-lg"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative animate-fade-in-up delay-300">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-white/40" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white/5 rounded-full">
                <Filter className="w-8 h-8 text-white/40" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">No audit events found</h3>
                <p className="text-white/60">
                  {selectedProject
                    ? `No events have been recorded for ${selectedProject.name} yet.`
                    : selectedType === "all"
                    ? "No events have been recorded yet. Start by running a scan."
                    : `No ${selectedType} events found. Try selecting a different filter.`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Timeline Line */}
            <div className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />

            {/* Events */}
            <div className="space-y-6">
              {filteredEvents.map((event, i) => (
                <div key={event.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className={`absolute left-0 w-14 h-14 rounded-2xl border-2 ${getEventColor(event.type)} flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-300`}>
                    {getEventIcon(event.type)}
                  </div>

                  {/* Event Card */}
                  <div className="ml-20 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:bg-white/[0.07] transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${getEventColor(event.type)}`}>
                            {getEventTypeLabel(event.type)}
                          </span>
                          <span className="text-xs text-white/40 font-mono">{event.timestamp}</span>
                        </div>
                        <h3 className="text-lg font-semibold mb-1">{event.description}</h3>
                        {event.details && <p className="text-sm text-white/60">{event.details}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
