"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  get_github_repos,
  fetch_github_repos,
  track_repo,
  untrack_repo,
  get_tracked_repos,
  disconnect_github,
  scan_github_repo,
  get_settings,
  type GitHubRepo,
  type TrackedRepoWithDetails,
} from "@/lib/tauri/commands"

interface GitHubRepoManagerProps {
  onSuccess: () => void
  onDisconnect: () => void
  onClose: () => void
  onScanStarted?: (trackedRepoId: number) => void
  onScanCompleted?: (trackedRepoId: number) => void
}

export function GitHubRepoManager({ onSuccess, onDisconnect, onClose, onScanStarted, onScanCompleted }: GitHubRepoManagerProps) {
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([])
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepoWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pending selections - these are the repo IDs that will be tracked when "Done" is clicked
  // Initialize with currently tracked repo github_ids
  const [pendingSelections, setPendingSelections] = useState<Set<number>>(new Set())
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // Initialize pending selections from currently tracked repos
  useEffect(() => {
    if (!initialized && trackedRepos.length >= 0 && !loading) {
      setPendingSelections(new Set(trackedRepos.map(t => t.github_repo.id)))
      setInitialized(true)
    }
  }, [trackedRepos, loading, initialized])

  const loadData = async () => {
    try {
      setLoading(true)
      const trackedPromise = get_tracked_repos()

      let repos = await get_github_repos()

      // If cache is empty, automatically pull fresh data so the modal never feels blank
      if (repos.length === 0) {
        repos = await fetch_github_repos()
      }

      const tracked = await trackedPromise
      setAllRepos(repos)
      setTrackedRepos(tracked)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)
      const repos = await fetch_github_repos()
      setAllRepos(repos)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }

  // Toggle selection locally (doesn't actually track until Done is clicked)
  const handleToggleSelection = (repo: GitHubRepo) => {
    setPendingSelections(prev => {
      const next = new Set(prev)
      if (next.has(repo.id)) {
        next.delete(repo.id)
      } else {
        next.add(repo.id)
      }
      return next
    })
  }

  // Calculate what changed
  const currentlyTrackedIds = useMemo(() => new Set(trackedRepos.map(t => t.github_repo.id)), [trackedRepos])

  const toTrack = useMemo(() =>
    allRepos.filter(r => pendingSelections.has(r.id) && !currentlyTrackedIds.has(r.id)),
    [allRepos, pendingSelections, currentlyTrackedIds]
  )

  const toUntrack = useMemo(() =>
    trackedRepos.filter(t => !pendingSelections.has(t.github_repo.id)),
    [trackedRepos, pendingSelections]
  )

  const hasChanges = toTrack.length > 0 || toUntrack.length > 0

  // Apply changes when Done is clicked
  const handleDone = async () => {
    if (!hasChanges) {
      onSuccess()
      onClose()
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Untrack repos that were deselected
      for (const tracked of toUntrack) {
        await untrack_repo(tracked.id)
      }

      // Track new repos and start scans
      const newlyTrackedIds: number[] = []
      for (const repo of toTrack) {
        const trackedRepoId = await track_repo(repo.id)
        newlyTrackedIds.push(trackedRepoId)
      }

      // Refresh tracked repos
      const updated = await get_tracked_repos()
      setTrackedRepos(updated)

      // Start scans for newly tracked repos
      if (newlyTrackedIds.length > 0) {
        // Get scan mode from settings
        let scanMode = "smart"
        try {
          const settings = await get_settings()
          const modeSetting = settings.find(s => s.key === "llm_scan_mode")
          if (modeSetting) scanMode = modeSetting.value
        } catch {
          // Use default
        }

        // Start scans for all newly tracked repos
        for (let i = 0; i < newlyTrackedIds.length; i++) {
          const trackedRepoId = newlyTrackedIds[i]
          const repo = toTrack[i]

          onScanStarted?.(trackedRepoId)
          toast(`Scanning ${repo.name}...`, {
            description: "Running initial compliance scan.",
          })

          // Run scan in background
          scan_github_repo(trackedRepoId, scanMode)
            .then(() => {
              toast.success(`Scan complete`, {
                description: `${repo.name} has been scanned.`,
              })
              onScanCompleted?.(trackedRepoId)
            })
            .catch(err => {
              console.error(`Failed to scan ${repo.name}:`, err)
              toast.error(`Scan failed for ${repo.name}`)
              onScanCompleted?.(trackedRepoId)
            })
        }
      }

      const added = toTrack.length
      const removed = toUntrack.length
      if (added > 0 && removed > 0) {
        toast.success(`Updated tracking`, { description: `Added ${added}, removed ${removed} repositories` })
      } else if (added > 0) {
        toast.success(`Now tracking ${added} new ${added === 1 ? 'repository' : 'repositories'}`)
      } else if (removed > 0) {
        toast.success(`Stopped tracking ${removed} ${removed === 1 ? 'repository' : 'repositories'}`)
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (confirm("Are you sure you want to disconnect GitHub? All tracked repositories will be removed.")) {
      try {
        await disconnect_github()
        onDisconnect()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const langColors: Record<string, string> = {
    TypeScript: "bg-blue-500",
    JavaScript: "bg-yellow-500",
    React: "bg-cyan-500",
    Go: "bg-cyan-400",
    Python: "bg-yellow-500",
    Rust: "bg-orange-500",
    Swift: "bg-orange-400",
    Java: "bg-red-500",
    Ruby: "bg-red-400",
    PHP: "bg-purple-500",
    C: "bg-gray-500",
    "C++": "bg-pink-500",
    "C#": "bg-purple-600",
  }

  const selectedCount = pendingSelections.size

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#12121a] rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <i className="lab la-github text-xl"></i>
            </div>
            <div>
              <h2 className="font-semibold">Repository Manager</h2>
              <p className="text-xs text-white/40">
                {selectedCount} of {allRepos.length} repositories selected
                {hasChanges && <span className="text-amber-400 ml-2">• Unsaved changes</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
            <i className="las la-times text-white/40"></i>
          </button>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleSync}
              disabled={syncing || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-sm disabled:opacity-50"
            >
              <i className={`las la-sync ${syncing ? "animate-spin" : ""}`}></i>
              {syncing ? "Syncing..." : "Sync Repositories"}
            </button>

            <div className="text-sm text-white/50">
              {selectedCount} selected
              {hasChanges && (
                <span className="text-xs ml-2">
                  ({toTrack.length > 0 && <span className="text-emerald-400">+{toTrack.length}</span>}
                  {toTrack.length > 0 && toUntrack.length > 0 && " / "}
                  {toUntrack.length > 0 && <span className="text-red-400">-{toUntrack.length}</span>})
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center">
                <i className="lab la-github text-3xl text-emerald-400 animate-pulse"></i>
              </div>
              <p className="text-sm text-white/50">Loading repositories...</p>
            </div>
          ) : allRepos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.06] flex items-center justify-center">
                <i className="las la-inbox text-3xl text-white/30"></i>
              </div>
              <p className="text-sm text-white/50 mb-4">No repositories found</p>
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Fetch Repositories"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {/* Sort repos: selected first, then alphabetically */}
              {[...allRepos]
                .sort((a, b) => {
                  const aSelected = pendingSelections.has(a.id)
                  const bSelected = pendingSelections.has(b.id)
                  if (aSelected && !bSelected) return -1
                  if (!aSelected && bSelected) return 1
                  return a.name.localeCompare(b.name)
                })
                .map((repo, index) => {
                const isSelected = pendingSelections.has(repo.id)
                const isCurrentlyTracked = currentlyTrackedIds.has(repo.id)
                const isNewSelection = isSelected && !isCurrentlyTracked
                const willBeRemoved = !isSelected && isCurrentlyTracked

                return (
                  <button
                    key={repo.id}
                    onClick={() => handleToggleSelection(repo)}
                    disabled={saving}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                      isSelected
                        ? isNewSelection
                          ? "bg-emerald-500/15 border border-emerald-500/30"
                          : "bg-emerald-500/10 border border-emerald-500/20"
                        : willBeRemoved
                          ? "bg-red-500/10 border border-red-500/20"
                          : "bg-white/[0.03] hover:bg-white/[0.06]"
                    } ${saving ? "opacity-50 cursor-wait" : ""}`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                        : willBeRemoved
                          ? "bg-red-500/50"
                          : "bg-white/10"
                    }`}>
                      {isSelected && <i className="las la-check text-xs text-white"></i>}
                      {willBeRemoved && <i className="las la-minus text-xs text-white"></i>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">{repo.name}</span>
                        {isNewSelection && (
                          <span className="flex-shrink-0 text-[10px] text-emerald-300 uppercase bg-emerald-500/20 px-1.5 py-0.5 rounded">
                            New
                          </span>
                        )}
                        {willBeRemoved && (
                          <span className="flex-shrink-0 text-[10px] text-red-300 uppercase bg-red-500/20 px-1.5 py-0.5 rounded">
                            Remove
                          </span>
                        )}
                        {repo.private && (
                          <span className="flex-shrink-0 text-[10px] text-white/30 uppercase bg-white/[0.06] px-1.5 py-0.5 rounded">
                            Private
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                        <span className="truncate">{repo.full_name}</span>
                        {repo.language && (
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${langColors[repo.language] || "bg-gray-500"}`}></span>
                            {repo.language}
                          </span>
                        )}
                        {repo.stargazers_count > 0 && (
                          <span className="flex items-center gap-0.5 flex-shrink-0">
                            <i className="las la-star text-[10px]"></i>
                            {repo.stargazers_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-white/[0.02] flex items-center justify-between border-t border-white/[0.06]">
          <button
            onClick={handleDisconnect}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
            disabled={saving}
          >
            Disconnect GitHub
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDone}
              disabled={saving}
              className={`${hasChanges ? "bg-gradient-to-r from-emerald-500 to-cyan-500" : "bg-white/10"} border-0`}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <i className="las la-circle-notch animate-spin"></i>
                  Saving...
                </span>
              ) : hasChanges ? (
                "Save"
              ) : (
                "Done"
              )}
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
