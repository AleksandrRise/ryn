"use client"

import { useReducer } from "react"
import { Button } from "@/components/ui/button"
import { Save, Download, Code, Database, Bell, Zap } from "lucide-react"

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

// Action types
type SettingsAction =
  | { type: "SET_AUTO_APPLY_LOW"; payload: boolean }
  | { type: "SET_AUTO_APPLY_MEDIUM"; payload: boolean }
  | { type: "SET_CONTINUOUS_MONITORING"; payload: boolean }
  | { type: "SET_AUTO_DETECT_FRAMEWORK"; payload: boolean }
  | { type: "SET_FRAMEWORK"; payload: string }
  | { type: "SET_SCAN_FREQUENCY"; payload: string }
  | { type: "SET_DATABASE_TYPE"; payload: string }
  | { type: "SET_CONNECTION_STRING"; payload: string }
  | { type: "SET_DESKTOP_NOTIFICATIONS"; payload: boolean }
  | { type: "SET_EMAIL_ALERTS"; payload: boolean }
  | { type: "SET_SLACK_WEBHOOK"; payload: string }

// Initial state
const initialState: SettingsState = {
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

// Reducer function
function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "SET_AUTO_APPLY_LOW":
      return { ...state, autoApplyLow: action.payload }
    case "SET_AUTO_APPLY_MEDIUM":
      return { ...state, autoApplyMedium: action.payload }
    case "SET_CONTINUOUS_MONITORING":
      return { ...state, continuousMonitoring: action.payload }
    case "SET_AUTO_DETECT_FRAMEWORK":
      return { ...state, autoDetectFramework: action.payload }
    case "SET_FRAMEWORK":
      return { ...state, framework: action.payload }
    case "SET_SCAN_FREQUENCY":
      return { ...state, scanFrequency: action.payload }
    case "SET_DATABASE_TYPE":
      return { ...state, databaseType: action.payload }
    case "SET_CONNECTION_STRING":
      return { ...state, connectionString: action.payload }
    case "SET_DESKTOP_NOTIFICATIONS":
      return { ...state, desktopNotifications: action.payload }
    case "SET_EMAIL_ALERTS":
      return { ...state, emailAlerts: action.payload }
    case "SET_SLACK_WEBHOOK":
      return { ...state, slackWebhook: action.payload }
    default:
      return state
  }
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
  const [state, dispatch] = useReducer(settingsReducer, initialState)

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">Settings</h1>
          <p className="text-lg text-white/60">Configure compliance scanning and integrations</p>
        </div>
        <div className="flex gap-3">
          <Button size="lg" variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button size="lg" className="gap-2">
            <Save className="w-4 h-4" />
            Save Changes
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
                onChange={() => dispatch({ type: "SET_AUTO_DETECT_FRAMEWORK", payload: !state.autoDetectFramework })}
              />
            </div>

            {!state.autoDetectFramework && (
              <div>
                <label className="block mb-2 text-sm font-medium">Select framework</label>
                <select
                  value={state.framework}
                  onChange={(e) => dispatch({ type: "SET_FRAMEWORK", payload: e.target.value })}
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
                onClick={() => dispatch({ type: "SET_AUTO_APPLY_LOW", payload: !state.autoApplyLow })}
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
                onClick={() => dispatch({ type: "SET_AUTO_APPLY_MEDIUM", payload: !state.autoApplyMedium })}
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
                onClick={() => dispatch({ type: "SET_CONTINUOUS_MONITORING", payload: !state.continuousMonitoring })}
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
                onChange={(e) => dispatch({ type: "SET_SCAN_FREQUENCY", payload: e.target.value })}
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
                onChange={(e) => dispatch({ type: "SET_DATABASE_TYPE", payload: e.target.value })}
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
                onChange={(e) => dispatch({ type: "SET_CONNECTION_STRING", payload: e.target.value })}
                placeholder="postgresql://user:password@localhost:5432/dbname"
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-2 text-[13px] font-mono focus:outline-none focus:border-white"
              />
              <p className="text-[12px] text-[#aaaaaa] mt-2">Used for scanning database access patterns</p>
            </div>

            <div className="space-y-4">
              <button className="text-[13px] hover:underline">Clear scan history</button>
              <span className="text-[#aaaaaa] mx-2">•</span>
              <button className="text-[13px] hover:underline">Export all data</button>
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
                onClick={() => dispatch({ type: "SET_DESKTOP_NOTIFICATIONS", payload: !state.desktopNotifications })}
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
                onClick={() => dispatch({ type: "SET_EMAIL_ALERTS", payload: !state.emailAlerts })}
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
                onChange={(e) => dispatch({ type: "SET_SLACK_WEBHOOK", payload: e.target.value })}
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
