"use client"

import { motion } from "framer-motion"
import { Violation } from "@/lib/types/violation"
import { SpookyViolationCard } from "./SpookyViolationCard"
import { useHalloweenThemeContext } from "@/lib/context/HalloweenContext"
import { HauntingMeter } from "./HauntingMeter"

interface HauntedHouseProps {
  violations: Violation[]
  onViolationClick?: (violation: Violation) => void
  isScanning?: boolean
  scanProgress?: number
}

export function HauntedHouse({ violations, onViolationClick, isScanning, scanProgress }: HauntedHouseProps) {
  const { isEnabled } = useHalloweenThemeContext()

  if (!isEnabled) {
    return (
      <div className="space-y-3">
        {violations.map((violation, index) => (
          <SpookyViolationCard
            key={violation.id}
            violation={violation}
            onClick={() => onViolationClick?.(violation)}
            index={index}
          />
        ))}
      </div>
    )
  }

  const criticalCount = violations.filter(v => v.severity === "critical").length
  const highCount = violations.filter(v => v.severity === "high").length

  return (
    <div className="relative">
      {/* Haunted atmosphere background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-orange-900/10 pointer-events-none rounded-2xl" />
      
      {/* Floating mist effect */}
      <motion.div
        animate={{
          opacity: [0.1, 0.3, 0.1],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-500/5 to-transparent blur-2xl pointer-events-none"
      />

      {/* Scanning haunting meter */}
      {isScanning && scanProgress !== undefined && (
        <div className="mb-6">
          <HauntingMeter progress={scanProgress} />
        </div>
      )}

      {/* Header with spooky stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-orange-500/10 border border-purple-500/20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-3xl"
            >
              🏚️
            </motion.span>
            <div>
              <h3 className="text-sm font-semibold text-purple-200">Haunted Code Mansion</h3>
              <p className="text-xs text-white/50 mt-0.5">
                {violations.length === 0 ? "No spirits detected" : `${violations.length} spirits haunting your code`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {criticalCount > 0 && (
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-xl"
                >
                  💀
                </motion.span>
                <div>
                  <div className="text-lg font-bold text-red-400">{criticalCount}</div>
                  <div className="text-[10px] text-red-300/60 uppercase tracking-wider">Vengeful</div>
                </div>
              </div>
            )}
            {highCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xl">🎃</span>
                <div>
                  <div className="text-lg font-bold text-orange-400">{highCount}</div>
                  <div className="text-[10px] text-orange-300/60 uppercase tracking-wider">Restless</div>
                </div>
              </div>
            )}
            {violations.length === 0 && (
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="text-xl"
                >
                  ✨
                </motion.span>
                <div>
                  <div className="text-lg font-bold text-emerald-400">Blessed</div>
                  <div className="text-[10px] text-emerald-300/60 uppercase tracking-wider">Ghost-free</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Violations grid - "haunted rooms" */}
      {violations.length > 0 ? (
        <div className="space-y-3">
          {violations.map((violation, index) => (
            <SpookyViolationCard
              key={violation.id}
              violation={violation}
              onClick={() => onViolationClick?.(violation)}
              index={index}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <motion.div
            animate={{
              y: [0, -10, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-6xl mb-4"
          >
            🕯️
          </motion.div>
          <p className="text-lg font-medium text-purple-200 mb-2">The mansion is peaceful</p>
          <p className="text-sm text-white/50">No ghosts detected in your code</p>
        </motion.div>
      )}

      {/* Cobwebs in corners */}
      <svg className="absolute top-0 left-0 w-24 h-24 text-white/5 pointer-events-none" viewBox="0 0 100 100">
        <path d="M0 0 L50 25 L100 0 M0 0 L25 50 L0 100 M0 0 L100 100" stroke="currentColor" strokeWidth="1" fill="none" />
        <circle cx="0" cy="0" r="3" fill="currentColor" />
        <circle cx="50" cy="25" r="2" fill="currentColor" />
        <circle cx="25" cy="50" r="2" fill="currentColor" />
      </svg>
      
      <svg className="absolute bottom-0 right-0 w-24 h-24 text-white/5 pointer-events-none rotate-180" viewBox="0 0 100 100">
        <path d="M0 0 L50 25 L100 0 M0 0 L25 50 L0 100 M0 0 L100 100" stroke="currentColor" strokeWidth="1" fill="none" />
        <circle cx="0" cy="0" r="3" fill="currentColor" />
        <circle cx="50" cy="25" r="2" fill="currentColor" />
        <circle cx="25" cy="50" r="2" fill="currentColor" />
      </svg>
    </div>
  )
}
