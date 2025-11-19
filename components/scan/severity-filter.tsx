"use client"

import type { Severity } from "@/lib/types/violation"
import type { Violation } from "@/lib/types/violation"

interface SeverityFilterProps {
  selected: Severity | "all"
  onSelect: (value: Severity | "all") => void
  violations: Violation[]
}

const OPTIONS: Array<Severity | "all"> = ["all", "critical", "high", "medium", "low"]

export function SeverityFilter({ selected, onSelect, violations }: SeverityFilterProps) {
  return (
    <div className="mb-6 flex gap-3 animate-fade-in-up delay-400">
      {OPTIONS.map((severity) => {
        const count = severity === "all"
          ? violations.length
          : violations.filter((v) => v.severity === severity).length

        return (
          <button
            key={severity}
            onClick={() => onSelect(severity)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-all ${
              selected === severity
                ? "bg-white/20 text-white shadow-lg"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            }`}
          >
            {severity} <span className="ml-2 opacity-60">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
