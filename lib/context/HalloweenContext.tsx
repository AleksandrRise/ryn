"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

interface HalloweenContextType {
  isEnabled: boolean
  isLoaded: boolean
  toggle: () => void
  enable: () => void
  disable: () => void
}

const HalloweenContext = createContext<HalloweenContextType | undefined>(undefined)

const STORAGE_KEY = "ryn-halloween-mode"

export function HalloweenThemeContextProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY)
      setIsEnabled(stored === "true")
      setIsLoaded(true)
    }
  }, [])

  // Persist to localStorage when changed
  useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(isEnabled))
    }
  }, [isEnabled, isLoaded])

  const toggle = useCallback(() => {
    setIsEnabled(prev => !prev)
  }, [])

  const enable = useCallback(() => {
    setIsEnabled(true)
  }, [])

  const disable = useCallback(() => {
    setIsEnabled(false)
  }, [])

  return (
    <HalloweenContext.Provider value={{ isEnabled, isLoaded, toggle, enable, disable }}>
      {children}
    </HalloweenContext.Provider>
  )
}

export function useHalloweenThemeContext() {
  const context = useContext(HalloweenContext)
  if (!context) {
    throw new Error("useHalloweenThemeContext must be used within HalloweenThemeContextProvider")
  }
  return context
}
