"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, FileSearch, CheckCircle, AlertCircle, Play, Filter } from "lucide-react"

export function AuditTrail() {
  const [selectedType, setSelectedType] = useState<string>("all")
  const events = [
    {
      id: 1,
      type: "scan",
      description: "Completed full project scan",
      timestamp: "2024-01-15 14:23:45",
      details: "247 files scanned, 28 violations detected",
    },
    {
      id: 2,
      type: "fix",
      description: "Applied fix to config/settings.py",
      timestamp: "2024-01-15 14:08:12",
      details: "Moved hardcoded API key to environment variable",
    },
    {
      id: 3,
      type: "violation",
      description: "Critical violation detected in auth/views.py",
      timestamp: "2024-01-15 13:45:33",
      details: "Missing authentication decorator on admin endpoint",
    },
    {
      id: 4,
      type: "scan",
      description: "Started monitoring session",
      timestamp: "2024-01-15 11:12:00",
      details: "Continuous monitoring enabled for project",
    },
  ]

  const filteredEvents = selectedType === "all" ? events : events.filter(e => e.type === selectedType)

  const getEventIcon = (type: string) => {
    switch (type) {
      case "scan":
        return <FileSearch className="w-5 h-5" />
      case "fix":
        return <CheckCircle className="w-5 h-5" />
      case "violation":
        return <AlertCircle className="w-5 h-5" />
      default:
        return <Play className="w-5 h-5" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case "scan":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "fix":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "violation":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-white/10 text-white/60 border-white/20"
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">Audit Trail</h1>
          <p className="text-lg text-white/60">Complete compliance activity log and event history</p>
        </div>
        <Button size="lg" variant="outline" className="gap-2">
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
          <p className="text-3xl font-bold tabular-nums">12</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/60">Fixes Applied</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums">8</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/60">Violations</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums">28</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/5 rounded-lg">
              <Filter className="w-5 h-5 text-white/60" />
            </div>
            <h3 className="text-sm font-semibold text-white/60">Total Events</h3>
          </div>
          <p className="text-3xl font-bold tabular-nums">{events.length}</p>
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
                        {event.type}
                      </span>
                      <span className="text-xs text-white/40 font-mono">{event.timestamp}</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{event.description}</h3>
                    <p className="text-sm text-white/60">{event.details}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
