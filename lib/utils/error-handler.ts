import { toast } from 'sonner'

/**
 * Centralized error handler for Tauri command failures
 *
 * Displays user-friendly error messages via toast notifications
 * and logs detailed errors to console for debugging
 *
 * @param error - Error from Tauri command or other async operation
 * @param fallbackMessage - User-friendly message if error is not descriptive
 * @returns void
 */
export function handleTauriError(error: unknown, fallbackMessage: string): void {
  // Extract error message
  let errorMessage = fallbackMessage
  let rawError: unknown = error  // For logging - may be transformed for better debugging

  if (typeof error === 'string') {
    errorMessage = error
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message)
  } else if (error && typeof error === 'object') {
    // Handle empty objects or objects without message property
    const keys = Object.keys(error)
    if (keys.length === 0) {
      // Empty object - use fallback, but note it in the log
      rawError = '(empty error object received from Tauri)'
    } else {
      // Non-empty object without message - stringify for debugging
      try {
        rawError = JSON.stringify(error)
      } catch {
        rawError = '(non-serializable error object)'
      }
    }
  }

  // Log full error for debugging
  console.error('[Tauri Error]', {
    error: rawError,
    message: errorMessage,
    fallback: fallbackMessage,
    timestamp: new Date().toISOString(),
  })

  // Show user-friendly toast
  toast.error(errorMessage, {
    duration: 5000,
    position: 'bottom-right',
  })
}

/**
 * Success toast helper for consistent success messaging
 *
 * @param message - Success message to display
 */
export function showSuccess(message: string): void {
  toast.success(message, {
    duration: 3000,
    position: 'bottom-right',
  })
}

/**
 * Info toast helper for informational messages
 *
 * @param message - Info message to display
 */
export function showInfo(message: string): void {
  toast.info(message, {
    duration: 3000,
    position: 'bottom-right',
  })
}
