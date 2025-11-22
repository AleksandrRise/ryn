"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"

// Platform configuration
const PLATFORMS = [
  { id: "github", name: "GitHub", laIcon: "lab la-github", available: true },
  { id: "aws", name: "AWS", laIcon: "lab la-aws", available: false },
  { id: "azure", name: "Azure", laIcon: "lab la-microsoft", available: false },
  { id: "gcp", name: "Google Cloud", laIcon: "lab la-google", available: false },
] as const

// All available repos from GitHub (mock)
const ALL_GITHUB_REPOS = [
  { id: 1, name: "api-server", fullName: "acme/api-server", language: "TypeScript", stars: 234, isPrivate: false },
  { id: 2, name: "web-dashboard", fullName: "acme/web-dashboard", language: "React", stars: 89, isPrivate: false },
  { id: 3, name: "auth-service", fullName: "acme/auth-service", language: "Go", stars: 156, isPrivate: true },
  { id: 4, name: "payment-gateway", fullName: "acme/payment-gateway", language: "Python", stars: 312, isPrivate: true },
  { id: 5, name: "mobile-app", fullName: "acme/mobile-app", language: "Swift", stars: 78, isPrivate: false },
  { id: 6, name: "analytics-engine", fullName: "acme/analytics-engine", language: "Rust", stars: 445, isPrivate: true },
]

// Mock data
const MOCK_REPOS = [
  { id: 1, name: "api-server", fullName: "acme/api-server", language: "TypeScript", lastScan: "2h ago", violations: 12, critical: 2, high: 4, status: "critical" as const, branch: "main" },
  { id: 2, name: "web-dashboard", fullName: "acme/web-dashboard", language: "React", lastScan: "5h ago", violations: 3, critical: 0, high: 1, status: "warning" as const, branch: "main" },
  { id: 3, name: "auth-service", fullName: "acme/auth-service", language: "Go", lastScan: "1d ago", violations: 0, critical: 0, high: 0, status: "healthy" as const, branch: "main" },
  { id: 4, name: "payment-gateway", fullName: "acme/payment-gateway", language: "Python", lastScan: "3h ago", violations: 8, critical: 1, high: 2, status: "critical" as const, branch: "main" },
]

const MOCK_ACTIVITY = [
  { id: 1, repo: "api-server", message: "12 violations found", time: "2h ago", severity: "critical" },
  { id: 2, repo: "web-dashboard", message: "Auto-fix applied", time: "3h ago", severity: "success" },
  { id: 3, repo: "payment-gateway", message: "8 violations found", time: "3h ago", severity: "critical" },
  { id: 4, repo: "web-dashboard", message: "3 violations found", time: "5h ago", severity: "warning" },
]

const MOCK_TREND = [
  { date: "Mon", violations: 42, fixed: 8 },
  { date: "Tue", violations: 38, fixed: 12 },
  { date: "Wed", violations: 45, fixed: 15 },
  { date: "Thu", violations: 36, fixed: 18 },
  { date: "Fri", violations: 28, fixed: 22 },
  { date: "Sat", violations: 24, fixed: 6 },
  { date: "Sun", violations: 23, fixed: 4 },
]

