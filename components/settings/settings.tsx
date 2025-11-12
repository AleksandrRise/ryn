"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Save, Download } from "lucide-react"
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
  autoApplyLow: boolean
  autoApplyMedium: boolean
  continuousMonitoring: boolean
  autoDetectFramework: boolean
  framework: string
  scanFrequency: string
  databaseType: string
  connectionString: string
  desktopNotifications: boolean
  emailAlerts: boolean
  slackWebhook: string
}

// Default state values
const defaultState: SettingsState = {
  autoApplyLow: true,
  autoApplyMedium: false,
  continuousMonitoring: true,
  autoDetectFramework: true,
  framework: "Django",
  scanFrequency: "on-commit",
  databaseType: "PostgreSQL",
  connectionString: "",
  desktopNotifications: true,
  emailAlerts: false,
  slackWebhook: "",
}

// Map frontend state keys to backend storage keys
const settingsKeyMap: Record<keyof SettingsState, string> = {
  autoApplyLow: "auto_apply_low",
  autoApplyMedium: "auto_apply_medium",
  continuousMonitoring: "continuous_monitoring",
  autoDetectFramework: "auto_detect_framework",
  framework: "framework",
  scanFrequency: "scan_frequency",
  databaseType: "database_type",
  connectionString: "connection_string",
  desktopNotifications: "desktop_notifications",
  emailAlerts: "email_alerts",
  slackWebhook: "slack_webhook",
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

// Modern Toggle Component
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-white" : "bg-white/20"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
          enabled ? "translate-x-6 bg-black" : "translate-x-1 bg-white/60"
        }`}
      />
    </button>
  )
}

export function Settings() {
  const [state, setState] = useState<SettingsState>(defaultState)
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
      <div className="grid grid-cols-2 gap-6 animate-fade-in-up delay-100">
        {/* Framework Detection Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/5 rounded-lg">
              <Code className="w-5 h-5 text-white/60" />
            </div>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Framework</h2>
          </div>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1">Auto-detect framework</p>
                <p className="text-xs text-white/50">Automatically identify your project</p>
              </div>
              <Toggle
                enabled={state.autoDetectFramework}
                onChange={() => updateSetting("autoDetectFramework", !state.autoDetectFramework)}
              />
            </div>

            {!state.autoDetectFramework && (
              <div>
                <label className="block mb-2 text-sm font-medium">Select framework</label>
                <select
                  value={state.framework}
                  onChange={(e) => updateSetting("framework", e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
                >
                  <option value="Django">Django</option>
                  <option value="Flask">Flask</option>
                  <option value="Express">Express (Node.js)</option>
                  <option value="Rails">Ruby on Rails</option>
                  <option value="Spring Boot">Spring Boot</option>
                  <option value="Go">Go (Gin/Echo)</option>
                  <option value="Rust">Rust (Actix/Rocket)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Trust Levels */}
        <section className="animate-fade-in-up delay-300">
          <h2 className="text-[13px] uppercase tracking-wider text-[#aaaaaa] mb-6">Trust Levels</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a]">
              <div>
                <p className="text-[14px] mb-1">Auto-apply low risk fixes</p>
                <p className="text-[12px] text-[#aaaaaa]">Automatically apply fixes with minimal impact</p>
              </div>
              <button
                onClick={() => updateSetting("autoApplyLow", !state.autoApplyLow)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-all border min-w-[60px] ${
                  state.autoApplyLow
                    ? "bg-[#b3b3b3] text-black border-[#b3b3b3]"
                    : "bg-[#0a0a0a] text-[#333] border-[#1a1a1a] hover:border-[#333]"
                }`}
              >
                {state.autoApplyLow ? "ON" : "OFF"}
              </button>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a]">
              <div>
                <p className="text-[14px] mb-1">Auto-apply medium risk fixes</p>
                <p className="text-[12px] text-[#aaaaaa]">Requires preview before applying</p>
              </div>
              <button
                onClick={() => updateSetting("autoApplyMedium", !state.autoApplyMedium)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-all border min-w-[60px] ${
                  state.autoApplyMedium
                    ? "bg-[#b3b3b3] text-black border-[#b3b3b3]"
                    : "bg-[#0a0a0a] text-[#333] border-[#1a1a1a] hover:border-[#333]"
                }`}
              >
                {state.autoApplyMedium ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </section>

        {/* Scan Preferences */}
        <section className="animate-fade-in-up delay-400">
          <h2 className="text-[13px] uppercase tracking-wider text-[#aaaaaa] mb-6">Scan Preferences</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a]">
              <div>
                <p className="text-[14px] mb-1">Enable continuous monitoring</p>
                <p className="text-[12px] text-[#aaaaaa]">Automatically scan files when they change</p>
              </div>
              <button
                onClick={() => updateSetting("continuousMonitoring", !state.continuousMonitoring)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-all border min-w-[60px] ${
                  state.continuousMonitoring
                    ? "bg-[#b3b3b3] text-black border-[#b3b3b3]"
                    : "bg-[#0a0a0a] text-[#333] border-[#1a1a1a] hover:border-[#333]"
                }`}
              >
                {state.continuousMonitoring ? "ON" : "OFF"}
              </button>
            </div>

            <div className="py-4 border-b border-[#1a1a1a]">
              <label className="block mb-2 text-[14px]">Scan frequency</label>
              <select
                value={state.scanFrequency}
                onChange={(e) => updateSetting("scanFrequency", e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-2 text-[13px] focus:outline-none focus:border-white"
              >
                <option value="on-commit">On every commit</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="manual">Manual only</option>
              </select>
              <p className="text-[12px] text-[#aaaaaa] mt-2">When to automatically run compliance scans</p>
            </div>
          </div>
        </section>

        {/* Database */}
        <section className="animate-fade-in-up delay-500">
          <h2 className="text-[13px] uppercase tracking-wider text-[#aaaaaa] mb-6">Database</h2>
          <div className="space-y-6">
            <div className="py-4 border-b border-[#1a1a1a]">
              <label className="block mb-2 text-[14px]">Database type</label>
              <select
                value={state.databaseType}
                onChange={(e) => updateSetting("databaseType", e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-2 text-[13px] focus:outline-none focus:border-white"
              >
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="MongoDB">MongoDB</option>
                <option value="MySQL">MySQL</option>
                <option value="SQLite">SQLite</option>
              </select>
            </div>

            <div className="py-4 border-b border-[#1a1a1a]">
              <label className="block mb-2 text-[14px]">Connection string</label>
              <input
                type="text"
                value={state.connectionString}
                onChange={(e) => updateSetting("connectionString", e.target.value)}
                placeholder="postgresql://user:password@localhost:5432/dbname"
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-2 text-[13px] font-mono focus:outline-none focus:border-white"
              />
              <p className="text-[12px] text-[#aaaaaa] mt-2">Used for scanning database access patterns</p>
            </div>

            <div className="space-y-4">
              <button onClick={handleClearDatabase} className="text-[13px] hover:underline">
                Clear scan history
              </button>
              <span className="text-[#aaaaaa] mx-2">•</span>
              <button onClick={handleExportAll} className="text-[13px] hover:underline">
                Export all data
              </button>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="animate-fade-in-up delay-600">
          <h2 className="text-[13px] uppercase tracking-wider text-[#aaaaaa] mb-6">Notifications</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a]">
              <div>
                <p className="text-[14px] mb-1">Desktop notifications</p>
                <p className="text-[12px] text-[#aaaaaa]">Show alerts for new violations and scan completion</p>
              </div>
              <button
                onClick={() => updateSetting("desktopNotifications", !state.desktopNotifications)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-all border min-w-[60px] ${
                  state.desktopNotifications
                    ? "bg-[#b3b3b3] text-black border-[#b3b3b3]"
                    : "bg-[#0a0a0a] text-[#333] border-[#1a1a1a] hover:border-[#333]"
                }`}
              >
                {state.desktopNotifications ? "ON" : "OFF"}
              </button>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a]">
              <div>
                <p className="text-[14px] mb-1">Email alerts</p>
                <p className="text-[12px] text-[#aaaaaa]">Receive critical violation alerts via email</p>
              </div>
              <button
                onClick={() => updateSetting("emailAlerts", !state.emailAlerts)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-all border min-w-[60px] ${
                  state.emailAlerts
                    ? "bg-[#b3b3b3] text-black border-[#b3b3b3]"
                    : "bg-[#0a0a0a] text-[#333] border-[#1a1a1a] hover:border-[#333]"
                }`}
              >
                {state.emailAlerts ? "ON" : "OFF"}
              </button>
            </div>

            <div className="py-4 border-b border-[#1a1a1a]">
              <label className="block mb-2 text-[14px]">Slack webhook URL</label>
              <input
                type="text"
                value={state.slackWebhook}
                onChange={(e) => updateSetting("slackWebhook", e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-2 text-[13px] font-mono focus:outline-none focus:border-white"
              />
              <p className="text-[12px] text-[#aaaaaa] mt-2">Send compliance updates to Slack</p>
            </div>
          </div>
        </section>

        {/* IDE Integration */}
        <section className="animate-fade-in-up delay-700">
          <h2 className="text-[13px] uppercase tracking-wider text-[#aaaaaa] mb-6">IDE Integration</h2>
          <div className="space-y-6">
            <div className="py-4 border-b border-[#1a1a1a]">
              <p className="text-[14px] mb-2">VS Code Extension</p>
              <p className="text-[12px] text-[#aaaaaa] mb-4">
                Get real-time compliance feedback as you code
              </p>
              <button className="px-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] text-[13px] hover:bg-[#111] transition-colors">
                Download Extension →
              </button>
            </div>

            <div className="py-4 border-b border-[#1a1a1a]">
              <p className="text-[14px] mb-2">JetBrains Plugin</p>
              <p className="text-[12px] text-[#aaaaaa] mb-4">
                Support for IntelliJ IDEA, PyCharm, WebStorm, and more
              </p>
              <button className="px-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] text-[13px] hover:bg-[#111] transition-colors">
                Coming Soon
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
