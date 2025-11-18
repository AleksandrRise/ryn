"use client"

import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export function ConsoleLogger() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Capture console.error
    const originalError = console.error
    console.error = (...args: any[]) => {
      originalError(...args)
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      invoke('log_frontend_message', {
        level: 'error',
        message: `[Frontend Error] ${message}`
      }).catch(() => {})
    }

    // Capture console.warn
    const originalWarn = console.warn
    console.warn = (...args: any[]) => {
      originalWarn(...args)
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      invoke('log_frontend_message', {
        level: 'warn',
        message: `[Frontend Warn] ${message}`
      }).catch(() => {})
    }

    // Capture console.log
    const originalLog = console.log
    console.log = (...args: any[]) => {
      originalLog(...args)
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      invoke('log_frontend_message', {
        level: 'log',
        message: message
      }).catch(() => {})
    }

    // Capture unhandled errors
    const errorHandler = (event: ErrorEvent) => {
      invoke('log_frontend_message', {
        level: 'error',
        message: `[Unhandled Error] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
      }).catch(() => {})
    }
    window.addEventListener('error', errorHandler)

    // Capture unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      invoke('log_frontend_message', {
        level: 'error',
        message: `[Unhandled Promise Rejection] ${event.reason}`
      }).catch(() => {})
    }
    window.addEventListener('unhandledrejection', rejectionHandler)

    return () => {
      console.error = originalError
      console.warn = originalWarn
      console.log = originalLog
      window.removeEventListener('error', errorHandler)
      window.removeEventListener('unhandledrejection', rejectionHandler)
    }
  }, [])

  return null
}
