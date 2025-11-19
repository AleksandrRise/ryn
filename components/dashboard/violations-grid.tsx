"use client"

import Link from "next/link"
import type { SeverityCounts } from "@/lib/types/scan"

interface ViolationsGridProps {
  counts: SeverityCounts
}

const CARDS = [
  {
    key: "critical" as const,
    title: "Critical",
    description: "Immediate action required",
    href: "/scan?severity=critical",
    accent: "from-red-500/10 to-transparent border-red-500/30 hover:border-red-500/60",
    text: "text-red-400",
    icon: "la la-exclamation-triangle",
  },
  {
    key: "high" as const,
    title: "High",
    description: "Fix within 24 hours",
    href: "/scan?severity=high",
    accent: "from-orange-500/10 to-transparent border-orange-500/30 hover:border-orange-500/60",
    text: "text-orange-400",
    icon: "la la-shield-alt",
  },
  {
    key: "medium" as const,
    title: "Medium",
    description: "Fix within 7 days",
    href: "/scan?severity=medium",
    accent: "from-yellow-500/10 to-transparent border-yellow-500/30 hover:border-yellow-500/60",
    text: "text-yellow-400",
    icon: "la la-file-alt",
  },
  {
    key: "low" as const,
    title: "Low",
    description: "Address when possible",
    href: "/scan?severity=low",
    accent: "from-gray-500/10 to-transparent border-white/10 hover:border-white/20",
    text: "text-white/60",
    icon: "la la-shield-alt",
  },
]

export function ViolationsGrid({ counts }: ViolationsGridProps) {
  return (
    <div className="col-span-8 grid grid-cols-2 gap-5 animate-fade-in-left delay-100">
      {CARDS.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className={`group relative overflow-hidden bg-gradient-to-br ${card.accent} rounded-3xl p-8 transition-all duration-500 cursor-pointer hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]`}
        >
          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors duration-300">
                <i className={`${card.icon} text-xl ${card.text}`}></i>
              </div>
              <span className={`text-xs font-semibold uppercase tracking-widest ${card.text}`}>{card.title}</span>
            </div>

            <div className="mb-6">
              <div className={`text-7xl font-extrabold tabular-nums leading-none mb-4 tracking-tighter ${card.text}`}>
                {counts[card.key]}
              </div>
              <p className="text-base font-medium text-white/60 leading-relaxed tracking-wide">{card.description}</p>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-white/50 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
              <span>View details</span>
              <i className="las la-arrow-right text-base"></i>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
