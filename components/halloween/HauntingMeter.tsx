"use client"

import { motion } from "framer-motion"

interface HauntingMeterProps {
  progress: number // 0-100
}

export function HauntingMeter({ progress }: HauntingMeterProps) {
  const ghostCount = Math.min(Math.floor(progress / 20), 5)

  return (
    <div className="relative">
      <div className="flex items-center gap-3 mb-2">
        <motion.span
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-2xl"
        >
          🔮
        </motion.span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-purple-200">Summoning spirits...</span>
            <span className="text-xs text-purple-300/60">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Progress bar container */}
      <div className="relative h-8 rounded-full bg-black/40 border border-purple-500/30 overflow-hidden">
        {/* Ghostly fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500/40 via-purple-400/30 to-orange-500/40"
        >
          {/* Animated shimmer */}
          <motion.div
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        </motion.div>

        {/* Floating ghost icons inside bar */}
        <div className="absolute inset-0 flex items-center justify-around px-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: i < ghostCount ? 1 : 0.2,
                scale: i < ghostCount ? 1 : 0.5,
                y: i < ghostCount ? [0, -4, 0] : 0,
              }}
              transition={{
                opacity: { duration: 0.3 },
                scale: { duration: 0.3 },
                y: {
                  duration: 1.5 + i * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="text-sm"
            >
              👻
            </motion.span>
          ))}
        </div>

        {/* Pulsing glow effect */}
        <motion.div
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-orange-500/20 blur-sm"
        />
      </div>

      {/* Spooky particles */}
      <div className="absolute -top-2 left-0 right-0 h-12 pointer-events-none">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 0, x: `${i * 30}%` }}
            animate={{
              opacity: [0, 0.6, 0],
              y: [-20, -40],
              x: `${i * 30 + Math.sin(i) * 10}%`,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.7,
              ease: "easeOut"
            }}
            className="absolute w-1 h-1 bg-purple-400 rounded-full blur-sm"
          />
        ))}
      </div>
    </div>
  )
}
