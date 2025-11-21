"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Save, Download, BarChart3, Sparkles, Eye, Compass } from "lucide-react"
import { useProjectStore } from "@/lib/stores/project-store"
import { useFileWatcher } from "@/lib/hooks/useFileWatcher"
import {
  get_settings,
  update_settings,
  clear_database,
  export_data,
  type Settings as SettingsType,
} from "@/lib/tauri/commands"
import { handleTauriError, showSuccess, showInfo } from "@/lib/utils/error-handler"
import { save } from "@tauri-apps/plugin-dialog"
import { writeTextFile } from "@tauri-apps/plugin-fs"

// Settings state type
interface SettingsState {
  desktopNotifications: boolean
  llmScanMode: string
  costLimitPerScan: string
}

// Default state values
const defaultState: SettingsState = {
  desktopNotifications: true,
  llmScanMode: "smart",
  costLimitPerScan: "5.00",
}

// Map frontend state keys to backend storage keys
const settingsKeyMap: Record<keyof SettingsState, string> = {
  desktopNotifications: "desktop_notifications",
  llmScanMode: "llm_scan_mode",
  costLimitPerScan: "cost_limit_per_scan",
}

// Helper: Convert backend settings array to state object
function settingsArrayToState(settings: SettingsType[]): SettingsState {
  const state = { ...defaultState }

  settings.forEach((setting) => {
    // Find the state key that maps to this backend key
    const stateKey = Object.entries(settingsKeyMap).find(
      ([_k, backendKey]) => backendKey === setting.key
    )?.[0] as keyof SettingsState | undefined

    if (stateKey) {
      const value = setting.value
      // Parse boolean strings
      if (value === "true" || value === "false") {
        (state as any)[stateKey] = value === "true"
      } else {
        (state as any)[stateKey] = value
      }
    }
  })

  return state
}

