"use client"

import { motion } from "framer-motion"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

export function HalloweenToggle() {
  const { isEnabled, soundEnabled, toggle, toggleSound } = useHalloweenTheme()

  return (
    <div className="space-y-3">
      {/* Main theme toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-orange-500/10 border border-purple-500/20">
        <div className="flex items-center gap-3">
          <motion.span
            animate={isEnabled ? { rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-2xl"
          >
            🎃
          </motion.span>
          <div>
            <p className="text-sm font-medium">Halloween Mode</p>
            <p className="text-xs text-white/50">Spooky ghosts & haunted UI</p>
          </div>
        </div>
        
        <button
          onClick={toggle}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            isEnabled ? "bg-purple-500" : "bg-white/20"
          }`}
        >
          <motion.div
            animate={{ x: isEnabled ? 28 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg flex items-center justify-center"
          >
            <span className="text-xs">{isEnabled ? "👻" : "🌙"}</span>
          </motion.div>
        </button>
      </div>

      {/* Sound toggle (only visible when Halloween mode is on) */}
      {isEnabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔊</span>
            <div>
              <p className="text-sm font-medium">Spooky Sounds</p>
              <p className="text-xs text-white/50">Ambient creepy audio</p>
            </div>
          </div>
          
          <button
            onClick={toggleSound}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              soundEnabled ? "bg-orange-500" : "bg-white/20"
            }`}
          >
            <motion.div
              animate={{ x: soundEnabled ? 28 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
            />
          </button>
        </motion.div>
      )}
    </div>
  )
}
