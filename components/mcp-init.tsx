"use client"

import { useEffect } from 'react'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
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

    let unlistenExecuteCallback: UnlistenFn | null = null
    let unlistenExecuteJs: UnlistenFn | null = null
    let unlistenGetUrl: UnlistenFn | null = null

    const setupListeners = async () => {
      // Backwards-compatible listener for legacy callback-based scripts
      unlistenExecuteCallback = await listen('mcp-execute-callback', (event: any) => {
        const payload = event.payload as any
        const { id, code } = payload ?? {}

        if (typeof code !== 'string') {
          console.error('[MCP] Invalid callback payload, expected code string:', payload)
          if (id) {
            window.__MCPCallback?.(id, null, 'Invalid callback payload')
          }
          return
        }

        try {
          // Execute injected JavaScript that will call plugin:mcp-bridge|js_callback
          eval(code)
        } catch (e) {
          console.error('[MCP] Failed to execute callback code:', e)
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
          console.error('[MCP] Invalid JS execute payload, expected string code:', payload)
          return
        }

        try {
          eval(code)
        } catch (e) {
          console.error('[MCP] Failed to execute JS code:', e)
        }
      })

      // Respond to URL requests from MCP bridge
      unlistenGetUrl = await listen('mcp-get-url', async (event: any) => {
        const payload = event.payload as any
        const requestId = payload?.requestId

        if (!requestId) {
          console.error('[MCP] Missing requestId in mcp-get-url payload:', payload)
          return
        }

        console.debug('[MCP] mcp-get-url received', requestId, window.location.href)

        const href = window.location.href
        const title = document.title

        try {
          await emit('mcp-url-response', { requestId, href, title })
        } catch (err) {
          console.error('[MCP] Failed to emit mcp-url-response:', err)
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