export function Dashboard() {
  const router = useRouter()
  const [isConnected, setIsConnected] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<typeof PLATFORMS[number]>(PLATFORMS[0])
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false)
  const [repoManagerOpen, setRepoManagerOpen] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<number[]>([1, 2, 3, 4])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPlatformDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const trackedRepos = isConnected ? MOCK_REPOS.filter(r => selectedRepos.includes(r.id)) : []
  const totalViolations = trackedRepos.reduce((sum, r) => sum + r.violations, 0)
  const criticalCount = trackedRepos.reduce((sum, r) => sum + r.critical, 0)
  const highCount = trackedRepos.reduce((sum, r) => sum + r.high, 0)
  const healthyCount = trackedRepos.filter(r => r.status === "healthy").length

  return (
    <>
      <main className="px-6 pt-8 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div className="flex items-center gap-5">
              {/* Platform Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                  className="flex items-center gap-3 pl-3 pr-4 py-2 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg transition-colors"
                >
                  <div className="w-7 h-7 rounded-md bg-white/[0.08] flex items-center justify-center">
                    <i className={`${selectedPlatform.laIcon} text-base`}></i>
                  </div>
                  <span className="text-sm font-medium">{selectedPlatform.name}</span>
                  <i className={`las la-angle-down text-xs text-white/40 ml-1 transition-transform ${platformDropdownOpen ? "rotate-180" : ""}`}></i>
                </button>

                {platformDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-[#111116] border border-white/[0.08] rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="p-1.5">
                      {PLATFORMS.map((platform) => {
                        const isSelected = platform.id === selectedPlatform.id
                        return (
                          <button
                            key={platform.id}
                            onClick={() => {
                              if (platform.available) {
                                setSelectedPlatform(platform)
                                setPlatformDropdownOpen(false)
                              }
                            }}
                            disabled={!platform.available}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                              isSelected ? "bg-white/[0.08]" : platform.available ? "hover:bg-white/[0.04]" : "opacity-40 cursor-not-allowed"
                            }`}
                          >
                            <i className={`${platform.laIcon} text-base`}></i>
                            <span className="flex-1 text-left">{platform.name}</span>
                            {!platform.available && <span className="text-[10px] text-white/40 uppercase">Soon</span>}
                            {isSelected && <i className="las la-check text-emerald-400 text-sm"></i>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-8 w-px bg-white/[0.08]" />

              <div>
                <h1 className="text-lg font-semibold tracking-tight">Compliance Overview</h1>
                <p className="text-xs text-white/40 mt-0.5">
                  {isConnected ? `${trackedRepos.length} repositories monitored` : "Connect to start monitoring"}
                </p>
              </div>
            </div>

            {/* Repositories Button */}
            <button
              onClick={() => setRepoManagerOpen(true)}
              className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all overflow-hidden ${
                isConnected
                  ? "bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08]"
                  : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              }`}
            >
              {!isConnected && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent animate-shimmer" />
              )}
              <i className={`las la-layer-group text-base ${!isConnected ? "text-emerald-400" : ""}`}></i>
              <span>Repositories</span>
              {!isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5"></span>}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <i className="las la-layer-group text-xl text-blue-400"></i>
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Repositories</div>
              </div>
              <div className="text-3xl font-bold tracking-tight">{trackedRepos.length}</div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <i className="las la-exclamation-triangle text-xl text-amber-400"></i>
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Violations</div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{totalViolations}</span>
                {isConnected && <span className="text-xs text-red-400">-18%</span>}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <i className="las la-radiation text-xl text-red-400"></i>
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Critical</div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{criticalCount}</span>
                {isConnected && criticalCount > 0 && <span className="text-xs text-white/30">needs attention</span>}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <i className="las la-shield-alt text-xl text-emerald-400"></i>
                </div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Healthy</div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{healthyCount}</span>
                {isConnected && <span className="text-xs text-white/30">of {trackedRepos.length}</span>}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-3 gap-6">
            {/* Chart */}
            <div className="col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-medium">Weekly Trend</h2>
                  <p className="text-xs text-white/40 mt-0.5">Violations over time</p>
                </div>
                {isConnected && (
                  <div className="flex items-center gap-5 text-xs text-white/50">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400/80"></span>Found</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400/80"></span>Fixed</span>
                  </div>
                )}
              </div>

              {isConnected ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_TREND} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
                      <defs>
                        <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgb(248,113,113)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="rgb(248,113,113)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fixGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgb(52,211,153)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="rgb(52,211,153)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
                        labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                      />
                      <Area type="monotone" dataKey="violations" stroke="rgb(248,113,113)" strokeWidth={1.5} fill="url(#violGrad)" />
                      <Area type="monotone" dataKey="fixed" stroke="rgb(52,211,153)" strokeWidth={1.5} fill="url(#fixGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center">
                  <i className="las la-chart-line text-4xl text-white/10 mb-3"></i>
                  <p className="text-sm text-white/40 max-w-[200px]">
                    Connect via <span className="text-emerald-400">Repositories</span> to see trends
                  </p>
                </div>
              )}
            </div>

            {/* Activity */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h2 className="text-sm font-medium mb-5">Recent Activity</h2>
              {isConnected ? (
                <div className="space-y-4">
                  {MOCK_ACTIVITY.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                        item.severity === "critical" ? "bg-red-400" : item.severity === "success" ? "bg-emerald-400" : "bg-amber-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">
                          <span className="font-medium">{item.repo}</span>
                          <span className="text-white/40 mx-1.5">·</span>
                          <span className="text-white/50">{item.message}</span>
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[calc(100%-2rem)] flex flex-col items-center justify-center">
                  <i className="las la-history text-3xl text-white/10 mb-2"></i>
                  <p className="text-xs text-white/40">No activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Repositories Table */}
          <div className="mt-6 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-medium">Tracked Repositories</h2>
              {isConnected && trackedRepos.length > 0 && (
                <div className="flex gap-1 text-xs">
                  <button className="px-2.5 py-1 rounded bg-white/[0.06]">All</button>
                  <button className="px-2.5 py-1 rounded text-white/40 hover:bg-white/[0.04]">Critical</button>
                  <button className="px-2.5 py-1 rounded text-white/40 hover:bg-white/[0.04]">Healthy</button>
                </div>
              )}
            </div>

            {isConnected && trackedRepos.length > 0 ? (
              <div>
                {trackedRepos.map((repo, i) => (
                  <div
                    key={repo.id}
                    onClick={() => router.push("/scan")}
                    className={`px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] cursor-pointer transition-colors ${
                      i !== trackedRepos.length - 1 ? "border-b border-white/[0.04]" : ""
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      repo.status === "critical" ? "bg-red-400" : repo.status === "warning" ? "bg-amber-400" : "bg-emerald-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{repo.name}</span>
                        <span className="text-xs text-white/30">{repo.fullName}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                        <span>{repo.language}</span>
                        <span>{repo.branch}</span>
                        <span>{repo.lastScan}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {repo.critical > 0 && (
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-xs text-red-400">{repo.critical} critical</span>
                      )}
                      {repo.high > 0 && (
                        <span className="px-2 py-0.5 rounded bg-orange-500/10 text-xs text-orange-400">{repo.high} high</span>
                      )}
                      {repo.violations === 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-xs text-emerald-400">Clean</span>
                      )}
                    </div>
                    <div className="w-14 text-right">
                      <div className="text-lg font-semibold">{repo.violations}</div>
                      <div className="text-[10px] text-white/30 uppercase">issues</div>
                    </div>
                    <i className="las la-angle-right text-white/20"></i>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <i className="lab la-github text-4xl text-white/10 mb-3"></i>
                <p className="text-sm text-white/40 mb-3">No repositories tracked</p>
                <button onClick={() => setRepoManagerOpen(true)} className="text-sm text-emerald-400 hover:text-emerald-300">
                  Open Repository Manager
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Repository Manager Modal */}
      {repoManagerOpen && (
        <RepoManagerModal
          isConnected={isConnected}
          selectedRepos={selectedRepos}
          onSelectRepos={setSelectedRepos}
          onConnect={() => { setIsConnected(true); setRepoManagerOpen(false) }}
          onDisconnect={() => { setIsConnected(false); setSelectedRepos([]); setRepoManagerOpen(false) }}
          onClose={() => setRepoManagerOpen(false)}
        />
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer { animation: shimmer 2.5s ease-in-out infinite; }
      `}</style>
    </>
  )
}

function RepoManagerModal({
  isConnected, selectedRepos, onSelectRepos, onConnect, onDisconnect, onClose,
}: {
  isConnected: boolean
  selectedRepos: number[]
  onSelectRepos: (repos: number[]) => void
  onConnect: () => void
  onDisconnect: () => void
  onClose: () => void
}) {
  const [localSelected, setLocalSelected] = useState<number[]>(selectedRepos)
  const allSelected = localSelected.length === ALL_GITHUB_REPOS.length

  const langColors: Record<string, string> = {
    TypeScript: "bg-blue-500", React: "bg-cyan-500", Go: "bg-cyan-400",
    Python: "bg-yellow-500", Rust: "bg-orange-500", Swift: "bg-orange-400",
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl">
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
              <i className="lab la-github text-xl"></i>
            </div>
            <div>
              <h2 className="font-semibold">Repository Manager</h2>
              <p className="text-xs text-white/40">{isConnected ? "Select repositories" : "Connect GitHub"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded hover:bg-white/[0.06] flex items-center justify-center">
            <i className="las la-times text-white/40"></i>
          </button>
        </div>

        <div className="p-6">
          {!isConnected ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <i className="lab la-github text-3xl text-emerald-400"></i>
              </div>
              <h3 className="font-semibold mb-2">Connect GitHub</h3>
              <p className="text-sm text-white/50 mb-5 max-w-xs mx-auto">
                Monitor your repositories for SOC 2 compliance violations.
              </p>
              <button onClick={onConnect} className="px-5 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-white/90 text-sm">
                <i className="lab la-github mr-2"></i>Connect with GitHub
              </button>
              <p className="mt-4 text-xs text-white/30">Read-only access</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-white/50">{localSelected.length} selected</span>
                <button onClick={() => setLocalSelected(allSelected ? [] : ALL_GITHUB_REPOS.map(r => r.id))} className="text-emerald-400 hover:text-emerald-300">
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ALL_GITHUB_REPOS.map((repo) => {
                  const selected = localSelected.includes(repo.id)
                  return (
                    <button
                      key={repo.id}
                      onClick={() => setLocalSelected(prev => prev.includes(repo.id) ? prev.filter(r => r !== repo.id) : [...prev, repo.id])}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                        selected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selected ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                        {selected && <i className="las la-check text-[10px] text-white"></i>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{repo.name}</span>
                          {repo.isPrivate && <span className="text-[10px] text-white/40 uppercase">Private</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                          <span>{repo.fullName}</span>
                          <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${langColors[repo.language] || "bg-gray-500"}`}></span>{repo.language}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
          {isConnected ? (
            <>
              <button onClick={onDisconnect} className="text-sm text-red-400 hover:text-red-300">Disconnect</button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={() => { onSelectRepos(localSelected); onClose() }}>Save</Button>
              </div>
            </>
          ) : (
            <button onClick={onClose} className="ml-auto text-sm text-white/50 hover:text-white/70">Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}
