'use client'

import { useEffect } from 'react'
import { initializeLangGraphBridge } from '@/lib/langgraph/tauri-bridge'

/**
 * Component to initialize the LangGraph Tauri bridge
 *
 * This component sets up the event listener for run-agent-request events
 * from the Rust backend when the app mounts.
 */
export function LangGraphInit() {
  useEffect(() => {
    let unlistener: Awaited<ReturnType<typeof initializeLangGraphBridge>> | null = null

    const initialize = async () => {
      try {
        unlistener = await initializeLangGraphBridge()
        console.log('[App] LangGraph bridge initialized')
      } catch (error) {
        console.error('[App] Failed to initialize LangGraph bridge:', error)
      }
    }

    initialize()

    // Cleanup: stop listening when component unmounts
    return () => {
      if (unlistener) {
        unlistener()
          .then(() => {
            console.log('[App] LangGraph bridge listener stopped')
          })
          .catch((error) => {
            console.error('[App] Error stopping LangGraph bridge listener:', error)
          })
      }
    }
  }, [])

  // This component doesn't render anything, it only handles initialization
  return null
}
