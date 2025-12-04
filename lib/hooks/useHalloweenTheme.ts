"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "ryn-halloween-mode"

export function useHalloweenTheme() {
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

  return {
    isEnabled,
    isLoaded,
    toggle,
    enable,
    disable,
  }
}
