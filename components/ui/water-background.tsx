"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export interface WaterBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  speed?: number
  intensity?: number
  rippleCount?: number
}

export function WaterBackground({
  className,
  speed = 0.25,
  intensity = 0.15,
  rippleCount = 4,
  ...props
}: WaterBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const ripplesRef = useRef<Array<{ x: number; y: number; offset: number }>>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const ripples = []
      for (let i = 0; i < rippleCount; i++) {
        const angle = (i / rippleCount) * Math.PI * 2
        const distance = Math.min(window.innerWidth, window.innerHeight) * 0.3
        ripples.push({
          x: window.innerWidth / 2 + Math.cos(angle) * distance,
          y: window.innerHeight / 2 + Math.sin(angle) * distance,
          offset: (i / rippleCount) * Math.PI * 2,
        })
      }
      ripplesRef.current = ripples
    }

    resize()
    window.addEventListener("resize", resize)

    const animate = () => {
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const time = Date.now() * 0.001 * speed
      const ripples = ripplesRef.current

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const cellSize = 3 // Sample every 3 pixels for performance

      for (let y = 0; y < canvas.height; y += cellSize) {
        for (let x = 0; x < canvas.width; x += cellSize) {
          let rippleEffect = 0

          // Calculate interference from all ripple sources
          for (let i = 0; i < ripples.length; i++) {
            const ripple = ripples[i]
            const dx = x - ripple.x
            const dy = y - ripple.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            // Multiple wave frequencies for realistic water
            const wave1 = Math.sin(distance * 0.02 - time * 2 + ripple.offset)
            const wave2 = Math.sin(distance * 0.015 - time * 1.5 + ripple.offset) * 0.5
            const wave3 = Math.sin(distance * 0.03 - time * 2.5 + ripple.offset) * 0.3

            // Distance-based attenuation
            const attenuation = 1 / (1 + distance * 0.001)
            rippleEffect += (wave1 + wave2 + wave3) * attenuation
          }

          // Add central stationary ripple
          const centerDx = x - canvas.width / 2
          const centerDy = y - canvas.height / 2
          const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy)
          const centerWave = Math.sin(centerDist * 0.025 - time * 2) * 0.4
          const centerAttenuation = 1 / (1 + centerDist * 0.0008)
          rippleEffect += centerWave * centerAttenuation

          // Convert ripple effect to grayscale intensity
          const brightness = Math.floor(rippleEffect * intensity * 255)
          const gray = Math.max(0, Math.min(255, 51 + brightness)) // Dark background (20%)

          // Fill cellSize x cellSize block
          for (let dy = 0; dy < cellSize && y + dy < canvas.height; dy++) {
            for (let dx = 0; dx < cellSize && x + dx < canvas.width; dx++) {
              const idx = ((y + dy) * canvas.width + (x + dx)) * 4
              data[idx] = gray // R
              data[idx + 1] = gray // G
              data[idx + 2] = gray // B
              data[idx + 3] = 255 // A
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0)

      frameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(frameRef.current)
    }
  }, [speed, intensity, rippleCount])

  return (
    <div className={cn("fixed inset-0 -z-10", className)} {...props}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

export default WaterBackground
