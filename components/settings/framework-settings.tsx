"use client"

import { Code2 } from "lucide-react"
import { useState, useEffect } from "react"
import { get_settings, update_settings } from "@/lib/tauri/commands"
import { handleTauriError, showSuccess } from "@/lib/utils/error-handler"

export function FrameworkSettings() {
  const [framework, setFramework] = useState("auto")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load framework setting on mount
  useEffect(() => {
    const loadFrameworkSetting = async () => {
      try {
        const settings = await get_settings()
        const frameworkSetting = settings.find(s => s.key === "framework_override")
        if (frameworkSetting) {
          setFramework(frameworkSetting.value)
        }
      } catch (error) {
        handleTauriError(error, "Failed to load framework setting")
      } finally {
        setIsLoading(false)
      }
    }

    loadFrameworkSetting()
  }, [])

  // Handle framework change
  const handleFrameworkChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    setFramework(newValue)
    setIsSaving(true)

    try {
      await update_settings("framework_override", newValue)
      showSuccess("Framework setting saved successfully")
    } catch (error) {
      handleTauriError(error, "Failed to save framework setting")
      // Revert on error
      const settings = await get_settings()
      const frameworkSetting = settings.find(s => s.key === "framework_override")
      setFramework(frameworkSetting?.value || "auto")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Code2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Framework Detection</h2>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-surface rounded-lg">
          <h3 className="text-sm font-medium text-foreground mb-2">Override Framework</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Manually specify framework if auto-detection is incorrect
          </p>
          <select
            className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            value={framework}
            onChange={handleFrameworkChange}
            disabled={isLoading || isSaving}
          >
            <option value="auto">Auto-detect</option>
            <option value="django">Django</option>
            <option value="flask">Flask</option>
            <option value="express">Express.js</option>
            <option value="fastapi">FastAPI</option>
            <option value="rails">Ruby on Rails</option>
            <option value="spring">Spring Boot</option>
          </select>
          {isSaving && (
            <p className="text-xs text-muted-foreground mt-2">Saving...</p>
          )}
        </div>
      </div>
    </div>
  )
}
