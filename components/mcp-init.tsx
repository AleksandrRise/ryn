"use client"

import { useEffect, useState } from "react"

export function McpInit() {
  const [status, setStatus] = useState<string>("initializing")

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") {
      return
    }

    // Check if we're in Tauri context
    const isTauri = typeof (window as any).__TAURI__ !== "undefined"
    console.log("[MCP Init] Tauri context:", isTauri)

    if (!isTauri) {
      console.log("[MCP Init] Not running in Tauri, skipping MCP setup")
      setStatus("browser mode (no MCP)")
      return
    }

    let cleanup: (() => void) | undefined

    console.log("[MCP Init] Starting initialization...")
    setStatus("loading")

    // Dynamically import and setup MCP listeners
    import("tauri-plugin-mcp")
      .then((module) => {
        console.log("[MCP Init] Module loaded:", module)
        const { setupPluginListeners, cleanupPluginListeners } = module

        if (typeof setupPluginListeners !== "function") {
          console.error("[MCP Init] setupPluginListeners is not a function")
          setStatus("error: setupPluginListeners not found")
          return
        }

        console.log("[MCP Init] Calling setupPluginListeners...")
        return setupPluginListeners()
          .then(() => {
            console.log("[MCP Init] ✓ Plugin listeners initialized successfully")
            setStatus("ready")
            cleanup = cleanupPluginListeners
          })
          .catch((err) => {
            console.error("[MCP Init] ✗ Error setting up listeners:", err)
            console.error("[MCP Init] Error type:", typeof err)
            console.error("[MCP Init] Error keys:", err ? Object.keys(err) : "null/undefined")

            let errMsg = "unknown error"
            if (err) {
              if (err.message) errMsg = err.message
              else if (typeof err.toString === "function") errMsg = err.toString()
              else if (typeof err === "string") errMsg = err
              else errMsg = JSON.stringify(err)
            }
            setStatus(`error: ${errMsg}`)
          })
      })
      .catch((error) => {
        console.error("[MCP Init] ✗ Failed to import module:", error)
        const errMsg = error?.message || error?.toString() || String(error)
        setStatus(`error: ${errMsg}`)
      })

    // Cleanup on unmount
    return () => {
      if (cleanup) {
        console.log("[MCP Init] Cleaning up listeners...")
        cleanup()
      }
    }
  }, [])

  // Show status in development
  if (process.env.NODE_ENV === "development") {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          background: "rgba(0,0,0,0.8)",
          color: "#0f0",
          padding: "4px 8px",
          fontSize: "10px",
          fontFamily: "monospace",
          zIndex: 9999,
          borderRadius: "3px",
        }}
      >
        MCP: {status}
      </div>
    )
  }

  return null
}
