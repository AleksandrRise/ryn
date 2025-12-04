"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"

export function usePoofEffect() {
  const [isPoofing, setIsPoofing] = useState(false)

  const triggerPoof = useCallback((message?: string) => {
    setIsPoofing(true)

    // Show success toast with spooky message
    toast.success(message || "Ghost banished!", {
      description: "The spirit has been laid to rest",
      icon: "👻",
    })

    // Reset after animation completes
    setTimeout(() => {
      setIsPoofing(false)
    }, 1000)
  }, [])

  return {
    isPoofing,
    triggerPoof,
  }
}
