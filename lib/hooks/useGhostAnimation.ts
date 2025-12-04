"use client"

import { useReducedMotion } from "framer-motion"

export type GhostSeverity = "critical" | "high" | "medium" | "low"

interface GhostAnimationConfig {
  duration: number
  yOffset: number
  rotation: number
  scale: number
  glowIntensity: number
}

export function useGhostAnimation(severity: GhostSeverity) {
  const shouldReduceMotion = useReducedMotion()

  const configs: Record<GhostSeverity, GhostAnimationConfig> = {
    critical: {
      duration: 2,
      yOffset: 12,
      rotation: 3,
      scale: 1.5,
      glowIntensity: 0.8,
    },
    high: {
      duration: 3,
      yOffset: 10,
      rotation: 2,
      scale: 1.2,
      glowIntensity: 0.6,
    },
    medium: {
      duration: 4,
      yOffset: 8,
      rotation: 1.5,
      scale: 1,
      glowIntensity: 0.5,
    },
    low: {
      duration: 5,
      yOffset: 6,
      rotation: 1,
      scale: 0.8,
      glowIntensity: 0.4,
    },
  }

  const config = configs[severity]

  // Return static values if reduced motion is preferred
  if (shouldReduceMotion) {
    return {
      animate: {},
      transition: {},
      config: { ...config, duration: 0, yOffset: 0, rotation: 0 },
    }
  }

  return {
    animate: {
      y: [0, -config.yOffset, 0],
      rotate: [-config.rotation, config.rotation, -config.rotation],
      scale: [1, 1 + config.scale * 0.05, 1],
    },
    transition: {
      duration: config.duration,
      repeat: Infinity,
      ease: "easeInOut",
    },
    config,
  }
}
