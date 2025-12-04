"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

export function HalloweenBackground() {
  const { isEnabled } = useHalloweenTheme()

  return (
    <AnimatePresence>
      {isEnabled && (
        <>
          {/* Main Halloween background overlay - dark red/purple tint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at top, rgba(75, 38, 101, 0.3), rgba(139, 0, 0, 0.2), transparent 70%)",
            }}
          />
          
          {/* Secondary overlay for depth - orange glow from bottom */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at bottom, rgba(255, 140, 0, 0.15), transparent 50%)",
            }}
          />
          
          {/* Animated fog effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.05, 1],
            }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 8, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 10, repeat: Infinity, ease: "easeInOut" },
            }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(circle at 30% 50%, rgba(138, 43, 226, 0.1), transparent 60%)",
            }}
          />
          
          {/* Subtle vignette effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%)",
            }}
          />
        </>
      )}
    </AnimatePresence>
  )
}
