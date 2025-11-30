"use client"

import type { ViolationSeverity, Violation } from "@/lib/types"

interface SeverityFilterProps {
  selected: ViolationSeverity | "all"
  onSelect: (value: ViolationSeverity | "all") => void
  violations: Violation[]
}

const OPTIONS: Array<ViolationSeverity | "all"> = ["all", "critical", "high", "medium", "low"]

export function SeverityFilter({ selected, onSelect, violations }: SeverityFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 animate-fade-in-up delay-200">
      {OPTIONS.map((severity) => {
        const count = severity === "all"
          ? violations.length
          : violations.filter((v) => v.severity === severity).length

        return (
          <button
            key={severity}
            onClick={() => onSelect(severity)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all border ${
              selected === severity
                ? "bg-white/15 text-white border-white/20 shadow-sm"
                : "bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:text-white"
            }`}
          >
            {severity} <span className="ml-1 opacity-60">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
