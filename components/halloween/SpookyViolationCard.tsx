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
      glow: "drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]",
      color: "text-red-400",
      bg: "from-red-500/20 to-purple-500/10",
      duration: 2,
      intensity: 1.5,
      label: "Vengeful Spirit"
    },
    high: {
      glow: "drop-shadow-[0_0_15px_rgba(255,140,0,0.6)]",
      color: "text-orange-400",
      bg: "from-orange-500/20 to-purple-500/10",
      duration: 3,
      intensity: 1.2,
      label: "Restless Ghost"
    },
    medium: {
      glow: "drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]",
      color: "text-yellow-400",
      bg: "from-yellow-500/15 to-purple-500/10",
      duration: 4,
      intensity: 1,
      label: "Wandering Spirit"
    },
    low: {
      glow: "drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]",
      color: "text-blue-300",
      bg: "from-blue-500/15 to-purple-500/10",
      duration: 5,
      intensity: 0.8,
      label: "Faint Whisper"
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
      {/* Haunted background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.bg} rounded-xl blur-sm opacity-50 group-hover:opacity-70 transition-opacity`} />
      
      {/* Cobweb corner decoration */}
      <svg className="absolute -top-1 -right-1 w-8 h-8 text-white/10 group-hover:text-white/20 transition-colors" viewBox="0 0 32 32">
        <path d="M0 0 L32 0 L32 32 Z" fill="currentColor" opacity="0.3" />
        <path d="M0 0 L16 8 L32 0 M0 0 L8 16 L0 32 M32 0 L24 16 L32 32" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.5" />
      </svg>

      <div className="relative p-4 rounded-xl border border-white/10 bg-[#0a0b10]/80 backdrop-blur-sm">
        {/* Ghost icon with floating animation */}
        <motion.div
          animate={{
            y: [0, -8, 0],
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: config.duration,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-6 -right-2"
        >
          <div className={`text-4xl ${config.glow} ${config.color}`}>
            👻
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
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium">{violation.controlId}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 ${config.color} border border-current/30`}>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">{violation.description}</p>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40">
              <span>{violation.filePath.split('/').pop()}</span>
              <span>•</span>
              <span>Line {violation.lineNumber}</span>
            </div>
          </div>
        </div>

        {/* Hover effect - spooky glow */}
        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${config.bg} opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none`} />
      </div>
    </motion.div>
  )
}
