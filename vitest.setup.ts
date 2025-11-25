import '@testing-library/jest-dom/vitest'

// Type declaration for Tauri internals
type TauriInternals = {
  metadata: { currentWindow: { label: string } }
  postMessage: () => void
}

declare global {
  var __TAURI_INTERNALS__: TauriInternals
}

// Mock Tauri APIs for unit tests
globalThis.__TAURI_INTERNALS__ = {
  metadata: {
    currentWindow: { label: 'main' },
  },
  postMessage: () => {},
}

// Mock window.__TAURI_INTERNALS__
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: globalThis.__TAURI_INTERNALS__,
  writable: true,
})
