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

  if (typeof error === 'string') {
    errorMessage = error
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message)
  }

  // Log full error for debugging
  console.error('[Tauri Error]', {
    error,
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

/**
 * Warning toast helper for non-critical warnings
 *
 * @param message - Warning message to display
 */
export function showWarning(message: string): void {
  toast.warning(message, {
    duration: 4000,
    position: 'bottom-right',
  })
}
