import '@testing-library/jest-dom/vitest'

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
