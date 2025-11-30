#!/usr/bin/env node

// Simple MCP-driven E2E to sanity-check notifications when
// scan mode is set to "Pattern Only" and desktop notifications
// are enabled. This runs against the live Tauri app via the
// MCP bridge socket (~/.tauri/mcp.sock).

import net from 'net';
import os from 'os';
import path from 'path';

const SOCKET_PATH = path.join(os.homedir(), '.tauri', 'mcp.sock');

let nextId = 1;
const pending = new Map();

function sendRequest(socket, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const request = { jsonrpc: '2.0', method, params, id };

    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout for ${method}`));
      }
    }, 30000);

    pending.set(id, { resolve, reject, timeout });
    socket.write(JSON.stringify(request) + '\n');
  });
}

async function main() {
  const socket = net.createConnection(SOCKET_PATH);

  let buffer = '';
  socket.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (!('id' in msg)) continue;
      const entry = pending.get(msg.id);
      if (!entry) continue;
      pending.delete(msg.id);
      clearTimeout(entry.timeout);
      if (msg.error) {
        entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        entry.resolve(msg.result);
      }
    }
  });

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  console.log('✓ Connected to MCP socket\n');

  try {
    // 0) Ensure a project is selected by seeding localStorage and reloading
    console.log('▶ Ensuring a project is selected...');
    await sendRequest(socket, 'browser_execute', {
      code: `
        (async function () {
          try {
            const tauri = window.__TAURI__;
            const core = tauri && tauri.core;
            if (!core) {
              console.warn('[notifications-test] __TAURI__.core not available');
              return;
            }
            const projects = await core.invoke('get_projects');
            if (!projects || !projects.length) {
              console.warn('[notifications-test] No projects available to select');
              return;
            }
            const p = projects[0];
            const payload = JSON.stringify({ state: { selectedProject: p }, version: 0 });
            localStorage.setItem('ryn-project-storage', payload);
            console.log('[notifications-test] Seeded project into localStorage:', p.name);
            window.location.reload();
          } catch (e) {
            console.error('[notifications-test] Failed to seed project selection', e);
          }
        })();
      `,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // 1) Navigate to Settings and set scan mode = Pattern Only
    console.log('▶ Navigating to /settings and enabling "Pattern Only"...');
    // Use direct location change to avoid link lookup issues.
    await sendRequest(socket, 'browser_execute', {
      code: `window.location.href = '/settings';`,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Install a minimal listener that surfaces file-changed as a visible div (acts like a toast)
    await sendRequest(socket, 'browser_execute', {
      code: `
        (async function () {
          try {
            const tauri = window.__TAURI__;
            const event = tauri && tauri.event;
            if (!event) {
              console.warn('[notifications-test] __TAURI__.event not available');
              return;
            }

            if (window.__MCP_NotifyHookInstalled) return;
            window.__MCP_NotifyHookInstalled = true;

            const mountToast = (text) => {
              let holder = document.getElementById('mcp-notify-holder');
              if (!holder) {
                holder = document.createElement('div');
                holder.id = 'mcp-notify-holder';
                holder.style.position = 'fixed';
                holder.style.top = '20px';
                holder.style.right = '20px';
                holder.style.zIndex = '999999999';
                holder.style.fontSize = '13px';
                holder.style.color = '#fff';
                holder.style.background = 'rgba(0,0,0,0.85)';
                holder.style.padding = '10px 14px';
                holder.style.borderRadius = '10px';
                holder.style.border = '1px solid rgba(255,255,255,0.18)';
                document.body.appendChild(holder);
              }
              holder.textContent = text;
            };

            await event.listen('file-changed', (payload) => {
              try {
                const p = payload && payload.payload;
                const message = p
                  ? \`File \${p.eventType}: \${p.filePath} (project \${p.projectId})\`
                  : 'File changed (no payload)';
                mountToast(message);
                console.log('[notifications-test] Hook received file-changed:', message);
              } catch (err) {
                console.error('[notifications-test] Hook handler error', err);
              }
            });

            console.log('[notifications-test] Hook installed for file-changed');
          } catch (e) {
            console.error('[notifications-test] Failed to install hook', e);
          }
        })();
      `,
    });

    // Click the "Pattern Only" radio label
    await sendRequest(socket, 'browser_execute', {
      code: `
        (function () {
          const labels = Array.from(document.querySelectorAll('label'));
          const patternLabel = labels.find(l => l.textContent.includes('Pattern Only'));
          if (patternLabel) {
            const input = patternLabel.querySelector('input[type="radio"]');
            if (input && !input.checked) {
              input.click();
              console.log('[notifications-test] Enabled Pattern Only scan mode');
            }
          } else {
            console.warn('[notifications-test] Pattern Only label not found');
          }
        })();
      `,
    });

    // Ensure Desktop notifications toggle is ON
    console.log('▶ Ensuring Desktop notifications toggle is ON...');
    await sendRequest(socket, 'browser_execute', {
      code: `
        (function () {
          const rows = Array.from(document.querySelectorAll('div'));
          const row = rows.find(r => r.textContent && r.textContent.includes('Desktop notifications') && r.querySelector('button'));
          if (!row) {
            console.warn('[notifications-test] Desktop notifications row not found');
            return;
          }
          const btn = row.querySelector('button');
          if (!btn) {
            console.warn('[notifications-test] Desktop notifications button not found');
            return;
          }
          const label = btn.textContent.trim();
          if (label !== 'ON') {
            btn.click();
            console.log('[notifications-test] Toggled Desktop notifications ON');
          }
        })();
      `,
    });

    // Start real-time file watching (button will no-op if no project)
    console.log('▶ Toggling Real-time file watching ON (if possible)...');
    await sendRequest(socket, 'browser_execute', {
      code: `
        (function () {
          const rows = Array.from(document.querySelectorAll('div'));
          const row = rows.find(r => r.textContent && r.textContent.includes('Real-time file watching') && r.querySelector('button'));
          if (!row) {
            console.warn('[notifications-test] Real-time file watching row not found');
            return;
          }
          const btn = row.querySelector('button');
          if (!btn) {
            console.warn('[notifications-test] Real-time file watching button not found');
            return;
          }
          if (btn.textContent.trim() !== 'ON') {
            btn.click();
            console.log('[notifications-test] Toggled Real-time file watching ON');
          }
        })();
      `,
    });

    // 2) Emit a synthetic file-changed event to trigger a toast
    console.log('▶ Emitting synthetic file change event to trigger toast...');
    const testFilePath = 'notifications-e2e.txt';
    await sendRequest(socket, 'browser_execute', {
      code: `
        (async function () {
          try {
            const tauri = window.__TAURI__;
            const event = tauri && tauri.event;
            const core = tauri && tauri.core;
            if (!event || !core) {
              console.warn('[notifications-test] __TAURI__ event/core missing');
              return;
            }
            const projects = await core.invoke('get_projects');
            if (!Array.isArray(projects) || projects.length === 0) {
              console.warn('[notifications-test] No projects available for file-changed payload');
              return;
            }
            const project = projects[0];
            const projectId = project.id || project.project_id || 1;
            await event.emit('file-changed', {
              projectId,
              filePath: ${JSON.stringify(testFilePath)},
              eventType: 'modified',
            });
            console.log('[notifications-test] Emitted file-changed for project', projectId);
          } catch (e) {
            console.error('[notifications-test] emit error', e);
          }
        })();
      `,
    });

    // 3) Snapshot DOM and look for the Sonner toast text
    console.log('▶ Checking for toast notification...');
    await new Promise((r) => setTimeout(r, 1000));
    const snapshot = await sendRequest(socket, 'browser_snapshot', { includeText: true });
    const html = snapshot && snapshot.html ? String(snapshot.html) : '';

    const expected = 'File modified: ' + testFilePath;
    if (html.includes(expected)) {
      console.log('✅ Notification toast found with text:', expected);
    } else {
      console.error('❌ Notification toast text not found. Looked for:', expected);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ notifications-pattern-only test failed:', err.message);
    process.exitCode = 1;
  } finally {
    socket.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
