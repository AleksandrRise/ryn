"use client"

import { ReactNode } from "react"
import { BatSwoop } from "./BatSwoop"
import { PumpkinCursor } from "./PumpkinCursor"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"

interface HalloweenThemeProviderProps {
  children: ReactNode
}

export function HalloweenThemeProvider({ children }: HalloweenThemeProviderProps) {
  const { isEnabled } = useHalloweenTheme()

  return (
    <>
      {children}
      {isEnabled && (
        <>
          <BatSwoop />
          <PumpkinCursor />
        </>
      )}
    </>
  )
}
