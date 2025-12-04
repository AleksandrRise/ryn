"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

export function BatSwoop() {
  const { isEnabled } = useHalloweenTheme()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isEnabled) return

    // Random bat swoops every 2-4 minutes
    const scheduleNextBat = () => {
      const delay = (120 + Math.random() * 120) * 1000 // 2-4 minutes
      return setTimeout(() => {
        setIsVisible(true)
        setTimeout(() => {
          setIsVisible(false)
          scheduleNextBat()
        }, 1500)
      }, delay)
    }

    const timer = scheduleNextBat()
    return () => clearTimeout(timer)
  }, [isEnabled])

  if (!isEnabled) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: -100, y: 50, rotate: -45, opacity: 0 }}
          animate={{
            x: ["-100vw", "50vw", "150vw"],
            y: [50, 30, 20],
            rotate: [-45, 0, 45],
            opacity: [0, 1, 1, 0],
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.5,
            times: [0, 0.3, 1],
            ease: "easeInOut"
          }}
          className="fixed top-20 left-0 z-50 pointer-events-none text-4xl"
        >
          🦇
        </motion.div>
      )}
    </AnimatePresence>
  )
}
