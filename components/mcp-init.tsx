"use client"

import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export function McpInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register global MCP callback handler (still used by some debug scripts)
    window.__MCPCallback = (id: string, data: any = null, error: string | null = null) => {
      invoke('plugin:mcp-bridge|js_callback', { id, data, error }).catch((e) => {
        console.error('[MCP] Failed to send callback to backend:', e)
      })
    }

    let unlistenExecuteCallback: (() => void) | null = null
    let unlistenExecuteJs: (() => void) | null = null

    const setupListeners = async () => {
      // Backwards-compatible listener for legacy callback-based scripts
      unlistenExecuteCallback = await listen('mcp-execute-callback', (event: any) => {
        const { id, code } = event.payload
        try {
          // Execute injected JavaScript that will call plugin:mcp-bridge|js_callback
          eval(code)
        } catch (e) {
          console.error('[MCP] Failed to execute callback code:', e)
          window.__MCPCallback?.(id, null, `Execution error: ${e}`)
        }
      })

      // Fire-and-forget JavaScript execution (browser_execute)
      unlistenExecuteJs = await listen('mcp-execute-js', (event: any) => {
        const code = event.payload
        try {
          eval(code)
        } catch (e) {
          console.error('[MCP] Failed to execute JS code:', e)
        }
      })

      console.log('[MCP] MCPInit listeners initialized')
    }

    setupListeners().catch((e) => {
      console.error('[MCP] Failed to setup MCP listeners:', e)
    })

    return () => {
      // Cleanup
      delete window.__MCPCallback
      if (unlistenExecuteCallback) unlistenExecuteCallback()
      if (unlistenExecuteJs) unlistenExecuteJs()
    }
  }, [])

  return null
}

// TypeScript declaration
declare global {
  interface Window {
    __MCPCallback?: (id: string, data?: any, error?: string | null) => void
  }
}
