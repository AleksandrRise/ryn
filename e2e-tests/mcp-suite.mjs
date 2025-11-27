#!/usr/bin/env node
import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'

const SOCKET_PATH = path.join(os.homedir(), '.tauri', 'mcp.sock')
const APP_PORT = parseInt(process.env.MCP_APP_PORT || '3000', 10)
const FIXTURE_PATH = path.resolve('e2e-tests/fixtures/vulnerable-django')
const START_TIMEOUT_MS = 240_000
const REQ_TIMEOUT_MS = 15_000
const TEST_TIMEOUT_MS = 12 * 60_000

let child
let socket
let nextId = 1

function log(...args) { console.log('[mcp-suite]', ...args) }

async function waitForWindow(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const windows = await call('window_list', null)
      if (Array.isArray(windows) && windows.length > 0) return windows[0]
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('No windows returned within timeout')
}

async function ensureNoRunningRyn() {
  const pids = await new Promise((resolve) => {
    const ps = spawn('pgrep', ['-f', 'target/debug/ryn'])
    const out = []
    ps.stdout.on('data', (d) => out.push(d.toString()))
    ps.on('close', (code) => {
      if (code === 0 && out.length) resolve(out.join('').trim().split(/\s+/).filter(Boolean))
      else resolve([])
    })
    ps.on('error', () => resolve([]))
  })

  if (pids.length > 0) {
    log(`found existing ryn processes: ${pids.join(', ')}, refusing to start another`)
    throw new Error('Existing Ryn instance detected')
  }
}

function startApp() {
  log('starting tauri dev with MCP enabled...')
  try { if (fs.existsSync(SOCKET_PATH)) fs.rmSync(SOCKET_PATH) } catch {}
  child = spawn('pnpm', ['tauri', 'dev'], {
    env: {
      ...process.env,
      TAURI_MCP_ENABLE: '1',
      PORT: String(APP_PORT),
      TAURI_DEV_PORT: String(APP_PORT),
      TAURI_DEV_HOST: 'localhost',
      TAURI_DEV_URL: `http://localhost:${APP_PORT}`,
    },
    stdio: 'inherit',
    detached: true,
  })
}

function waitForSocket(timeoutMs = START_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (fs.existsSync(SOCKET_PATH)) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer)
        reject(new Error(`MCP socket not found at ${SOCKET_PATH}`))
      }
    }, 500)
  })
}

async function connectSocket(retries = 180, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const s = net.createConnection(SOCKET_PATH)
        const t = setTimeout(() => { s.destroy(); reject(new Error('connect timeout')) }, 5000)
        s.once('connect', () => { clearTimeout(t); socket = s; resolve() })
        s.once('error', (err) => { clearTimeout(t); reject(err) })
      })
      return socket
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

function call(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    const payload = { jsonrpc: '2.0', method, params, id }
    const message = JSON.stringify(payload) + '\n'
    const timeout = setTimeout(() => {
      cleanupListeners()
      reject(new Error(`Request ${method} timed out after ${REQ_TIMEOUT_MS}ms`))
    }, REQ_TIMEOUT_MS)

    function cleanupListeners(err, result) {
      clearTimeout(timeout)
      socket?.off('data', onData)
      if (err) reject(err)
      else resolve(result)
    }

    function onData(buf) {
      const lines = buf.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        let msg
        try { msg = JSON.parse(line) } catch (e) { return cleanupListeners(new Error(`Invalid JSON from MCP: ${e.message}`)) }
        if (msg.id === id) {
          if (msg.error) return cleanupListeners(new Error(msg.error.message || 'Unknown MCP error'))
          return cleanupListeners(null, msg.result)
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
    cleanup().then(() => process.exit(1))
  }, TEST_TIMEOUT_MS)

  try {
    log(`using app port ${APP_PORT}`)
    startApp()
    await waitForSocket()
    await connectSocket()
    log('socket connected')

    await call('ping', null)
    const main = await waitForWindow()
    log('main window', main)

    // minimize disruption: hide window
    await call('window_hide', { label: main })

    // Kick off create + scan via Tauri invoke inside webview; stash count in title
    const escapedPath = FIXTURE_PATH.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    // Run inside webview and send result back via MCP js_callback to avoid large HTML parsing
    const evalResult = await call('browser_eval', {
      label: main,
      code: `
        const project = await window.__TAURI__.core.invoke('create_project', { name: 'MCP E2E', path: '${escapedPath}' });
        const scan = await window.__TAURI__.core.invoke('scan_project', { projectId: project.id });
        const waitScan = async () => {
          const progress = await window.__TAURI__.core.invoke('get_scan_progress', { scanId: scan.id });
          if (progress.status === 'completed') return;
          if (['failed','cancelled','error'].includes(progress.status)) throw new Error('Scan failed: ' + progress.status);
          await new Promise(r => setTimeout(r, 500));
          return waitScan();
        };
        await waitScan();
        const violations = await window.__TAURI__.core.invoke('get_violations', { scanId: scan.id });
        return { count: violations?.length ?? 0 };
      `,
    })

    const rowCount = evalResult?.count
    if (typeof rowCount !== 'number' || Number.isNaN(rowCount)) {
      throw new Error(`Invalid MCP eval result: ${JSON.stringify(evalResult)}`)
    }
    if (rowCount < 1) throw new Error('No violations found after scan')
    log(`violations detected: ${rowCount}`)

    clearTimeout(globalTimer)
    await cleanup()
    log('MCP E2E suite passed')
    process.exit(0)
  } catch (err) {
    console.error('[mcp-suite] ERROR:', err?.message || err)
    clearTimeout(globalTimer)
    await cleanup()
    process.exit(1)
  }
}

function cleanup() {
  return new Promise((resolve) => {
    try { if (socket && !socket.destroyed) socket.destroy() } catch {}
    resolve()
  })
}

process.on('SIGINT', () => { cleanup().then(() => process.exit(1)) })
process.on('SIGTERM', () => { cleanup().then(() => process.exit(1)) })

run()
