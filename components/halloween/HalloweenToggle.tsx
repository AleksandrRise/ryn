"use client"

import { motion } from "framer-motion"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

export function HalloweenToggle() {
  const { isEnabled, toggle } = useHalloweenTheme()

  return (
    <div className="relative">
      <motion.div
        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-300 ${
          isEnabled
            ? "bg-gradient-to-br from-purple-950/40 to-orange-950/40 border-purple-500/50 shadow-lg shadow-purple-500/20"
            : "bg-white/5 border-white/10 hover:border-white/20"
        }`}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={isEnabled ? { rotate: [0, 15, -15, 0], y: [0, -2, 2, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-3xl"
          >
            🎃
          </motion.div>
          <div>
            <p className="text-sm font-semibold text-white">Haunted Mode</p>
            <p className="text-xs text-white/60">
              {isEnabled
                ? "Ghosts & ghouls have taken over"
                : "Summon the Halloween spirits"}
            </p>
          </div>
        </div>

        <button
          onClick={toggle}
          className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
            isEnabled
              ? "bg-gradient-to-r from-purple-600 to-orange-600 shadow-lg shadow-purple-500/50"
              : "bg-white/10 hover:bg-white/15"
          }`}
        >
          <motion.div
            animate={{ x: isEnabled ? 32 : 2 }}
            transition={{ type: "spring", stiffness: 600, damping: 25 }}
            className={`absolute top-1.5 w-5 h-5 rounded-full shadow-md flex items-center justify-center text-xs font-bold ${
              isEnabled ? "bg-white text-purple-600" : "bg-white/40 text-white"
            }`}
          >
            {isEnabled ? "👻" : "☀️"}
          </motion.div>
        </button>
      </motion.div>

      {/* Decorative cobweb effect when enabled */}
      {isEnabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className="absolute -top-2 -left-2 text-2xl"
        >
          🕷️
        </motion.div>
      )}
    </div>
  )
}
