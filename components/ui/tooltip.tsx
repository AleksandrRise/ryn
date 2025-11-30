"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface TooltipProps {
  /** The content to display inside the tooltip */
  content: React.ReactNode
  /** The trigger element that the tooltip attaches to */
  children: React.ReactNode
  /** Tooltip placement relative to trigger */
  side?: "top" | "bottom" | "left" | "right"
  /** Offset distance from the trigger element in pixels */
  sideOffset?: number
  /** Delay before showing tooltip in milliseconds */
  delayDuration?: number
  /** Additional className for the tooltip content */
  className?: string
  /** Disable the tooltip */
  disabled?: boolean
}

function getAnimationVariants(side: "top" | "bottom" | "left" | "right") {
  const offset = 4
  const transforms = {
    top: { y: offset },
    bottom: { y: -offset },
    left: { x: offset },
    right: { x: -offset },
  }

  return {
    initial: {
      opacity: 0,
      ...transforms[side],
      scale: 0.98,
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 0.15, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      ...transforms[side],
      scale: 0.98,
      transition: { duration: 0.1, ease: "easeIn" },
    },
  }
}

function getPositionStyles(
  side: "top" | "bottom" | "left" | "right",
  sideOffset: number
): React.CSSProperties {
  const styles: React.CSSProperties = {
    position: "absolute",
  }

  switch (side) {
    case "top":
      styles.bottom = `calc(100% + ${sideOffset}px)`
      styles.left = "50%"
      styles.transform = "translateX(-50%)"
      break
    case "bottom":
      styles.top = `calc(100% + ${sideOffset}px)`
      styles.left = "50%"
      styles.transform = "translateX(-50%)"
      break
    case "left":
      styles.right = `calc(100% + ${sideOffset}px)`
      styles.top = "50%"
      styles.transform = "translateY(-50%)"
      break
    case "right":
      styles.left = `calc(100% + ${sideOffset}px)`
      styles.top = "50%"
      styles.transform = "translateY(-50%)"
      break
  }

  return styles
}

export function Tooltip({
  content,
  children,
  side = "bottom",
  sideOffset = 6,
  delayDuration = 200,
  className,
  disabled = false,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tooltipId = React.useId()

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  const handleMouseEnter = () => {
    if (disabled) return
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true)
    }, delayDuration)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(false)
  }

  const handleFocus = () => {
    if (disabled) return
    setIsOpen(true)
  }

  const handleBlur = () => {
    setIsOpen(false)
  }

  // Escape key dismissal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const variants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : getAnimationVariants(side)

  const positionStyles = getPositionStyles(side, sideOffset)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ "aria-describedby"?: string }>, {
            "aria-describedby": isOpen ? tooltipId : undefined,
          })
        : children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={tooltipId}
            role="tooltip"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={positionStyles}
            className={cn(
              "z-50 px-2.5 py-1.5 text-xs font-medium",
              "bg-black/90 backdrop-blur-sm",
              "border border-white/10 rounded-md",
              "text-white whitespace-nowrap",
              "shadow-lg",
              "pointer-events-none",
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
