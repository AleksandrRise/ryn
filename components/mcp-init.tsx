"use client"

import { useEffect, useState } from "react"

export function McpInit() {
  const [status, setStatus] = useState<string>("initializing")

  useEffect(() => {
    // MCP plugin initialization disabled to avoid Next.js build warnings
    // The plugin is only used for development debugging via /tmp/tauri-mcp.sock
    // Backend MCP functionality works independently of this frontend component
    setStatus("disabled")
    console.log("[MCP Init] Frontend MCP listener disabled (backend still active)")
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
