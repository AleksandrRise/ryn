"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"

interface BanishGhostAnimationProps {
  isVisible: boolean
  onComplete?: () => void
  severity?: "critical" | "high" | "medium" | "low"
}

export function BanishGhostAnimation({ isVisible, onComplete, severity = "medium" }: BanishGhostAnimationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])

  useEffect(() => {
    if (isVisible) {
      // Generate random particles
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
      }))
      setParticles(newParticles)

      // Complete after animation
      const timer = setTimeout(() => {
        onComplete?.()
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [isVisible, onComplete])

  const particleColor = {
    critical: "bg-red-400",
    high: "bg-orange-400",
    medium: "bg-yellow-400",
    low: "bg-blue-400"
  }[severity]

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          {/* Ghost being banished */}
          <motion.div
            initial={{ scale: 1, rotate: 0, opacity: 1 }}
            animate={{
              scale: [1, 1.2, 0],
              rotate: [0, 180, 360],
              opacity: [1, 0.8, 0],
            }}
            transition={{
              duration: 0.6,
              ease: [0.68, -0.55, 0.265, 1.55]
            }}
            className="relative"
          >
            <div className="text-8xl drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]">
              👻
            </div>

            {/* Sparkle effect */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.6,
                times: [0, 0.5, 1]
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="text-6xl">✨</div>
            </motion.div>
          </motion.div>

          {/* Particle explosion */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              animate={{
                x: particle.x,
                y: particle.y,
                scale: [1, 0.5, 0],
                opacity: [1, 0.8, 0],
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut"
              }}
              className={`absolute w-3 h-3 rounded-full ${particleColor} blur-sm`}
            />
          ))}

          {/* Purple/orange ring expansion */}
          <motion.div
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{
              scale: [0, 3],
              opacity: [0.8, 0],
            }}
            transition={{
              duration: 0.6,
              ease: "easeOut"
            }}
            className="absolute w-32 h-32 rounded-full border-4 border-purple-500"
          />

          <motion.div
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{
              scale: [0, 2.5],
              opacity: [0.6, 0],
            }}
            transition={{
              duration: 0.6,
              delay: 0.1,
              ease: "easeOut"
            }}
            className="absolute w-32 h-32 rounded-full border-4 border-orange-500"
          />

          {/* "POOF" text */}
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 0 }}
            animate={{
              scale: [0, 1.5, 1],
              opacity: [0, 1, 0],
              y: [0, -50, -80],
            }}
            transition={{
              duration: 0.8,
              times: [0, 0.3, 1],
              ease: "easeOut"
            }}
            className="absolute text-4xl font-bold text-purple-300 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]"
            style={{ fontFamily: 'Impact, sans-serif' }}
          >
            POOF!
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