export function Settings() {
  const { selectedProject } = useProjectStore()
  const [state, setState] = useState<SettingsState>(defaultState)
  const { isWatching, startWatching, stopWatching, isLoading: isWatcherLoading } = useFileWatcher(
    selectedProject?.id,
    { autoStart: false, showNotifications: state.desktopNotifications }
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true)
        const settings = await get_settings()
        const loadedState = settingsArrayToState(settings)
        setState(loadedState)
      } catch (error) {
        handleTauriError(error, "Failed to load settings")
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Save all settings to backend
  const handleSaveChanges = async () => {
    try {
      setIsSaving(true)
      showInfo("Saving settings...")

      // Save each setting to backend
      const savePromises = Object.entries(state).map(([key, value]) => {
        const backendKey = settingsKeyMap[key as keyof SettingsState]
        const stringValue = typeof value === "boolean" ? value.toString() : value
        return update_settings(backendKey, stringValue)
      })

      await Promise.all(savePromises)
      showSuccess("Settings saved successfully!")
    } catch (error) {
      handleTauriError(error, "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle export - export all data to JSON file
  const handleExport = async () => {
    try {
      showInfo("Exporting data...")
      const jsonData = await export_data()

      // Open save dialog
      const filePath = await save({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
        defaultPath: `ryn-export-${new Date().toISOString().split("T")[0]}.json`,
      })

      if (filePath) {
        await writeTextFile(filePath, jsonData)
        showSuccess(`Data exported successfully to ${filePath}`)
      }
    } catch (error) {
      handleTauriError(error, "Failed to export data")
    }
  }

  // Handle clear database
  const handleClearDatabase = async () => {
    const confirmed = window.confirm(
      "WARNING: This will permanently delete all scan history, violations, fixes, and audit events. Projects and settings will be preserved. This action cannot be undone!\n\nAre you sure you want to continue?"
    )

    if (!confirmed) return

    try {
      showInfo("Clearing database...")
      await clear_database()
      showSuccess("Database cleared successfully!")
    } catch (error) {
      handleTauriError(error, "Failed to clear database")
    }
  }

  // Handle export all data (from inline buttons)
  const handleExportAll = async () => {
    await handleExport()
  }

  const handleLlmScanModeChange = async (value: string) => {
    updateSetting("llmScanMode", value)
    try {
      await update_settings(settingsKeyMap.llmScanMode, value)
    } catch (error) {
      handleTauriError(error, "Failed to update scanning mode")
    }
  }

  // Update individual setting in state
  const updateSetting = (key: keyof SettingsState, value: any) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="px-8 py-8 max-w-[1400px] mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-white/70">Loading settings...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">Settings</h1>
          <p className="text-lg text-white/60">Configure compliance scanning and integrations</p>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 mt-4 text-sm text-white/70 hover:text-white transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            View Cost Analytics →
          </Link>
          <div className="mt-2">
            <Link
              href="/onboarding?force=1"
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              <Compass className="w-4 h-4" />
              Re-run onboarding
            </Link>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleExport} size="lg" variant="outline" className="gap-2" disabled={isSaving}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button onClick={handleSaveChanges} size="lg" className="gap-2" disabled={isSaving}>
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in-up delay-100">
        {/* AI Scanning Configuration */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/5 rounded-lg">
              <Sparkles className="w-5 h-5 text-white/60" />
            </div>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">AI Scanning</h2>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block mb-3 text-sm font-medium">Scanning Mode</label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="radio"
                    name="scanMode"
                    value="regex_only"
                    checked={state.llmScanMode === "regex_only"}
                    onChange={(e) => handleLlmScanModeChange(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Pattern Only</p>
                    <p className="text-xs text-white/50">Free, instant regex-based detection only</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="radio"
                    name="scanMode"
                    value="smart"
                    checked={state.llmScanMode === "smart"}
                    onChange={(e) => handleLlmScanModeChange(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Smart (Recommended)</p>
                    <p className="text-xs text-white/50">
                      AI analyzes ~30-40% of files (security-critical code only)
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="radio"
                    name="scanMode"
                    value="analyze_all"
                    checked={state.llmScanMode === "analyze_all"}
                    onChange={(e) => handleLlmScanModeChange(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Analyze All</p>
                    <p className="text-xs text-white/50">AI analyzes every file (maximum accuracy, higher cost)</p>
                  </div>
                </label>
              </div>
            </div>

            {state.llmScanMode !== "regex_only" && (
              <div>
                <label className="block mb-2 text-sm font-medium">Cost Limit Per Scan (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.costLimitPerScan}
                  onChange={(e) => updateSetting("costLimitPerScan", e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="5.00"
                />
                <p className="text-xs text-white/50 mt-2">
                  Scanning will pause if estimated cost exceeds this limit
                </p>
              </div>
            )}
          </div>
        </div>
        {/* Monitoring & Notifications */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/5 rounded-lg">
              <Eye className="w-5 h-5 text-white/60" />
            </div>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Monitoring</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a]">
              <div>
                <p className="text-[14px] mb-1">Desktop notifications</p>
                <p className="text-[12px] text-[#aaaaaa]">Use OS-level alerts for file changes and scans</p>
              </div>
              <button
                onClick={() => updateSetting("desktopNotifications", !state.desktopNotifications)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-all duration-200 border min-w-[60px] hover:scale-105 active:scale-95 ${
                  state.desktopNotifications
                    ? "bg-[#b3b3b3] text-black border-[#b3b3b3] shadow-md"
                    : "bg-[#0a0a0a] text-[#333] border-[#1a1a1a] hover:border-[#333] hover:bg-[#111]"
                }`}
              >
                {state.desktopNotifications ? "ON" : "OFF"}
              </button>
            </div>

            {selectedProject ? (
              <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a]">
                <div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-white/60" />
                    <p className="text-[14px] mb-1">Real-time file watching</p>
                  </div>
                  <p className="text-[12px] text-[#aaaaaa]">
                    {isWatching
                      ? `Monitoring ${selectedProject.name} for file changes`
                      : "Watch project files for real-time changes"}
                  </p>
                </div>
                <button
                  onClick={isWatching ? stopWatching : startWatching}
                  disabled={isWatcherLoading}
                  className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-all duration-200 border min-w-[60px] hover:scale-105 active:scale-95 disabled:opacity-50 ${
                    isWatching
                      ? "bg-[#b3b3b3] text-black border-[#b3b3b3] shadow-md"
                      : "bg-[#0a0a0a] text-[#333] border-[#1a1a1a] hover:border-[#333] hover:bg-[#111]"
                  }`}
                >
                  {isWatcherLoading ? "..." : isWatching ? "ON" : "OFF"}
                </button>
              </div>
            ) : (
              <div className="py-4 border-b border-[#1a1a1a] text-[12px] text-[#aaaaaa]">
                Select a project to enable file watching and notifications.
              </div>
            )}
          </div>
        </div>

        {/* Data & Maintenance */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 xl:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/5 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Data & Maintenance</h2>
              <p className="text-xs text-white/50">Export data or wipe scan history if you need a clean slate</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleExportAll} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export all data
            </Button>
            <Button onClick={handleClearDatabase} variant="outline" className="gap-2 border-red-400/50 text-red-100 hover:bg-red-500/20">
              <Save className="w-4 h-4" />
              Clear scan history
            </Button>
          </div>

          <p className="text-[12px] text-[#aaaaaa] mt-4">
            Clearing scan history removes violations, fixes, and audit events. Projects and settings stay intact.
          </p>
        </div>
      </div>
    </div>
  )
}
