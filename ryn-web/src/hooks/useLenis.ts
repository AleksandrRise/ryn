"use client"

import { useEffect } from "react"
import Lenis from "lenis"

export function useLenis() {
  useEffect(() => {
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      try {
        const lenis = new Lenis({
          duration: 1.2,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          direction: "vertical" as const,
          gestureDirection: "vertical" as const,
          smooth: true,
          smoothTouch: false,
          touchMultiplier: 2,
        })

        let rafId: number

        const raf = (time: number) => {
          lenis.raf(time)
          rafId = requestAnimationFrame(raf)
        }

        rafId = requestAnimationFrame(raf)

        return () => {
          if (rafId) cancelAnimationFrame(rafId)
          lenis.destroy()
        }
      } catch (error) {
        console.error("Lenis initialization failed:", error)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])
}
