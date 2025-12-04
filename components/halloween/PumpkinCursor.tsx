"use client"

import { useEffect } from "react"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

export function PumpkinCursor() {
  const { isEnabled } = useHalloweenTheme()

  useEffect(() => {
    if (!isEnabled) {
      document.body.style.cursor = ""
      return
    }

    // Add pumpkin cursor on violation cards
    const style = document.createElement("style")
    style.textContent = `
      .spooky-violation-card:hover {
        cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text y="24" font-size="24">🎃</text></svg>') 16 16, pointer;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
      document.body.style.cursor = ""
    }
  }, [isEnabled])

  return null
}
