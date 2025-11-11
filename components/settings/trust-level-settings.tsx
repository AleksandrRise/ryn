"use client"

import { useState } from "react"
import { Shield } from "lucide-react"

export function TrustLevelSettings() {
  const [settings, setSettings] = useState({
    autoApplyLowRisk: true,
    requirePreviewMediumRisk: true,
    manualReviewHighRisk: true,
  })

  const handleToggle = (key: keyof typeof settings) => {
    setSettings({ ...settings, [key]: !settings[key] })
    console.log("[v0] Trust level setting updated:", key)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Trust Levels</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Control how AI-generated fixes are handled based on risk assessment
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
          <div>
            <h3 className="text-sm font-medium text-foreground">Auto-apply Low Risk Fixes</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically apply fixes with minimal impact (e.g., adding comments, formatting)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoApplyLowRisk}
              onChange={() => handleToggle("autoApplyLowRisk")}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
          <div>
            <h3 className="text-sm font-medium text-foreground">Require Preview for Medium Risk</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Show preview and require approval for moderate changes (e.g., env var migration)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.requirePreviewMediumRisk}
              onChange={() => handleToggle("requirePreviewMediumRisk")}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
          <div>
            <h3 className="text-sm font-medium text-foreground">Manual Review for High Risk</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Require explicit review for critical changes (e.g., authentication logic)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.manualReviewHighRisk}
              onChange={() => handleToggle("manualReviewHighRisk")}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>
    </div>
  )
}
