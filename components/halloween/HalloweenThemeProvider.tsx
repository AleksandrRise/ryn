"use client"

import { ReactNode } from "react"
import { BatSwoop } from "./BatSwoop"
import { PumpkinCursor } from "./PumpkinCursor"
import { HalloweenBackground } from "./HalloweenBackground"
import { useHalloweenThemeContext } from "@/lib/context/HalloweenContext"

interface HalloweenThemeProviderProps {
  children: ReactNode
}

export function HalloweenThemeProvider({ children }: HalloweenThemeProviderProps) {
  const { isEnabled } = useHalloweenThemeContext()

  return (
    <>
      {isEnabled && (
        <style>{`
          :root {
            --halloween-accent-purple: #6b21a8;
            --halloween-accent-orange: #b45309;
            --halloween-dark: #0a0b12;
          }

          body {
            --tw-bg-opacity: 1;
          }

          /* Enhanced button styles for Halloween */
          button {
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
          }

          /* Card enhancements */
          [class*="bg-white/5"] {
            background-color: rgba(10, 11, 18, 0.8);
            border-color: rgba(139, 92, 246, 0.2) !important;
          }

          /* Text enhancements */
          p, span, label {
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
          }

          /* Input focus glow */
          input:focus, textarea:focus, select:focus {
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
            border-color: #8b5cf6;
          }

          /* Scrollbar styling */
          ::-webkit-scrollbar {
            width: 8px;
          }

          ::-webkit-scrollbar-track {
            background: rgba(10, 11, 18, 0.5);
          }

          ::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #8b0000, #dc143c);
            border-radius: 4px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, #b22222, #ff1744);
          }

          /* Hide all range sliders by default (horizontal) */
          input[type="range"] {
            opacity: 0 !important;
            visibility: hidden !important;
          }

          /* Show vertical sliders with reduced opacity */
          input[type="range"][orient="vertical"] {
            opacity: 0.3 !important;
            visibility: visible !important;
          }

          /* Selection color */
          ::selection {
            background-color: rgba(139, 92, 246, 0.3);
            color: #fbbf24;
          }
        `}</style>
      )}
      {children}
      {isEnabled && (
        <>
          <HalloweenBackground />
          <BatSwoop />
          <PumpkinCursor />
        </>
      )}
    </>
  )
}
