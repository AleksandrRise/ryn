"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { toast } from "sonner"
import { GitHubOAuthModal } from "@/components/dashboard/github-oauth-modal"
import { GitHubRepoManager } from "@/components/dashboard/github-repo-manager"

// Mock data types for now - will be replaced with Supabase types
interface TrackedRepo {
  id: number
  name: string
  full_name: string
  language: string | null
  default_branch: string
  last_scanned_at: string | null
  total_violations: number
  critical_violations: number
  last_scan_status: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepo[]>([])
  const [repoFilter, setRepoFilter] = useState<"all" | "critical" | "healthy">("all")
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [oauthModalOpen, setOauthModalOpen] = useState(false)
  const [repoManagerOpen, setRepoManagerOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/signin")
        return
      }
      setUser({ id: user.id, email: user.email || "" })

      // Check GitHub connection
      const { data: connection } = await supabase
        .from("github_connections")
        .select("*")
        .eq("user_id", user.id)
        .single()

      setIsGitHubConnected(!!connection)
      setLoading(false)
    }
    getUser()
  }, [supabase.auth, router])

  const handleConnectGitHub = useCallback(() => {
    if (isGitHubConnected) {
      setRepoManagerOpen(true)
    } else {
      setOauthModalOpen(true)
    }
  }, [isGitHubConnected])

  const handleOAuthSuccess = () => {
    setOauthModalOpen(false)
    setRepoManagerOpen(true)
    setIsGitHubConnected(true)
  }

  const handleRepoManagerSuccess = () => {
    setRepoManagerOpen(false)
    toast.success("Repositories updated")
  }

  const handleDisconnect = async () => {
    try {
      if (!user) return
      await supabase
        .from("github_connections")
        .delete()
        .eq("user_id", user.id)

      setIsGitHubConnected(false)
      setTrackedRepos([])
      toast.success("GitHub disconnected")
    } catch (error) {
      toast.error("Failed to disconnect GitHub")
    }
  }

  if (loading) {
    return (
      <main className="px-6 pt-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <i className="las la-circle-notch animate-spin text-2xl text-white/40"></i>
          </div>
        </div>
      </main>
    )
  }

  const scannedRepos = trackedRepos.filter(r => !!r.last_scanned_at)
  const filteredTrackedRepos = trackedRepos.filter((repo) => {
    const hasScan = !!repo.last_scanned_at
    const violations = repo.total_violations ?? 0
    const critical = repo.critical_violations ?? 0
    if (repoFilter === "critical") return hasScan && critical > 0
    if (repoFilter === "healthy") return hasScan && violations === 0
    return true
  })

  const totalViolations = scannedRepos.reduce((sum, r) => sum + (r.total_violations ?? 0), 0)
  const criticalCount = scannedRepos.reduce((sum, r) => sum + (r.critical_violations ?? 0), 0)
  const healthyCount = scannedRepos.filter(r => (r.total_violations ?? 0) === 0).length
  const hasScanData = scannedRepos.length > 0

  const rawChartData = scannedRepos.map(repo => ({
    name: repo.name,
    violations: repo.total_violations ?? 0,
    critical: repo.critical_violations ?? 0,
  }))

  const chartData = rawChartData.length === 1
    ? [{ name: "Baseline", violations: 0, critical: 0 }, ...rawChartData]
    : rawChartData

  return (
    <main className="px-6 pt-8 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 animate-fade-in-up">
          <div className="flex items-center gap-5">
            <div className="relative">
              <button
                onClick={handleConnectGitHub}
                className="flex items-center gap-3 pl-3 pr-4 py-2.5 bg-white/[0.07] hover:bg-white/[0.12] rounded-xl transition-all border border-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                  <i className="lab la-github text-lg"></i>
                </div>
                <span className="text-sm font-medium">GitHub</span>
                <i className="las la-angle-down text-xs text-white/40 ml-1"></i>
              </button>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div>
              <h1 className="text-xl font-semibold tracking-tight">Compliance Overview</h1>
              <p className="text-xs text-white/40 mt-0.5">
                {isGitHubConnected ? `${trackedRepos.length} repositories monitored` : "Connect to start monitoring"}
              </p>
            </div>
          </div>
        </div>

        {/* Top Section: Stats + Chart side by side */}
        <div className="grid grid-cols-12 gap-5 mb-5 animate-fade-in-up delay-100">
          {/* Stats Column - Vertical stack */}
          <div className="col-span-3 flex flex-col gap-3">
            {/* Repositories */}
            <div className="flex-1 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-blue-500/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <i className="las la-layer-group text-lg text-blue-400"></i>
                </div>
                <span className="text-xs text-white/30 uppercase tracking-wider">Repos</span>
              </div>
              <div className="text-3xl font-bold">{trackedRepos.length}</div>
            </div>

            {/* Violations */}
            <div className="flex-1 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-amber-500/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <i className="las la-exclamation-triangle text-lg text-amber-400"></i>
                </div>
                <span className="text-xs text-white/30 uppercase tracking-wider">Violations</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{hasScanData ? totalViolations : "—"}</span>
                {!hasScanData && <span className="text-xs text-white/40">Awaiting scans</span>}
              </div>
            </div>

            {/* Critical */}
            <div className="flex-1 bg-gradient-to-br from-red-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-red-500/20 transition-colors relative">
              {isGitHubConnected && criticalCount > 0 && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <i className="las la-radiation text-lg text-red-400"></i>
                </div>
                <span className="text-xs text-white/30 uppercase tracking-wider">Critical</span>
              </div>
              <div className="text-3xl font-bold">{hasScanData ? criticalCount : "—"}</div>
            </div>

            {/* Healthy */}
            <div className="flex-1 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent rounded-2xl p-5 border border-white/[0.04] hover:border-emerald-500/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <i className="las la-shield-alt text-lg text-emerald-400"></i>
                </div>
                <span className="text-xs text-white/30 uppercase tracking-wider">Healthy</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{hasScanData ? healthyCount : "—"}</span>
                {isGitHubConnected && hasScanData && <span className="text-xs text-white/30">/{trackedRepos.length}</span>}
              </div>
            </div>
          </div>

          {/* Chart - Large - With connection CTA when not connected */}
          <div
            className={`col-span-9 relative rounded-2xl overflow-hidden transition-all duration-300 border ${
              !isGitHubConnected
                ? "bg-gradient-to-br from-emerald-400/[0.12] via-emerald-500/[0.04] to-transparent border-emerald-500/10 hover:border-emerald-500/25 cursor-pointer group/card"
                : "bg-[#08080c]/80 border-white/[0.05]"
            }`}
            onClick={!isGitHubConnected ? handleConnectGitHub : undefined}
            role={!isGitHubConnected ? "button" : undefined}
            tabIndex={!isGitHubConnected ? 0 : undefined}
          >
            {/* Shimmer animation background when not connected */}
            {!isGitHubConnected && (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/[0.08] to-transparent shimmer-bg" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/[0.1] rounded-full blur-[100px] pointer-events-none transition-all duration-500 group-hover/card:bg-emerald-400/[0.15]" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/[0.06] rounded-full blur-[80px] pointer-events-none" />
              </>
            )}

            {/* Background for connected state */}
            {isGitHubConnected && (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] via-transparent to-blue-500/[0.02]" />
                <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/[0.04] rounded-full blur-[60px] pointer-events-none" />
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />
              </>
            )}

            <div className="relative p-6 h-full">
              {isGitHubConnected && (
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-semibold">Weekly Trend</h2>
                    <p className="text-xs text-white/40 mt-0.5">Violations over time</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-5 text-xs text-white/50">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span>Found</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Fixed</span>
                    </div>
                  </div>
                </div>
              )}

              {isGitHubConnected ? (
                <div className="animate-fadeIn">
                  <div className="h-56">
                    {chartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-white/50">
                        Scan a repo to see live findings
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                          <defs>
                            <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(248,113,113)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="rgb(248,113,113)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(251,191,36)" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="rgb(251,191,36)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "rgba(13,13,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                          />
                          <Area type="monotone" dataKey="violations" stroke="rgb(248,113,113)" strokeWidth={2.5} fill="url(#violGrad)" name="Violations" />
                          <Area type="monotone" dataKey="critical" stroke="rgb(251,191,36)" strokeWidth={2.5} fill="url(#critGrad)" name="Critical" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white/90">{chartData.reduce((sum, d) => sum + d.violations, 0)}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Total Found</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-amber-300">{chartData.reduce((sum, d) => sum + d.critical, 0)}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Critical</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white/90">{healthyCount}/{trackedRepos.length}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Clean Repos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-emerald-400">{trackedRepos.filter(r => !!r.last_scanned_at).length}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Scanned</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[300px] flex items-center justify-center">
                  <div className="flex flex-col items-center justify-center text-center w-full transition-transform duration-300 group-hover/card:scale-[1.02]">
                    <div className="relative w-14 h-14 mb-4 mx-auto">
                      <div className="absolute inset-0 rounded-xl bg-emerald-400/30 blur-lg transition-all duration-300 group-hover/card:bg-emerald-400/40" />
                      <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 border border-emerald-400/30 flex items-center justify-center transition-all duration-300 group-hover/card:border-emerald-400/50">
                        <i className="lab la-github text-2xl text-emerald-300 transition-all duration-300 group-hover/card:text-emerald-200"></i>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-1.5 transition-colors duration-300 group-hover/card:text-emerald-100">Connect Your Repositories</h3>
                    <p className="text-sm text-white/40 mb-5 leading-relaxed max-w-xs mx-auto">
                      Link your GitHub account to monitor SOC 2 compliance
                    </p>
                    <div className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-sm font-medium transition-all duration-300 group-hover/card:bg-emerald-400 group-hover/card:shadow-lg group-hover/card:shadow-emerald-500/25 mx-auto">
                      <i className="lab la-github text-lg"></i>
                      Connect GitHub
                      <i className="las la-arrow-right text-sm transition-all duration-300 opacity-0 -translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0"></i>
                    </div>
                    <p className="mt-3 text-xs text-white/30">Read-only access · Secure OAuth</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Activity + Repositories Table */}
        <div className="grid grid-cols-12 gap-5 animate-fade-in-up delay-200">
          {/* Activity Feed */}
          <div className="col-span-4 bg-gradient-to-br from-purple-500/[0.08] to-transparent rounded-2xl p-5 border border-white/[0.04]">
            <h2 className="text-sm font-medium mb-4">Recent Activity</h2>
            {isGitHubConnected ? (
              <div className="space-y-3">
                {trackedRepos.length === 0 ? (
                  <div className="text-xs text-white/40">Scan a repository to see activity.</div>
                ) : (
                  trackedRepos.slice(0, 6).map((item, index) => {
                    const severity = (item.critical_violations || 0) > 0 ? "critical" : (item.total_violations || 0) > 0 ? "warning" : "success"
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-200"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          severity === "critical" ? "bg-red-400" :
                          severity === "success" ? "bg-emerald-400" :
                          "bg-amber-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-white/30 mx-1.5">·</span>
                            <span className="text-white/50">Last scan {item.last_scanned_at ? new Date(item.last_scanned_at).toLocaleString() : "pending"}</span>
                          </p>
                          <p className="text-xs text-white/30 mt-0.5">{item.total_violations || 0} issues, {item.critical_violations || 0} critical</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <i className="las la-history text-xl text-white/20"></i>
                </div>
                <p className="text-xs text-white/40">No activity yet</p>
              </div>
            )}
          </div>

          {/* Repositories Table */}
          <div className="col-span-8 bg-gradient-to-br from-white/[0.04] to-transparent rounded-2xl overflow-hidden border border-white/[0.04]">
            <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium">Tracked Repositories</h2>
              </div>

              {isGitHubConnected && trackedRepos.length > 0 && (
                <div className="flex gap-1 text-xs">
                  <button
                    onClick={() => setRepoFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${repoFilter === "all" ? "bg-white/[0.12]" : "text-white/60 hover:bg-white/[0.04]"}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setRepoFilter("critical")}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${repoFilter === "critical" ? "bg-red-500/15 text-red-300" : "text-white/60 hover:bg-white/[0.04]"}`}
                  >
                    Critical
                  </button>
                  <button
                    onClick={() => setRepoFilter("healthy")}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${repoFilter === "healthy" ? "bg-emerald-500/15 text-emerald-300" : "text-white/60 hover:bg-white/[0.04]"}`}
                  >
                    Healthy
                  </button>
                </div>
              )}
            </div>

            {isGitHubConnected ? (
              filteredTrackedRepos.length > 0 ? (
                <div className="px-2 pb-2">
                  {filteredTrackedRepos.map((repo, index) => {
                    const hasScan = !!repo.last_scanned_at
                    const violations = hasScan ? repo.total_violations ?? 0 : null
                    const critical = hasScan ? repo.critical_violations ?? 0 : null
                    const status = !hasScan
                      ? "pending"
                      : (critical ?? 0) > 0
                        ? "critical"
                        : (violations ?? 0) > 0
                          ? "warning"
                          : "clean"

                    return (
                      <button
                        key={repo.id}
                        type="button"
                        className="w-full text-left px-4 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-all duration-200 rounded-xl mx-1 mb-1"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                          status === "critical" ? "bg-red-400" :
                          status === "warning" ? "bg-amber-400" :
                          status === "pending" ? "bg-white/40" :
                          "bg-emerald-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{repo.name}</span>
                            <span className="text-xs text-white/30">{repo.full_name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                            {repo.language && <span>{repo.language}</span>}
                            <span>{repo.default_branch}</span>
                            {hasScan ? (
                              <span>Last scan: {new Date(repo.last_scanned_at || 0).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-white/50">Not yet scanned</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasScan && critical !== null && critical > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-xs text-red-400">{critical} critical</span>
                          )}
                          {hasScan && violations !== null && violations === 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-xs text-emerald-400">Clean</span>
                          )}
                          {!hasScan && (
                            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-white/60">Not scanned</span>
                          )}
                        </div>
                        <div className="w-14 text-right">
                          <div className="text-lg font-semibold">{hasScan ? violations : "—"}</div>
                          <div className="text-[10px] text-white/30 uppercase">issues</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <i className="lab la-filter text-2xl text-white/20"></i>
                  </div>
                  <p className="text-sm text-white/40 mb-3">No repositories match this filter</p>
                </div>
              )
            ) : (
              <div className="py-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                  <i className="lab la-github text-2xl text-white/20"></i>
                </div>
                <p className="text-sm text-white/40 mb-3">No repositories tracked</p>
                <button onClick={handleConnectGitHub} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                  Connect GitHub to get started
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes shimmerBg {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }

        .shimmer-bg {
          animation: shimmerBg 3s ease-in-out infinite;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>

      {/* Modals */}
      {oauthModalOpen && (
        <GitHubOAuthModal
          onSuccess={handleOAuthSuccess}
          onClose={() => setOauthModalOpen(false)}
        />
      )}

      {repoManagerOpen && (
        <GitHubRepoManager
          onSuccess={handleRepoManagerSuccess}
          onDisconnect={handleDisconnect}
          onClose={() => setRepoManagerOpen(false)}
        />
      )}
    </main>
  )
}
