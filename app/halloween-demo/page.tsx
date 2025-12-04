"use client"

import { useState } from "react"
import { HauntedHouse } from "@/components/halloween/HauntedHouse"
import { HauntingMeter } from "@/components/halloween/HauntingMeter"
import { BanishGhostAnimation } from "@/components/halloween/BanishGhostAnimation"
import { HalloweenToggle } from "@/components/halloween/HalloweenToggle"
import { usePoofEffect } from "@/lib/hooks/usePoofEffect"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"
import type { Violation } from "@/lib/types/violation"

// Mock violations for demo
const mockViolations: Violation[] = [
  {
    id: 1,
    scanId: 1,
    controlId: "CC6.1",
    severity: "critical",
    description: "Hardcoded API key detected in authentication module",
    codeSnippet: 'const API_KEY = "sk-1234567890abcdef"',
    lineNumber: 42,
    filePath: "src/auth/api-client.ts",
    status: "open",
    detectedAt: new Date().toISOString(),
    detectionMethod: "llm",
    confidenceScore: 0.95,
  },
  {
    id: 2,
    scanId: 1,
    controlId: "CC6.7",
    severity: "high",
    description: "SQL injection vulnerability in user query",
    codeSnippet: 'db.query("SELECT * FROM users WHERE id = " + userId)',
    lineNumber: 156,
    filePath: "src/database/queries.ts",
    status: "open",
    detectedAt: new Date().toISOString(),
    detectionMethod: "hybrid",
    confidenceScore: 0.88,
  },
  {
    id: 3,
    scanId: 1,
    controlId: "CC7.2",
    severity: "medium",
    description: "Insufficient logging for security events",
    codeSnippet: "// TODO: Add audit logging",
    lineNumber: 89,
    filePath: "src/security/audit.ts",
    status: "open",
    detectedAt: new Date().toISOString(),
    detectionMethod: "regex",
  },
  {
    id: 4,
    scanId: 1,
    controlId: "A1.2",
    severity: "low",
    description: "Missing error handling in async function",
    codeSnippet: "async function fetchData() { return await api.get() }",
    lineNumber: 23,
    filePath: "src/utils/api.ts",
    status: "open",
    detectedAt: new Date().toISOString(),
    detectionMethod: "regex",
  },
]

export default function HalloweenDemoPage() {
  const [scanProgress, setScanProgress] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const { isPoofing, triggerPoof } = usePoofEffect()
  const { isEnabled } = useHalloweenTheme()

  const startDemoScan = () => {
    setIsScanning(true)
    setScanProgress(0)

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsScanning(false)
          return 100
        }
        return prev + 5
      })
    }, 200)
  }

  const triggerBanish = () => {
    triggerPoof("Demo ghost banished! 👻")
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎃 Halloween Theme Demo</h1>
          <p className="text-white/60">
            Interactive showcase of all Halloween components and features
          </p>
        </div>

        {/* Theme Status */}
        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium mb-1">
                Theme Status: {isEnabled ? "🎃 Enabled" : "🌙 Disabled"}
              </p>
              <p className="text-xs text-white/50">
                {isEnabled
                  ? "Spooky mode is active! All components will render with Halloween theme."
                  : "Enable Halloween mode in the toggle below to see the magic."}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Theme Toggle */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold mb-4">Theme Controls</h2>
            <HalloweenToggle />
          </div>

          {/* Demo Actions */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold mb-4">Demo Actions</h2>
            <div className="space-y-3">
              <button
                onClick={startDemoScan}
                disabled={isScanning}
                className="w-full px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isScanning ? "Scanning..." : "▶️ Start Demo Scan"}
              </button>
              <button
                onClick={triggerBanish}
                className="w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 transition-colors text-sm font-medium"
              >
                💥 Trigger Banish Animation
              </button>
            </div>
          </div>
        </div>

        {/* Haunting Meter Demo */}
        {isScanning && (
          <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold mb-4">Haunting Meter</h2>
            <HauntingMeter progress={scanProgress} />
          </div>
        )}

        {/* Haunted House Demo */}
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-lg font-semibold mb-4">Haunted House Violations</h2>
          <HauntedHouse
            violations={mockViolations}
            onViolationClick={(v) => console.log("Clicked violation:", v)}
            isScanning={isScanning}
            scanProgress={scanProgress}
          />
        </div>

        {/* Feature List */}
        <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-orange-500/10 border border-purple-500/20">
          <h2 className="text-lg font-semibold mb-4">✨ Features Included</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-purple-300 mb-2">Components</h3>
              <ul className="space-y-1 text-white/60">
                <li>👻 Floating ghost violation cards</li>
                <li>🏚️ Haunted house container</li>
                <li>🔮 Spooky progress meter</li>
                <li>💥 Banish ghost animation</li>
                <li>🎃 Theme toggle controls</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-orange-300 mb-2">Easter Eggs</h3>
              <ul className="space-y-1 text-white/60">
                <li>🦇 Random bat swoops</li>
                <li>🎃 Pumpkin cursor on hover</li>
                <li>🕸️ Cobweb decorations</li>
                <li>✨ Particle effects</li>
                <li>🌫️ Atmospheric mist</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Usage Hint */}
        <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-200">
            💡 <strong>Tip:</strong> Navigate to the Scan page with a real project to see the
            Halloween theme in action with actual violations. The theme persists across sessions!
          </p>
        </div>
      </div>

      {/* Banish Animation Overlay */}
      <BanishGhostAnimation
        isVisible={isPoofing}
        severity="critical"
      />
    </div>
  )
}
