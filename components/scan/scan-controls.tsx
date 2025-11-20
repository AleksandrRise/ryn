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
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/50">
        <Shield className="w-3.5 h-3.5" />
        Controls
      </div>
      {Object.entries(selectedControls).map(([control, checked]) => (
        <button
          key={control}
          onClick={() => onToggle(control)}
          className={`group relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors border ${
            checked
              ? "bg-white/15 text-white border-white/20 shadow-sm"
              : "bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:text-white"
          }`}
        >
          <span className="font-mono text-[11px] tracking-tight">{control}</span>
          <span className="text-[11px] text-white/60 group-hover:text-white/80">
            {CONTROL_COPY[control] || "Control"}
          </span>
          {checked && <Check className="w-3.5 h-3.5 text-emerald-300" />}
        </button>
      ))}
    </div>
  )
}
