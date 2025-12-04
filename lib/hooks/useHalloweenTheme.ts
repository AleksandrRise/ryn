"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "ryn-halloween-mode"
const SOUND_STORAGE_KEY = "ryn-halloween-sound"

export function useHalloweenTheme() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY)
      const soundStored = localStorage.getItem(SOUND_STORAGE_KEY)
      setIsEnabled(stored === "true")
      setSoundEnabled(soundStored === "true")
      setIsLoaded(true)
    }
  }, [])

  // Persist to localStorage when changed
  useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(isEnabled))
    }
  }, [isEnabled, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled))
    }
  }, [soundEnabled, isLoaded])

  const toggle = useCallback(() => {
    setIsEnabled(prev => !prev)
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev)
  }, [])

  const enable = useCallback(() => {
    setIsEnabled(true)
  }, [])

  const disable = useCallback(() => {
    setIsEnabled(false)
  }, [])

  return {
    isEnabled,
    soundEnabled,
    isLoaded,
    toggle,
    toggleSound,
    enable,
    disable,
  }
}
