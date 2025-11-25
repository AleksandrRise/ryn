"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  get_github_repos,
  fetch_github_repos,
  track_repo,
  untrack_repo,
  get_tracked_repos,
  disconnect_github,
  type GitHubRepo,
  type TrackedRepoWithDetails,
} from "@/lib/tauri/commands"

interface GitHubRepoManagerProps {
  onSuccess: () => void
  onDisconnect: () => void
  onClose: () => void
}

export function GitHubRepoManager({ onSuccess, onDisconnect, onClose }: GitHubRepoManagerProps) {
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([])
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepoWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [repos, tracked] = await Promise.all([
        get_github_repos(),
        get_tracked_repos(),
      ])
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

  const handleToggleTrack = async (repo: GitHubRepo) => {
    try {
      const isTracked = trackedRepos.some(t => t.github_repo.id === repo.id)

      if (isTracked) {
        const tracked = trackedRepos.find(t => t.github_repo.id === repo.id)
        if (tracked) {
          await untrack_repo(tracked.id)
          setTrackedRepos(prev => prev.filter(t => t.id !== tracked.id))
        }
      } else {
        await track_repo(repo.id)
        const updated = await get_tracked_repos()
        setTrackedRepos(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
                {trackedRepos.length} of {allRepos.length} repositories tracked
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
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-sm disabled:opacity-50"
            >
              <i className={`las la-sync ${syncing ? "animate-spin" : ""}`}></i>
              {syncing ? "Syncing..." : "Sync Repositories"}
            </button>

            <div className="text-sm text-white/50">
              {trackedRepos.length} tracked
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
              {allRepos.map((repo, index) => {
                const isTracked = trackedRepos.some(t => t.github_repo.id === repo.id)
                return (
                  <button
                    key={repo.id}
                    onClick={() => handleToggleTrack(repo)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                      isTracked ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      isTracked ? "bg-gradient-to-r from-emerald-500 to-cyan-500" : "bg-white/10"
                    }`}>
                      {isTracked && <i className="las la-check text-xs text-white"></i>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">{repo.name}</span>
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
          >
            Disconnect GitHub
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSuccess()
                onClose()
              }}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 border-0"
            >
              Done
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
