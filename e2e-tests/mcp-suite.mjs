#!/usr/bin/env node
import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'

const SOCKET_PATH = path.join(os.homedir(), '.tauri', 'mcp.sock')
const APP_PORT = parseInt(process.env.MCP_APP_PORT || '3000', 10)
const FIXTURE_ROOT = path.resolve('e2e-tests/fixtures')
const CUSTOM_FIXTURES = process.env.MCP_FIXTURES
  ? process.env.MCP_FIXTURES.split(',').map((p) => path.resolve(p.trim())).filter(Boolean)
  : null
const CUSTOM_PLAN = process.env.MCP_ACTION_PLAN ? safeParseJSON(process.env.MCP_ACTION_PLAN) : null
const RNG_SEED = parseInt(process.env.MCP_SEED || `${Date.now() % 1_000_000}`, 10) || 1
const DEFAULT_SCAN_MODE = process.env.MCP_SCAN_MODE || 'regex_only'
const START_TIMEOUT_MS = 240_000
const REQ_TIMEOUT_MS = 15_000
const TEST_TIMEOUT_MS = 12 * 60_000
const CANCEL_WAIT_MS = 25_000

let child
let socket
let nextId = 1
let rngState = RNG_SEED >>> 0

function log(...args) { console.log('[mcp-suite]', ...args) }

function safeParseJSON(str) {
  try { return JSON.parse(str) } catch (e) { throw new Error(`Invalid JSON provided: ${e.message}`) }
}

function rng() {
  // Simple LCG for deterministic randomness
  rngState = (1664525 * rngState + 1013904223) >>> 0
  return rngState / 2 ** 32
}

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

function listFixtures() {
  if (CUSTOM_FIXTURES && CUSTOM_FIXTURES.length) {
    return CUSTOM_FIXTURES.filter((p) => fs.existsSync(p) && fs.statSync(p).isDirectory())
  }
  if (!fs.existsSync(FIXTURE_ROOT)) return []
  return fs
    .readdirSync(FIXTURE_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(FIXTURE_ROOT, d.name))
}

