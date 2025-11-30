"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2, Lock, Star, RefreshCw, LogOut, Check } from "lucide-react";
import { toast } from "sonner";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  language?: string;
  stargazers_count: number;
  html_url: string;
}

interface GitHubRepoManagerProps {
  onSuccess: () => void;
  onDisconnect: () => void;
  onClose: () => void;
  onScanStarted?: (repoId: number) => void;
  onScanCompleted?: (repoId: number) => void;
}

export function GitHubRepoManager({
  onSuccess,
  onDisconnect,
  onClose,
  onScanStarted,
  onScanCompleted,
}: GitHubRepoManagerProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [trackedRepoIds, setTrackedRepoIds] = useState<Set<number>>(new Set());
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load GitHub repos and tracked status
  useEffect(() => {
    const loadRepos = async () => {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get GitHub connection
        const { data: connection } = await supabase
          .from("github_connections")
          .select("access_token")
          .eq("user_id", user.id)
          .single();

        if (!connection?.access_token) {
          toast.error("GitHub connection not found");
          onClose();
          return;
        }

        // Fetch repos from GitHub API
        const response = await fetch("https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator", {
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch GitHub repositories");
        }

        const ghRepos = await response.json();
        setRepos(ghRepos);

        // Get already tracked repos
        const { data: tracked } = await supabase
          .from("tracked_repos")
          .select("github_repo_id")
          .eq("user_id", user.id);

        const trackedIds = new Set(
          tracked?.map((t: any) => t.github_repo_id) || []
        );
        setTrackedRepoIds(trackedIds);
        setSelectedRepoIds(new Set(trackedIds));
      } catch (error: any) {
        console.error("Failed to load repos:", error);
        toast.error("Failed to load repositories");
      } finally {
        setLoading(false);
      }
    };

    loadRepos();
  }, [supabase, onClose]);

  const handleToggleRepo = (repoId: number) => {
    const newSelected = new Set(selectedRepoIds);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      newSelected.add(repoId);
    }
    setSelectedRepoIds(newSelected);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: connection } = await supabase
        .from("github_connections")
        .select("access_token")
        .eq("user_id", user.id)
        .single();

      if (!connection?.access_token) return;

      // Fetch fresh repos
      const response = await fetch("https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator", {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (response.ok) {
        const ghRepos = await response.json();
        setRepos(ghRepos);
        toast.success("Repositories refreshed");
      }
    } catch (error: any) {
      toast.error("Failed to sync repositories");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate changes
      const toTrack = Array.from(selectedRepoIds).filter(
        (id) => !trackedRepoIds.has(id)
      );
      const toUntrack = Array.from(trackedRepoIds).filter(
        (id) => !selectedRepoIds.has(id)
      );

      // Track new repos
      if (toTrack.length > 0) {
        const reposToTrack = repos.filter((r) => toTrack.includes(r.id));
        const { error } = await supabase.from("tracked_repos").insert(
          reposToTrack.map((r) => ({
            user_id: user.id,
            github_repo_id: r.id,
            name: r.name,
            full_name: r.full_name,
            url: r.html_url,
            is_private: r.private,
            language: r.language,
            added_at: new Date().toISOString(),
          }))
        );

        if (error) throw error;

        // Auto-start scans for new repos
        for (const repo of reposToTrack) {
          onScanStarted?.(repo.id);
          // In a real app, you would trigger a scan here
        }
      }

      // Untrack removed repos
      if (toUntrack.length > 0) {
        const { error } = await supabase
          .from("tracked_repos")
          .delete()
          .eq("user_id", user.id)
          .in("github_repo_id", toUntrack);

        if (error) throw error;
      }

      toast.success("Repositories updated");
      setTrackedRepoIds(selectedRepoIds);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save repos:", error);
      toast.error("Failed to save repository selection");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    Array.from(selectedRepoIds).sort().join(",") !==
    Array.from(trackedRepoIds).sort().join(",");

  // Sort repos: selected first, then alphabetically
  const sortedRepos = [...repos].sort((a, b) => {
    const aSelected = selectedRepoIds.has(a.id);
    const bSelected = selectedRepoIds.has(b.id);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-gradient-to-br from-[#0f0f16] to-[#1a1a24] border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Manage Repositories</h2>
            <p className="text-xs text-white/50 mt-1">
              Select repositories to track for compliance
              {hasChanges && (
                <span className="ml-2 text-amber-400">
                  • {selectedRepoIds.size} selected
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
              <p className="text-white/70">Loading repositories...</p>
            </div>
          ) : repos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-white/70 mb-2">No repositories found</p>
              <p className="text-sm text-white/50">
                Make sure you have access to repositories on GitHub
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedRepos.map((repo) => {
                const isSelected = selectedRepoIds.has(repo.id);
                const isNew = isSelected && !trackedRepoIds.has(repo.id);

                return (
                  <div
                    key={repo.id}
                    onClick={() => handleToggleRepo(repo.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? "bg-blue-500 border-blue-500"
                          : "border-white/30"
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>

                    {/* Language color indicator */}
                    {repo.language && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: getLanguageColor(repo.language),
                        }}
                      />
                    )}

                    {/* Repo info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white/90">
                          {repo.name}
                        </span>
                        {repo.private && (
                          <Lock className="w-3 h-3 text-white/50" />
                        )}
                        {isNew && (
                          <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50">{repo.full_name}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {repo.language && (
                        <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">
                          {repo.language}
                        </span>
                      )}
                      {repo.stargazers_count > 0 && (
                        <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60 flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {repo.stargazers_count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 p-6 space-y-3 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={loading || isSyncing}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              Sync
            </button>
            <button
              onClick={onDisconnect}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 text-sm ml-auto"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white transition-colors font-medium text-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Done"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Python: "#3572A5",
    Go: "#00ADD8",
    Rust: "#CE422B",
    Java: "#b07219",
    Ruby: "#CC342D",
    PHP: "#777BB4",
    "C++": "#f34b7d",
    C: "#555555",
  };

  return colors[language] || "#858585";
}
