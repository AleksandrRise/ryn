"use client"

import { motion } from "framer-motion"
import { Violation } from "@/lib/types/violation"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

interface SpookyViolationCardProps {
  violation: Violation
  onClick?: () => void
  index?: number
}

export function SpookyViolationCard({ violation, onClick, index = 0 }: SpookyViolationCardProps) {
  const { isEnabled } = useHalloweenTheme()
  
  if (!isEnabled) {
    // Fallback to standard card
    return (
      <div
        onClick={onClick}
        className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 cursor-pointer transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-2 ${
            violation.severity === "critical" ? "bg-red-400" :
            violation.severity === "high" ? "bg-orange-400" :
            violation.severity === "medium" ? "bg-yellow-400" :
            "bg-blue-400"
          }`} />
          <div className="flex-1">
            <p className="text-sm font-medium">{violation.control_id}</p>
            <p className="text-xs text-white/60 mt-1">{violation.description}</p>
          </div>
        </div>
      </div>
    )
  }

  const severityConfig = {
    critical: {
      glow: "drop-shadow-[0_0_25px_rgba(220,38,38,1)]",
      color: "text-red-400",
      bg: "from-red-950/40 via-purple-950/30 to-black/20",
      duration: 2,
      intensity: 1.5,
      label: "Vengeful Phantom",
      emoji: "👿",
      borderColor: "border-red-500/50"
    },
    high: {
      glow: "drop-shadow-[0_0_20px_rgba(255,140,0,0.8)]",
      color: "text-orange-400",
      bg: "from-orange-950/40 via-purple-950/30 to-black/20",
      duration: 3,
      intensity: 1.2,
      label: "Angry Specter",
      emoji: "😈",
      borderColor: "border-orange-500/40"
    },
    medium: {
      glow: "drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]",
      color: "text-yellow-300",
      bg: "from-yellow-950/30 via-purple-950/25 to-black/20",
      duration: 4,
      intensity: 1,
      label: "Mischievous Ghost",
      emoji: "👻",
      borderColor: "border-yellow-500/30"
    },
    low: {
      glow: "drop-shadow-[0_0_12px_rgba(96,165,250,0.5)]",
      color: "text-blue-300",
      bg: "from-blue-950/30 via-purple-950/25 to-black/20",
      duration: 5,
      intensity: 0.8,
      label: "Faint Whisper",
      emoji: "👼",
      borderColor: "border-blue-500/25"
    }
  }

  const config = severityConfig[violation.severity]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      onClick={onClick}
      className="relative group cursor-pointer"
    >
      {/* Haunted background glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.bg} rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-all duration-300`} />

      {/* Spooky border highlight */}
      <div className={`absolute inset-0 rounded-xl ${config.borderColor} opacity-0 group-hover:opacity-50 transition-opacity duration-300 blur-[1px]`} />

      {/* Cobweb corner decoration */}
      <svg className="absolute -top-2 -right-2 w-10 h-10 text-white/5 group-hover:text-white/15 transition-all duration-300" viewBox="0 0 32 32">
        <path d="M0 0 L32 0 L32 32 Z" fill="currentColor" opacity="0.4" />
        <path d="M0 0 L16 8 L32 0 M0 0 L8 16 L0 32 M32 0 L24 16 L32 32" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.6" />
      </svg>

      <div className={`relative p-4 rounded-xl ${config.borderColor} bg-[#0a0b12]/90 backdrop-blur-md border-2 group-hover:bg-[#0d0e18]/95 transition-colors duration-300`}>
        {/* Ghostly spirit icon with intense floating animation */}
        <motion.div
          animate={{
            y: [0, -10, 0],
            rotate: [-3, 3, -3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: config.duration,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-7 -right-3"
        >
          <div className={`text-5xl ${config.glow} ${config.color} filter`}>
            {config.emoji}
          </div>
        </motion.div>

        <div className="flex items-start gap-3">
          {/* Severity indicator */}
          <motion.div
            animate={{
              scale: [1, config.intensity, 1],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: config.duration * 0.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={`w-3 h-3 rounded-full mt-2 ${
              violation.severity === "critical" ? "bg-red-400" :
              violation.severity === "high" ? "bg-orange-400" :
              violation.severity === "medium" ? "bg-yellow-400" :
              "bg-blue-400"
            } ${config.glow}`}
          />

          <div className="flex-1 pr-8">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-bold text-white">{violation.controlId}</p>
              <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${config.color} border ${config.borderColor} bg-gradient-to-r ${config.bg.split(' ').slice(0, 3).join(' ')}`}>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed font-medium">{violation.description}</p>
            <div className="flex items-center gap-2 mt-3 text-[10px] text-white/50 font-mono">
              <span className="truncate">{violation.filePath.split('/').pop()}</span>
              <span className={config.color}>•</span>
              <span>L{violation.lineNumber}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