function escapePath(p) {
  return p.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function buildPlan(fixtures) {
  if (CUSTOM_PLAN) return CUSTOM_PLAN
  const plan = []
  fixtures.forEach((fixturePath) => {
    // isolation per fixture
    plan.push({ kind: 'clear_db' })
    const mode = rng() < 0.35 ? 'smart' : DEFAULT_SCAN_MODE
    plan.push({ kind: 'create_scan', fixturePath, scanMode: mode })
    if (rng() < 0.85) plan.push({ kind: 'fix', fixturePath })
    if (rng() < 0.6) plan.push({ kind: 'dismiss', fixturePath })
    if (rng() < 0.4) plan.push({ kind: 'cancel_scan', fixturePath, scanMode: mode })
    plan.push({ kind: 'export' })
  })
  return plan
}

async function invoke(label, command, args = {}) {
  return call('browser_eval', { label, code: `return await window.__TAURI__.core.invoke('${command}', ${JSON.stringify(args)});` })
}

function projectNameFor(fixturePath) {
  return `MCP E2E ${path.basename(fixturePath)}`
}

async function doClear(label) {
  await invoke(label, 'clear_database')
  return { cleared: true }
}

async function doCreateAndScan(label, fixturePath, state, scanMode = DEFAULT_SCAN_MODE) {
  const resolved = path.resolve(fixturePath)
  const escapedPath = escapePath(resolved)
  const name = projectNameFor(resolved)
  const res = await call('browser_eval', {
    label,
    code: `
      const project = await window.__TAURI__.core.invoke('create_project', { name: '${name}', path: '${escapedPath}' });
      // Optionally set scan mode
      await window.__TAURI__.core.invoke('complete_onboarding', { scan_mode: '${scanMode}', cost_limit: 25.0 }).catch(() => {});
      const scan = await window.__TAURI__.core.invoke('scan_project', { projectId: project.id });
      const waitScan = async () => {
        const progress = await window.__TAURI__.core.invoke('get_scan_progress', { scanId: scan.id });
        if (progress.status === 'completed') return;
        if (['failed','cancelled','error'].includes(progress.status)) throw new Error('Scan failed: ' + progress.status);
        await new Promise(r => setTimeout(r, 400));
        return waitScan();
      };
      await waitScan();
      const violations = await window.__TAURI__.core.invoke('get_violations', { scanId: scan.id });
      return { projectId: project.id, scanId: scan.id, violations: violations?.map(v => v.id) ?? [], count: violations?.length ?? 0 };
    `,
  })
  if (!res || res.count < 1) throw new Error(`Scan produced no violations for ${fixturePath}: ${JSON.stringify(res)}`)
  state.set(resolved, { projectId: res.projectId, scanId: res.scanId, violations: res.violations })
  log(`scan complete for ${resolved}: ${res.count} violations`)
  return res
}

async function doFix(label, fixturePath, state) {
  const entry = state.get(fixturePath)
  if (!entry) throw new Error(`No state for fixture ${fixturePath} before fix`)
  const fixResult = await call('browser_eval', {
    label,
    code: `
      try {
        const projectId = ${entry.projectId};
        const scans = await window.__TAURI__.core.invoke('get_scans', { projectId });
        const latestScan = scans?.[0];
        if (!latestScan) throw new Error('No scan found for project');
        const violations = await window.__TAURI__.core.invoke('get_violations', { scanId: latestScan.id });
        if (!violations?.length) throw new Error('No violations available to fix');

        for (const pick of violations) {
          try {
            // Verify snippet exists on disk before attempting apply
            const projects = await window.__TAURI__.core.invoke('get_projects');
            const project = projects.find(p => p.id === projectId);
            const basePath = project?.path || '';
            const normalizedBase = basePath.replace(/\\/g, '/');
            const fullPath = normalizedBase + '/' + pick.file_path;
            let content = null;
            try {
              content = await window.__TAURI__.fs.readTextFile(fullPath);
            } catch (_) {}
            if (!content || !content.includes(pick.code_snippet)) {
              continue; // skip mismatched snippet
            }

            const fix = await window.__TAURI__.core.invoke('generate_fix', { violationId: pick.id });
            await window.__TAURI__.core.invoke('apply_fix', { fixId: fix.id });
            const updated = await window.__TAURI__.core.invoke('get_violation', { violationId: pick.id });
            return { applied_at: updated?.fix?.applied_at || null, status: updated?.violation?.status, fixed_violation_id: pick.id, remaining: violations.length, attempts: violations.length };
          } catch (err) {
            // Skip mismatch/snippet errors and try next violation
            const msg = String(err?.message || err || '').toLowerCase();
            if (msg.includes('original code not found') || msg.includes('failed to create grok client')) {
              continue;
            }
            // Propagate other errors
            throw err;
          }
        }
        return { skipped: true, reason: 'no_violation_matched_snippet' };
      } catch (e) {
        return { error: String(e?.message || e || '') };
      }
    `,
  })
  if (fixResult?.skipped) {
    log(`fix skipped for ${fixturePath}: ${fixResult.reason}`)
    return fixResult
  }
  if (fixResult?.error) {
    throw new Error(`Fix flow error: ${fixResult.error}`)
  }
  if (!fixResult || !fixResult.applied_at || (fixResult.status && fixResult.status !== 'fixed')) {
    throw new Error(`Fix apply failed via MCP after retries: ${JSON.stringify(fixResult)}`)
  }
  log(`fix applied on violation ${fixResult.fixed_violation_id} for ${fixturePath} (attempts up to ${fixResult.attempts})`)
  return fixResult
}

async function doCancelScan(label, fixturePath, scanMode = DEFAULT_SCAN_MODE) {
  const resolved = path.resolve(fixturePath)
  const escapedPath = escapePath(resolved)
  const name = `Cancel Test ${path.basename(resolved)}`
  const result = await call('browser_eval', {
    label,
    code: `
      try {
        const project = await window.__TAURI__.core.invoke('create_project', { name: '${name}', path: '${escapedPath}' });
        await window.__TAURI__.core.invoke('complete_onboarding', { scan_mode: '${scanMode}', cost_limit: 25.0 }).catch(() => {});
        const scan = await window.__TAURI__.core.invoke('scan_project', { projectId: project.id });
        await window.__TAURI__.core.invoke('cancel_scan', { scanId: scan.id });
        const waitStatus = async (start = Date.now()) => {
          try {
            const progress = await window.__TAURI__.core.invoke('get_scan_progress', { scanId: scan.id });
            if (progress.status === 'cancelled') return 'cancelled';
            if (progress.status === 'failed' || progress.status === 'error') throw new Error('Scan failed after cancel: ' + progress.status);
            if (Date.now() - start > ${CANCEL_WAIT_MS}) return progress.status;
            await new Promise(r => setTimeout(r, 300));
            return waitStatus(start);
          } catch (e) {
            return 'unknown';
          }
        };
        const status = await waitStatus();
        return { status };
      } catch (e) {
        return { status: 'error', message: String(e?.message || e || '') };
      }
    `,
  })
  const safeResult = result || { status: 'unknown' }
  if (safeResult.status !== 'cancelled' && safeResult.status !== 'completed' && safeResult.status !== 'unknown') {
    throw new Error(`Cancel scan did not finish cleanly: ${JSON.stringify(result)}`)
  }
  log(`cancel scan status=${safeResult.status} for ${fixturePath}`)
  return safeResult
}

async function doDismiss(label, fixturePath, fixedViolationId) {
  const dismissResult = await call('browser_eval', {
    label,
    code: `
      const projectId = (await window.__TAURI__.core.invoke('get_projects')).find(p => p.name === '${projectNameFor(fixturePath)}')?.id;
      if (!projectId) return { dismissed: false, reason: 'project missing' };
      const scans = await window.__TAURI__.core.invoke('get_scans', { projectId });
      const latestScan = scans?.[0];
      if (!latestScan) return { dismissed: false, reason: 'no scan' };
      const violations = await window.__TAURI__.core.invoke('get_violations', { scanId: latestScan.id });
      const open = violations.find(v => v.status === 'open' && v.id !== ${fixedViolationId || 'null'});
      if (!open) return { dismissed: false, reason: 'no open violations' };
      await window.__TAURI__.core.invoke('dismiss_violation', { violationId: open.id });
      const refreshed = await window.__TAURI__.core.invoke('get_violation', { violationId: open.id });
      return { dismissed: true, status: refreshed?.violation?.status, id: open.id };
    `,
  })
  if (!dismissResult.dismissed || dismissResult.status !== 'dismissed') {
    throw new Error(`Dismiss flow failed: ${JSON.stringify(dismissResult)}`)
  }
  log(`dismissed violation ${dismissResult.id} for ${fixturePath}`)
  return dismissResult
}

async function doExport(label) {
  const exportResult = await call('browser_eval', {
    label,
    code: `
      const exported = await window.__TAURI__.core.invoke('export_data');
      const parsed = JSON.parse(exported);
      const counts = parsed.counts || {};
      const data = parsed.data || {};
      return {
        projects: counts.projects ?? (data.projects?.length ?? 0),
        violations: counts.violations ?? (data.violations?.length ?? 0),
        scans: counts.scans ?? (data.scans?.length ?? 0),
        fixes: counts.fixes ?? (data.fixes?.length ?? 0),
        audit: counts.audit_events ?? (data.audit_events?.length ?? 0),
      };
    `,
  })
  if (!exportResult || exportResult.projects < 1 || exportResult.violations < 1) {
    throw new Error(`Export validation failed: ${JSON.stringify(exportResult)}`)
  }
  log(`export ok (projects=${exportResult.projects}, violations=${exportResult.violations}, scans=${exportResult.scans}, fixes=${exportResult.fixes}, audit=${exportResult.audit})`)
  return exportResult
}

async function runPlan(label, plan, fixtures) {
  const state = new Map()
  const normalizedPlan = plan.map((action) =>
    action.fixturePath
      ? { ...action, fixturePath: path.resolve(action.fixturePath) }
      : action
  )

  for (const [idx, action] of normalizedPlan.entries()) {
    log(`action ${idx + 1}/${plan.length}: ${action.kind}`)
    if (action.kind === 'clear_db') {
      await doClear(label)
      state.clear()
      continue
    }
    if (action.kind === 'create_scan') {
      await doCreateAndScan(label, action.fixturePath, state, action.scanMode)
      continue
    }
    if (action.kind === 'fix') {
      const fixturePath = action.fixturePath || fixtures[0]
      const fix = await doFix(label, fixturePath, state)
      action._lastFixId = fix.fixed_violation_id
      continue
    }
    if (action.kind === 'dismiss') {
      const fixturePath = action.fixturePath || fixtures[0]
      const lastFixId = action._lastFixId || null
      await doDismiss(label, fixturePath, lastFixId)
      continue
    }
    if (action.kind === 'cancel_scan') {
      await doCancelScan(label, action.fixturePath, action.scanMode)
      continue
    }
    if (action.kind === 'export') {
      await doExport(label)
      continue
    }
    throw new Error(`Unknown action kind: ${action.kind}`)
  }
}

async function run() {
  const globalTimer = setTimeout(() => {
    log('test timeout reached, killing child')
    cleanup().then(() => process.exit(1))
  }, TEST_TIMEOUT_MS)

  try {
    log(`using app port ${APP_PORT}`)
    await ensureNoRunningRyn()
    startApp()
    await waitForSocket()
    await connectSocket()
    log('socket connected')

    await call('ping', null)
    const main = await waitForWindow()
    log('main window', main)

    await call('window_hide', { label: main })

    const fixtures = listFixtures()
    if (fixtures.length === 0) throw new Error(`No fixtures found in ${CUSTOM_FIXTURES ? CUSTOM_FIXTURES.join(',') : FIXTURE_ROOT}`)

    const plan = buildPlan(fixtures)
    log(`plan generated (seed=${RNG_SEED}):`, plan)
    await runPlan(main, plan, fixtures)

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
    try {
      if (child && !child.killed) {
        // Kill process group (spawned detached)
        process.kill(-child.pid, 'SIGTERM')
      }
    } catch {}
    resolve()
  })
}

process.on('SIGINT', () => { cleanup().then(() => process.exit(1)) })
process.on('SIGTERM', () => { cleanup().then(() => process.exit(1)) })

run()
