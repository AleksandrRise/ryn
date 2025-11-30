"use client"

import { useEffect } from 'react'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export function McpInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register global MCP callback handler (still used by some debug scripts)
    window.__MCPCallback = (id: string, data: any = null, error: string | null = null) => {
      invoke('plugin:mcp-bridge|js_callback', { id, data, error }).catch(() => {
        // Callback failed silently
      })
    }

    let unlistenExecuteCallback: UnlistenFn | null = null
    let unlistenExecuteJs: UnlistenFn | null = null
    let unlistenGetUrl: UnlistenFn | null = null

    const setupListeners = async () => {
      // Backwards-compatible listener for legacy callback-based scripts
      unlistenExecuteCallback = await listen('mcp-execute-callback', (event: any) => {
        const payload = event.payload as any
        const { id, code } = payload ?? {}

        if (typeof code !== 'string') {
          if (id) {
            window.__MCPCallback?.(id, null, 'Invalid callback payload')
          }
          return
        }

        try {
          // Execute injected JavaScript that will call plugin:mcp-bridge|js_callback
          eval(code)
        } catch (e) {
          if (id) {
            window.__MCPCallback?.(id, null, `Execution error: ${String(e)}`)
          }
        }
      })

      // Fire-and-forget JavaScript execution (browser_execute)
      unlistenExecuteJs = await listen('mcp-execute-js', (event: any) => {
        const payload = event.payload as any
        const code =
          typeof payload === 'string'
            ? payload
            : payload && typeof payload.code === 'string'
              ? payload.code
              : null

        if (typeof code !== 'string') {
          return
        }

        try {
          eval(code)
        } catch {
          // JS execution failed silently
        }
      })

      // Respond to URL requests from MCP bridge
      unlistenGetUrl = await listen('mcp-get-url', async (event: any) => {
        const payload = event.payload as any
        const requestId = payload?.requestId

        if (!requestId) {
          return
        }

        const href = window.location.href
        const title = document.title

        try {
          await emit('mcp-url-response', { requestId, href, title })
        } catch {
          // URL response failed silently
        }
      })

    }

    setupListeners().catch(() => {
      // MCP listener setup failed silently
    })

    return () => {
      delete window.__MCPCallback
      if (unlistenExecuteCallback) unlistenExecuteCallback()
      if (unlistenExecuteJs) unlistenExecuteJs()
      if (unlistenGetUrl) unlistenGetUrl()
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
