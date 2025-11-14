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

    // MCP plugin is Rust-only, no frontend bindings available
    // The plugin runs on the backend and doesn't require frontend setup
    console.log("[MCP Init] MCP plugin runs backend-only (Unix socket at /tmp/tauri-mcp.sock)")
    setStatus("ready (backend-only)")

    // No cleanup needed as plugin is backend-only
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
