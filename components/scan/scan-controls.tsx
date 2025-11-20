"use client"

import { Check, Shield } from "lucide-react"

interface ScanControlsProps {
  selectedControls: Record<string, boolean>
  onToggle: (control: string) => void
}

const CONTROL_COPY: Record<string, string> = {
  "CC6.1": "Access Controls",
  "CC6.7": "Encryption & Secrets",
  "CC7.2": "Logging & Monitoring",
  "A1.2": "Data Availability",
}

export function ScanControls({ selectedControls, onToggle }: ScanControlsProps) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-white/5 rounded-lg">
          <Shield className="w-5 h-5 text-white/60" />
        </div>
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">SOC 2 Controls</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(selectedControls).map(([control, checked]) => (
          <button
            key={control}
            onClick={() => onToggle(control)}
            className={`relative overflow-hidden rounded-xl px-5 py-4 text-left transition-all duration-300 border-2 ${
              checked
                ? "bg-white/20 text-white border-white/20 shadow-lg"
                : "bg-black/40 text-white/60 border-white/10 hover:border-white/15"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold tracking-wide">{control}</p>
              {checked && <Check className="w-4 h-4" />}
            </div>
            <p className={`text-xs ${checked ? "text-white/70" : "text-white/40"}`}>
              {CONTROL_COPY[control] || "Control"}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
