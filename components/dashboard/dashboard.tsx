"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "./use-dashboard-data"
import { handleTauriError, showSuccess } from "@/lib/utils/error-handler"
import { create_project, detect_framework, scan_project } from "@/lib/tauri/commands"
import { useProjectStore } from "@/lib/stores/project-store"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils/date"

function statusTone(status: string) {
  if (status === "critical") return "text-red-400 bg-red-500/10 border-red-500/20"
  if (status === "warning") return "text-amber-400 bg-amber-500/10 border-amber-500/20"
  if (status === "healthy") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  return "text-white/60 bg-white/5 border-white/10"
}

export function Dashboard() {
  const router = useRouter()
  const { selectedProject, setSelectedProject } = useProjectStore()
  const {
    isLoading,
    totalProjects,
    totalViolations,
    totalScans,
    severityCounts,
    projectHealthList,
    scanTrend,
    recentScans,
    refresh,
  } = useDashboardData()

  const [isAddingProject, setIsAddingProject] = useState(false)
  const [isStartingScan, setIsStartingScan] = useState(false)

  const isTauri = typeof window !== "undefined" && Boolean((window as { __TAURI__?: unknown }).__TAURI__)

  const healthyProjects = useMemo(
    () => projectHealthList.filter((p) => p.status === "healthy").length,
    [projectHealthList]
  )

  const criticalProjects = useMemo(
    () => projectHealthList.filter((p) => p.status === "critical").length,
    [projectHealthList]
  )

  const handleAddProject = async () => {
    if (!isTauri) {
      handleTauriError("Desktop only", "Project selection requires the Ryn desktop app")
      return
    }

    try {
      setIsAddingProject(true)
      const selected = await open({ directory: true, multiple: false, title: "Select Project Folder" })
      if (selected && typeof selected === "string") {
        const framework = await detect_framework(selected)
        const project = await create_project(selected, undefined, framework)
        setSelectedProject(project)
        showSuccess(`Project "${project.name}" added`)
        await refresh()
      }
    } catch (error) {
      handleTauriError(error, "Failed to add project")
    } finally {
      setIsAddingProject(false)
    }
  }

  const handleQuickScan = async () => {
    if (!selectedProject) {
      handleTauriError("No project selected", "Choose a project first")
      return
    }
    if (!isTauri) {
      handleTauriError("Desktop only", "Scanning requires the Ryn desktop app")
      return
    }
    try {
      setIsStartingScan(true)
      await scan_project(selectedProject.id)
      showSuccess("Scan started")
      await refresh()
      router.push("/scan")
    } catch (error) {
      handleTauriError(error, "Failed to start scan")
    } finally {
      setIsStartingScan(false)
    }
  }

  const emptyState = totalProjects === 0

  return (
    <main className="px-6 pt-14 pb-16">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Compliance Overview</h1>
            <p className="text-xs text-white/50 mt-1">
              {totalProjects} project{totalProjects === 1 ? "" : "s"} • {totalScans} scans • {totalViolations} violations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={isLoading}>
              Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={handleAddProject} disabled={isAddingProject}>
              {isAddingProject ? "Adding…" : "Add Project"}
            </Button>
            <Button size="sm" onClick={handleQuickScan} disabled={isStartingScan || !selectedProject}>
              {isStartingScan ? "Starting…" : "Start Scan"}
            </Button>
          </div>
        </div>

        {emptyState ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-3">
            <p className="text-lg font-semibold">No projects yet</p>
            <p className="text-sm text-white/60">Add a project to start scanning for SOC 2 issues.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={handleAddProject} disabled={isAddingProject}>
                {isAddingProject ? "Opening…" : "Add your first project"}
              </Button>
              <Button variant="secondary" onClick={() => router.push("/onboarding")}>Run onboarding</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats and trend */}
            <div className="grid grid-cols-12 gap-5">
              {/* Stats */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
                <StatCard
                  label="Projects"
                  value={totalProjects}
                  accent="from-blue-500/12"
                  icon="las la-layer-group"
                  helper={`${healthyProjects} healthy • ${criticalProjects} critical`}
                />
                <StatCard
                  label="Violations"
                  value={totalViolations}
                  accent="from-amber-500/12"
                  icon="las la-exclamation-triangle"
                  helper={`Critical ${severityCounts.critical} • High ${severityCounts.high}`}
                />
                <StatCard
                  label="Scans"
                  value={totalScans}
                  accent="from-emerald-500/12"
                  icon="las la-bolt"
                  helper="Latest across all projects"
                />
              </div>

              {/* Trend */}
              <div className="col-span-12 lg:col-span-8 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Scan Trend</p>
                    <p className="text-sm text-white/70">Last {scanTrend.length || 0} scans</p>
                  </div>
                </div>
                {scanTrend.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-white/50 text-sm">No scans yet</div>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={scanTrend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="violations" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#ffffff40" tickLine={false} axisLine={false} fontSize={11} />
                        <YAxis stroke="#ffffff40" tickLine={false} axisLine={false} fontSize={11} width={35} />
                        <Tooltip
                          contentStyle={{ background: "#0b0b0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                          labelStyle={{ color: "#fff" }}
                          formatter={(value) => [`${value} violations`, "Violations"]}
                        />
                        <Area type="monotone" dataKey="violations" stroke="#f59e0b" fill="url(#violations)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Projects and recent scans */}
            <div className="grid grid-cols-12 gap-5">
              {/* Projects grid */}
              <div className="col-span-12 lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Projects</h2>
                  <span className="text-xs text-white/50">{projectHealthList.length} tracked</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {projectHealthList.map((p) => {
                    const last = p.lastScanDate ? formatRelativeTime(p.lastScanDate) : "No scans yet"
                    return (
                      <button
                        key={p.project.id}
                        onClick={() => setSelectedProject(p.project)}
                        className="text-left bg-white/[0.03] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold">{p.project.name}</p>
                            <p className="text-[12px] text-white/50">{p.project.framework || p.project.path}</p>
                          </div>
                          <span className={cn("text-[11px] px-2 py-1 rounded-full border", statusTone(p.status))}>
                            {p.status === "no-scans" ? "No scans" : p.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/60">
                          <span>{p.totalViolations} issues</span>
                          <span className="text-white/30">•</span>
                          <span>Critical {p.criticalCount}</span>
                          <span className="text-white/30">•</span>
                          <span>High {p.highCount}</span>
                        </div>
                        <div className="text-[11px] text-white/40 mt-2">Last scan {last}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recent scans */}
              <div className="col-span-12 lg:col-span-5 bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Recent scans</h2>
                  <span className="text-xs text-white/50">{recentScans.length}</span>
                </div>
                <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                  {recentScans.length === 0 ? (
                    <div className="text-sm text-white/50 py-8 text-center">No scans yet</div>
                  ) : (
                    recentScans.map((scan) => {
                      const ts = formatRelativeTime(scan.completedAt || scan.startedAt)
                      const sevLabel = scan.criticalCount > 0
                        ? "critical"
                        : scan.highCount > 0
                          ? "high"
                          : scan.mediumCount > 0
                            ? "medium"
                            : "low"
                      return (
                        <div key={scan.id} className="flex items-start justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{scan.projectName}</p>
                            <p className="text-[12px] text-white/50">{scan.violationsFound} issues • {scan.scanMode}</p>
                            <p className="text-[11px] text-white/40 mt-1">{ts}</p>
                          </div>
                          <span className={cn("text-[11px] px-2 py-1 rounded-full border", statusTone(sevLabel))}>
                            {sevLabel}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  helper,
  accent,
  icon,
}: {
  label: string
  value: number | string
  helper?: string
  accent?: string
  icon?: string
}) {
  return (
    <div className={cn("flex-1 rounded-2xl p-5 border border-white/10 bg-gradient-to-br from-white/5 to-transparent", accent)}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          {icon ? <i className={`${icon} text-lg text-white`}></i> : null}
        </div>
        <span className="text-[11px] text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {helper && <div className="text-xs text-white/50 mt-2">{helper}</div>}
    </div>
  )
}
