/**
 * Hook for real-time file watching functionality
 *
 * This hook manages the lifecycle of file watching for a project and listens
 * for file change events emitted by the Rust backend. When files change, it
 * displays toast notifications.
 *
 * Usage:
 * ```typescript
 * const { isWatching, startWatching, stopWatching } = useFileWatcher(projectId)
 * ```
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { toast } from "sonner"
import * as commands from "@/lib/tauri/commands"
import type { FileChangedEvent } from "@/lib/types/events"

interface UseFileWatcherOptions {
  /**
   * Whether to automatically start watching when the hook mounts
   * @default false
   */
  autoStart?: boolean

  /**
   * Callback fired when a file change event is detected
   * Useful for triggering UI updates like refreshing violations
   */
  onFileChanged?: (event: FileChangedEvent) => void

  /**
   * Whether to show toast notifications for file changes
   * @default true
   */
  showNotifications?: boolean
}

interface UseFileWatcherReturn {
  /** Whether the project is currently being watched */
  isWatching: boolean

  /** Whether a watch operation is currently in progress */
  isLoading: boolean

  /** Error message if watch/stop operations fail */
  error: string | null

  /** Start watching the project for file changes */
  startWatching: () => Promise<void>

  /** Stop watching the project for file changes */
  stopWatching: () => Promise<void>
}

/**
 * Hook for managing real-time file watching of a project
 *
 * @param projectId - The ID of the project to watch (undefined if no project selected)
 * @param options - Configuration options
 * @returns Object with watching state and control functions
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { isWatching, startWatching, stopWatching } = useFileWatcher(123)
 *
 *   return (
 *     <button onClick={startWatching} disabled={isWatching}>
 *       {isWatching ? "Watching..." : "Start Watching"}
 *     </button>
 *   )
 * }
 * ```
 */
export function useFileWatcher(
  projectId: number | undefined,
  options: UseFileWatcherOptions = {}
): UseFileWatcherReturn {
  const {
    autoStart = false,
    onFileChanged,
    showNotifications = true,
  } = options

  const [isWatching, setIsWatching] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Start watching for file changes
  const startWatching = useCallback(async () => {
    // Don't attempt to watch if no valid project
    if (projectId === undefined || projectId <= 0) {
      console.warn('[useFileWatcher] Cannot start watching: invalid project ID', projectId)
      const errorMsg = `Cannot start watching: ${projectId === undefined ? 'no project selected' : 'invalid project ID'}`
      setError(errorMsg)
      if (showNotifications) {
        toast.error(errorMsg)
      }
      return
    }

    if (isWatching || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('[useFileWatcher] Calling watch_project with project_id=', projectId)
      await commands.watch_project(projectId)
      setIsWatching(true)
      console.log('[useFileWatcher] Successfully started watching project_id=', projectId)

      if (showNotifications) {
        toast.success(`Started watching project for changes`)
      }
    } catch (err: any) {
      // Tauri errors - extract message from various possible properties
      let errorMsg = 'Failed to start watching'

      if (typeof err === 'string') {
        errorMsg = err
      } else if (err instanceof Error) {
        errorMsg = err.message
      } else if (err && typeof err === 'object') {
        // Try common error properties
        errorMsg = err.message || err.error || err.msg || String(err) || errorMsg
      }

      // If the error is "already being watched", treat it as success
      // This can happen in React Strict Mode when the component mounts twice
      if (errorMsg.includes('already being watched')) {
        console.log('[useFileWatcher] Project already being watched, treating as success')
        setIsWatching(true)
        setIsLoading(false)
        // Don't show error notification since this is expected behavior
        return
      }

      // Only log actual errors
      console.error('[useFileWatcher] watch_project failed:', errorMsg)
      console.error('[useFileWatcher] project_id:', projectId)
      console.error('[useFileWatcher] error type:', typeof err)
      console.error('[useFileWatcher] error keys:', err ? Object.getOwnPropertyNames(err) : [])
      setError(errorMsg)

      if (showNotifications) {
        // Don't add prefix if error already has context
        toast.error(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [projectId, isWatching, isLoading, showNotifications])

  // Stop watching for file changes
  const stopWatching = useCallback(async () => {
    // Don't attempt to stop watching if no valid project
    if (projectId === undefined || projectId <= 0) {
      console.warn('[useFileWatcher] Cannot stop watching: invalid project ID', projectId)
      return
    }

    if (!isWatching || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      await commands.stop_watching(projectId)
      setIsWatching(false)

      if (showNotifications) {
        toast.success(`Stopped watching project`)
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to stop watching"
      setError(errorMsg)

      if (showNotifications) {
        toast.error(`Failed to stop watching: ${errorMsg}`)
      }
    } finally {
      setIsLoading(false)
    }
  }, [projectId, isWatching, isLoading, showNotifications])

  // Set up event listener for file changes
  useEffect(() => {
    if (!isWatching) return

    let unlisten: UnlistenFn | null = null

    // Set up the event listener
    const setupListener = async () => {
      try {
        unlisten = await listen<FileChangedEvent>(
          "file-changed",
          (event) => {
            const payload = event.payload

            // Only handle events for this project
            if (payload.projectId !== projectId) return

            // Call the user's callback if provided
            if (onFileChanged) {
              onFileChanged(payload)
            }

            // Show toast notification
            if (showNotifications) {
              const emoji =
                payload.eventType === "deleted"
                  ? "🗑️"
                  : payload.eventType === "created"
                    ? "✨"
                    : "📝"

              toast.info(
                `File ${payload.eventType}: ${payload.filePath}`,
                {
                  description: `Project ID ${projectId}`,
                }
              )
            }
          }
        )
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to set up listener"
        setError(errorMsg)

        if (showNotifications) {
          toast.error(`File watcher error: ${errorMsg}`)
        }
      }
    }

    setupListener()

    // Cleanup: unsubscribe from event when component unmounts or watching stops
    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [isWatching, projectId, onFileChanged, showNotifications])

  // Auto-start watching if enabled
  useEffect(() => {
    if (autoStart && !isWatching && !isLoading) {
      startWatching()
    }
  }, [autoStart, isWatching, isLoading, startWatching])

  return {
    isWatching,
    isLoading,
    error,
    startWatching,
    stopWatching,
  }
}
