"use client"

import { Github, ExternalLink } from "lucide-react"

export function TopNav() {
  const scrollToTop = () => {
    // Smooth scroll with easing
    const startPosition = window.scrollY
    const targetPosition = 0
    const distance = targetPosition - startPosition
    const duration = 1200 // 1.2 seconds for slower scroll
    let start: number | null = null

    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    const animation = (currentTime: number) => {
      if (start === null) start = currentTime
      const elapsed = currentTime - start
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = easeInOutCubic(progress)

      window.scrollTo(0, startPosition + distance * easeProgress)

      if (progress < 1) {
        requestAnimationFrame(animation)
      }
    }

    requestAnimationFrame(animation)
  }

  return (
    <nav className="sticky top-0 z-[100] bg-black border-b border-white/10 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img src="/ryn-logo.svg" alt="Ryn" className="w-8 h-8" />
        </div>

        <div className="flex items-center space-x-4">
          <a
            href="https://github.com/AleksandrRise/ryn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-sm text-white/60 hover:text-white transition-colors duration-200"
          >
            <Github size={18} />
            <span>GitHub</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </nav>
  )
}
