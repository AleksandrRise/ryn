"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useHalloweenThemeContext } from "@/lib/context/HalloweenContext"

export function HalloweenBackground() {
  const { isEnabled } = useHalloweenThemeContext()

  return (
    <AnimatePresence>
      {isEnabled && (
        <>
          {/* Deep red background shift for entire UI */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-[3] pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(40, 10, 10, 0.6), rgba(60, 15, 15, 0.5), rgba(30, 8, 8, 0.6))",
            }}
          />

          {/* Main Halloween background overlay - dark red/purple tint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at top, rgba(139, 0, 0, 0.25), rgba(75, 38, 101, 0.2), transparent 70%)",
            }}
          />

          {/* Secondary overlay for depth - intense red glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(220, 20, 20, 0.1), rgba(139, 0, 0, 0.08), transparent 60%)",
            }}
          />

          {/* Blood red accent from edges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "linear-gradient(to right, rgba(139, 0, 0, 0.15), transparent 20%, transparent 80%, rgba(139, 0, 0, 0.15))",
            }}
          />

          {/* Animated fog effect with red tint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.08, 0.15, 0.08],
              scale: [1, 1.05, 1],
            }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 8, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 10, repeat: Infinity, ease: "easeInOut" },
            }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(circle at 30% 50%, rgba(180, 30, 30, 0.12), transparent 60%)",
            }}
          />

          {/* Vignette effect - darker on edges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[4] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.5) 100%)",
            }}
          />
        </>
      )}
    </AnimatePresence>
  )
}
