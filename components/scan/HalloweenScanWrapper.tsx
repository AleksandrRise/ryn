"use client"

import { ReactNode } from "react"
import { useHalloweenTheme } from "@/lib/hooks/useHalloweenTheme"
import { HauntedHouse } from "@/components/halloween/HauntedHouse"
import { BanishGhostAnimation } from "@/components/halloween/BanishGhostAnimation"
import { usePoofEffect } from "@/lib/hooks/usePoofEffect"
import { Violation } from "@/lib/types/violation"

interface HalloweenScanWrapperProps {
  violations: Violation[]
  onViolationClick?: (violation: Violation) => void
  isScanning?: boolean
  scanProgress?: number
  children?: ReactNode
}

/**
 * Wrapper component that conditionally renders Halloween-themed violations
 * or falls back to standard violation list
 */
export function HalloweenScanWrapper({
  violations,
  onViolationClick,
  isScanning,
  scanProgress,
  children
}: HalloweenScanWrapperProps) {
  const { isEnabled } = useHalloweenTheme()
  const { isPoofing } = usePoofEffect()

  // If Halloween mode is enabled, render haunted house
  if (isEnabled) {
    return (
      <>
        <HauntedHouse
          violations={violations}
          onViolationClick={onViolationClick}
          isScanning={isScanning}
          scanProgress={scanProgress}
        />
        <BanishGhostAnimation
          isVisible={isPoofing}
          severity={violations[0]?.severity}
        />
      </>
    )
  }

  // Otherwise render standard children
  return <>{children}</>
}
