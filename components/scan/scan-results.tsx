"use client"

import { useState } from "react"
import Link from "next/link"
import type { Severity } from "@/lib/types/violation"
import { open } from "@tauri-apps/plugin-dialog"

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
    <div className="px-8 py-12">
      <div className="mb-12 animate-fade-in-up">
        <h1 className="text-[48px] font-bold leading-none tracking-tighter mb-3">Scan Configuration</h1>
        <p className="text-[14px] text-[#f0f0f0]">Configure and run compliance scans</p>
      </div>

      {/* Scan Configuration Panel */}
      <div className="mb-16 p-8 border border-[#1a1a1a] bg-[#050505] animate-fade-in-up delay-200">
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Left: Project Selection */}
          <div>
            <h3 className="text-[13px] uppercase tracking-wider text-[#f0f0f0] mb-4">Project Location</h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-2 text-[13px] font-mono focus:outline-none focus:border-white"
                placeholder="/path/to/project"
              />
              <button
                onClick={handleSelectFolder}
                className="px-6 py-2 bg-[#0a0a0a] border border-[#1a1a1a] text-[13px] hover:bg-[#111] transition-colors"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Right: SOC 2 Controls */}
          <div>
            <h3 className="text-[13px] uppercase tracking-wider text-[#f0f0f0] mb-4">SOC 2 Controls</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(selectedControls).map(([control, checked]) => (
                <button
                  key={control}
                  onClick={() => toggleControl(control)}
                  className={`px-4 py-3 text-left transition-all border ${
                    checked
                      ? "bg-[#b3b3b3] text-black border-[#b3b3b3]"
                      : "bg-[#0a0a0a] text-[#666] border-[#1a1a1a] hover:border-[#333]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-medium tracking-wide">{control}</p>
                    <span className={`text-[10px] font-bold tracking-widest ${
                      checked ? "text-black" : "text-[#333]"
                    }`}>
                      {checked ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className={`text-[11px] ${checked ? "opacity-70" : "opacity-50"}`}>
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

        {/* Start Scan Button */}
        <button
          onClick={handleStartScan}
          disabled={isScanning}
          className="px-8 py-3 bg-[#b3b3b3] text-black text-[13px] font-medium hover:bg-[#999] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? "Scanning..." : "Start Scan"}
        </button>
      </div>

      {/* Scan Progress Indicator */}
      {isScanning && (
        <div className="mb-12 p-8 border border-[#1a1a1a] bg-[#050505]">
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-[13px] uppercase tracking-wider text-[#f0f0f0]">Scanning...</h3>
              <span className="text-[24px] font-bold tabular-nums">{scanProgress.percentage}%</span>
            </div>
            <div className="h-1 bg-[#1a1a1a] overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${scanProgress.percentage}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[12px] text-[#f0f0f0]">
            <span className="font-mono">{scanProgress.currentFile || "Initializing scan..."}</span>
            <span>
              {scanProgress.filesScanned} / {scanProgress.totalFiles} files
            </span>
          </div>
        </div>
      )}

      {/* Scan Results */}
      <div className="mb-12 animate-fade-in-up delay-400">
        <h2 className="text-[36px] font-bold leading-none tracking-tighter mb-3">Scan Results</h2>
        <div className="flex gap-4 text-[13px] text-[#fafafa]">
          <span>Completed 2 minutes ago</span>
          <span>•</span>
          <span>247 files scanned</span>
          <span>•</span>
          <span>28 violations found</span>
        </div>
      </div>

      <div className="flex gap-6 mb-8 text-[13px] border-b border-[#1a1a1a] animate-fade-in-up delay-500">
        {(["all", "critical", "high", "medium", "low"] as const).map((severity) => (
          <button
            key={severity}
            onClick={() => setSelectedSeverity(severity as Severity | "all")}
            className={`uppercase tracking-wider pb-3 transition-all ${
              selectedSeverity === severity
                ? "text-white border-b-2 border-white"
                : "text-[#f5f5f5] hover:text-[#fafafa] border-b-2 border-transparent"
            }`}
          >
            {severity}
          </button>
        ))}
      </div>

      <table className="w-full animate-fade-in-up delay-600">
        <thead>
          <tr>
            <th className="w-24">Severity</th>
            <th className="w-24">Control</th>
            <th>Description</th>
            <th className="w-80">Location</th>
            <th className="w-32"></th>
          </tr>
        </thead>
        <tbody>
          {filteredViolations.map((violation) => (
            <tr key={violation.id} className="group hover:bg-[#0a0a0a]">
              <td>
                <span
                  className={`text-[13px] uppercase tracking-wider font-medium ${getSeverityColor(violation.severity)}`}
                >
                  {violation.severity}
                </span>
              </td>
              <td className="text-[13px] text-[#f0f0f0]">{violation.control}</td>
              <td className="text-[14px]">{violation.description}</td>
              <td className="text-[12px] text-[#f0f0f0] font-mono">
                {violation.file}:{violation.line}
              </td>
              <td className="text-right">
                <Link href={`/violation/${violation.id}`} className="text-[12px] text-white hover:underline">
                  View details →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
