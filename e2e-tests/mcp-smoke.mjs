#!/usr/bin/env node
import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'

const SOCKET_PATH = path.join(os.homedir(), '.tauri', 'mcp.sock')
const APP_PORT = process.env.MCP_APP_PORT || '3100'
const TAURI_CMD = ['tauri', 'dev']
const START_TIMEOUT_MS = 180_000
const REQ_TIMEOUT_MS = 10_000
const TEST_TIMEOUT_MS = 10 * 60_000

let child
let socket
let nextId = 1

function log(...args) {
  console.log('[mcp-smoke]', ...args)
}

function startApp() {
  log('starting tauri dev with MCP enabled...')
  child = spawn('pnpm', TAURI_CMD, {
    env: {
      ...process.env,
      TAURI_MCP_ENABLE: '1',
      PORT: APP_PORT,
    },
    stdio: 'inherit',
  })
}

function waitForSocket(timeoutMs = START_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      if (fs.existsSync(SOCKET_PATH)) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        reject(new Error(`MCP socket not found at ${SOCKET_PATH}`))
      }
    }, 500)
  })
}

async function connectSocket(retries = 120, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const s = net.createConnection(SOCKET_PATH)
        const timer = setTimeout(() => {
          s.destroy()
          reject(new Error('connect timeout'))
        }, 5_000)
        s.once('connect', () => {
          clearTimeout(timer)
          socket = s
          resolve()
        })
        s.once('error', (err) => {
          clearTimeout(timer)
          reject(err)
        })
      })
      return socket
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}

function call(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    }
    const message = JSON.stringify(payload) + '\n'
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Request ${method} timed out after ${REQ_TIMEOUT_MS}ms`))
    }, REQ_TIMEOUT_MS)

    function cleanup(err, result) {
      clearTimeout(timeout)
      socket.off('data', onData)
      if (err) reject(err)
      else resolve(result)
    }

    function onData(buf) {
      const data = buf.toString()
      const lines = data.split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const msg = JSON.parse(line)
          if (msg.id === id) {
            if (msg.error) {
              cleanup(new Error(msg.error.message || 'Unknown MCP error'))
              return
            }
            cleanup(null, msg.result)
            return
          }
        } catch (e) {
          cleanup(new Error(`Invalid JSON from MCP: ${e.message}`))
          return
        }
      }
    }

    socket.on('data', onData)
    socket.write(message)
  })
}

async function run() {
  const globalTimer = setTimeout(() => {
    log('test timeout reached, killing child')
    cleanup()
    process.exit(1)
  }, TEST_TIMEOUT_MS)

  try {
    startApp()
    await waitForSocket()
    socket = await connectSocket()
    log('socket connected')

    // basic health
    const ping = await call('ping', null)
    log('ping result', ping)

    const windows = await call('window_list', null)
    if (!Array.isArray(windows) || windows.length === 0) {
      throw new Error('No windows returned from window_list')
    }
    const mainLabel = windows[0]
    log('main window label', mainLabel)

    // hide window to avoid UI disruption
    await call('window_hide', { label: mainLabel })

    // optional navigation sanity check
    await call('browser_navigate', { label: mainLabel, url: `http://localhost:${APP_PORT}/scan` })
    log('navigation issued')

    log('MCP smoke passed')
    clearTimeout(globalTimer)
    await cleanup()
    process.exit(0)
  } catch (err) {
    console.error('[mcp-smoke] ERROR:', err?.message || err)
    clearTimeout(globalTimer)
    await cleanup()
    process.exit(1)
  }
}

function cleanup() {
  return new Promise((resolve) => {
    try {
      if (socket && !socket.destroyed) socket.destroy()
    } catch {}

    if (child && !child.killed) {
      child.kill('SIGINT')
      const timer = setTimeout(resolve, 5_000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    } else {
      resolve()
    }
  })
}

process.on('SIGINT', () => { cleanup(); process.exit(1) })
process.on('SIGTERM', () => { cleanup(); process.exit(1) })

run()
