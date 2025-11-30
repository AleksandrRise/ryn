/**
 * Type definitions for Tauri events emitted by the Ryn backend
 */

/**
 * Event type for file system changes emitted by the file watcher
 */
export type FileEventType = "created" | "modified" | "deleted"

/**
 * File changed event payload emitted by watch_project command
 *
 * Emitted whenever the file watcher detects a change in the watched project directory.
 * The frontend can listen to this event via:
 *
 * ```typescript
 * import { listen } from "@tauri-apps/api/event"
 * import type { FileChangedEvent } from "@/lib/types/events"
 *
 * const unlisten = await listen<FileChangedEvent>("file-changed", (event) => {
 *   console.log(`File ${event.payload.filePath} was ${event.payload.eventType}`)
 * })
 * ```
 */
export interface FileChangedEvent {
  /** ID of the project being watched */
  projectId: number

  /** Absolute or relative path to the file that changed */
  filePath: string

  /** Type of file system change: created, modified, or deleted */
  eventType: FileEventType
}
