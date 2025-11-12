"use client"

import { useState } from "react"
import Link from "next/link"
import type { Severity } from "@/lib/types/violation"
import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { Play, Folder, Check, FileSearch, AlertCircle, Shield } from "lucide-react"

export function ScanResults() {
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all")
  const [projectPath, setProjectPath] = useState("/path/to/project")
  const [selectedControls, setSelectedControls] = useState({
    "CC6.1": true,
    "CC6.7": true,
    "CC7.2": true,
    "A1.2": true,
  })
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({
    percentage: 0,
    currentFile: "",
    filesScanned: 0,
    totalFiles: 0,
  })

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      })

      if (selected && typeof selected === "string") {
        setProjectPath(selected)
        console.log("Selected folder:", selected)
      }
    } catch (error) {
      console.error("Error opening folder dialog:", error)
    }
  }

  const handleStartScan = () => {
    setIsScanning(true)
    // Placeholder - will connect to backend scan command
    console.log("Starting scan with controls:", selectedControls)
  }

  const toggleControl = (control: string) => {
    setSelectedControls(prev => ({
      ...prev,
      [control]: !prev[control as keyof typeof prev]
    }))
  }

  const violations = [
    {
      id: 1,
      severity: "critical",
      control: "CC6.7",
      description: "Hardcoded API key in settings.py",
      file: "config/settings.py",
      line: 47,
      hasFixAvailable: true,
    },
    {
      id: 2,
      severity: "critical",
      control: "CC6.1",
      description: "Missing authentication decorator on admin endpoint",
      file: "api/admin/views.py",
      line: 23,
      hasFixAvailable: true,
    },
    {
      id: 3,
      severity: "critical",
      control: "CC7.2",
      description: "No audit logging for database mutations",
      file: "models/user.py",
      line: 89,
      hasFixAvailable: false,
    },
    {
      id: 4,
      severity: "high",
      control: "CC6.7",
      description: "Database password stored in plaintext",
      file: ".env",
      line: 12,
      hasFixAvailable: true,
    },
    {
      id: 5,
      severity: "high",
      control: "CC6.1",
      description: "Weak password policy implementation",
      file: "auth/validators.py",
      line: 34,
      hasFixAvailable: true,
    },
  ]

  const filteredViolations =
    selectedSeverity === "all" ? violations : violations.filter((v) => v.severity === selectedSeverity)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-[#ef4444]"
      case "high":
        return "text-[#f97316]"
      case "medium":
        return "text-[#eab308]"
      case "low":
        return "text-[#e8e8e8]"
      default:
        return "text-white"
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1800px] mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">Scan Results</h1>
        <p className="text-lg text-white/60">Configure, run, and review compliance scans</p>
      </div>

      {/* Scan Configuration Panel */}
      <div className="mb-8 grid grid-cols-12 gap-6 animate-fade-in-up delay-100">
        {/* Left: Project & Controls - 8 cols */}
        <div className="col-span-8 space-y-6">
          {/* Project Location */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/5 rounded-lg">
                <Folder className="w-5 h-5 text-white/60" />
              </div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Project Location</h3>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-white/30 transition-colors"
                placeholder="/path/to/project"
              />
              <Button onClick={handleSelectFolder} variant="outline" size="lg" className="gap-2">
                <Folder className="w-4 h-4" />
                Browse
              </Button>
            </div>
          </div>

          {/* SOC 2 Controls */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/5 rounded-lg">
                <Shield className="w-5 h-5 text-white/60" />
              </div>
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">SOC 2 Controls</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(selectedControls).map(([control, checked]) => (
                <button
                  key={control}
                  onClick={() => toggleControl(control)}
                  className={`relative overflow-hidden rounded-xl px-5 py-4 text-left transition-all duration-300 border-2 ${
                    checked
                      ? "bg-white/20 text-white border-white/30 shadow-lg"
                      : "bg-black/40 text-white/60 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold tracking-wide">{control}</p>
                    {checked && <Check className="w-4 h-4" />}
                  </div>
                  <p className={`text-xs ${checked ? "text-white/70" : "text-white/40"}`}>
                    {control === "CC6.1" && "Access Controls"}
                    {control === "CC6.7" && "Encryption & Secrets"}
                    {control === "CC7.2" && "Logging & Monitoring"}
                    {control === "A1.2" && "Data Availability"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Quick Stats & Actions - 4 cols */}
        <div className="col-span-4 space-y-6">
          {/* Quick Stats */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">Last Scan</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-white/40 mb-1">Completed</p>
                <p className="text-lg font-bold">2 minutes ago</p>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-1">Files Scanned</p>
                <p className="text-lg font-bold tabular-nums">247</p>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-1">Violations Found</p>
                <p className="text-lg font-bold tabular-nums">28</p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleStartScan}
            disabled={isScanning}
            size="lg"
            className="w-full gap-2 h-14"
          >
            <Play className="w-5 h-5" />
            {isScanning ? "Scanning..." : "Start New Scan"}
          </Button>
        </div>
      </div>

      {/* Scan Progress Indicator */}
      {isScanning && (
        <div className="mb-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 animate-fade-in-up delay-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-500/20 rounded-xl animate-pulse">
              <FileSearch className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Scanning in progress...</h3>
              <p className="text-sm text-white/60 font-mono truncate">{scanProgress.currentFile || "Initializing scan..."}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">{scanProgress.percentage}%</div>
              <p className="text-xs text-white/40">{scanProgress.filesScanned} / {scanProgress.totalFiles} files</p>
            </div>
          </div>
          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="mb-6 animate-fade-in-up delay-300">
        <h2 className="text-3xl font-bold leading-none tracking-tight mb-2">Violations</h2>
        <p className="text-white/60">{filteredViolations.length} violations found</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-3 animate-fade-in-up delay-400">
        {(["all", "critical", "high", "medium", "low"] as const).map((severity) => {
          const count = severity === "all" ? violations.length : violations.filter(v => v.severity === severity).length
          return (
            <button
              key={severity}
              onClick={() => setSelectedSeverity(severity as Severity | "all")}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-all ${
                selectedSeverity === severity
                  ? "bg-white/20 text-white shadow-lg"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              {severity} <span className="ml-2 opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Violations Table */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden animate-fade-in-up delay-500">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Severity</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Control</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Description</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Location</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredViolations.map((violation, i) => (
                <tr key={violation.id} className="group border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      violation.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      violation.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      violation.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-white/10 text-white/60'
                    }`}>
                      {violation.severity === 'critical' && <AlertCircle className="w-3 h-3" />}
                      {violation.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/5 text-xs font-mono font-medium">
                      {violation.control}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-white/90">{violation.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-white/60 font-mono">
                      {violation.file}
                      <span className="text-white/40">:{violation.line}</span>
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/violation/${violation.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors"
                    >
                      View details
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
