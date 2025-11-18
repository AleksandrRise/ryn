/**
 * File logger that writes console output to a file for debugging
 * This allows Claude to see browser console errors without manual copy-paste
 */

import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'

class FileLogger {
  private logs: string[] = []
  private flushTimeout: NodeJS.Timeout | null = null

  async log(level: 'log' | 'error' | 'warn' | 'info', ...args: any[]) {
    const timestamp = new Date().toISOString()
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, Object.getOwnPropertyNames(arg), 2)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')

    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    this.logs.push(logEntry)

    // Also log to console
    console[level](...args)

    // Debounced flush to file
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
    }
    this.flushTimeout = setTimeout(() => this.flush(), 500)
  }

  private async flush() {
    if (this.logs.length === 0) return

    try {
      const content = this.logs.join('\n') + '\n'
      await writeTextFile('ryn-frontend.log', content, {
        baseDir: BaseDirectory.Temp,
        append: true,
      })
      this.logs = []
    } catch (err) {
      // Silently fail if file writing doesn't work
      console.error('Failed to write log file:', err)
    }
  }
}

export const fileLogger = new FileLogger()

// Override console methods
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
const originalConsoleLog = console.log

console.error = (...args: any[]) => {
  fileLogger.log('error', ...args)
  originalConsoleError(...args)
}

console.warn = (...args: any[]) => {
  fileLogger.log('warn', ...args)
  originalConsoleWarn(...args)
}

console.log = (...args: any[]) => {
  fileLogger.log('log', ...args)
  originalConsoleLog(...args)
}
