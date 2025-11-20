#!/usr/bin/env node

// Simple E2E-style exercise of the Settings page buttons
// using the Tauri MCP bridge. This script connects directly
// to the Unix socket exposed by `tauri-plugin-mcp-bridge`
// and sends JSON-RPC commands such as `browser_navigate`
// and `browser_execute`.

import net from 'net';
import os from 'os';
import path from 'path';

const SOCKET_PATH = path.join(os.homedir(), '.tauri', 'mcp.sock');

let nextId = 1;
const pending = new Map();

function sendRequest(socket, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    pending.set(id, { resolve, reject });
    socket.write(JSON.stringify(request) + '\n');

    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout for ${method}`));
      }
    }, 30000);

    // Attach timeout handle so we can clear it when the response arrives
    pending.get(id).timeout = timeout;
  });
}

async function clickButtonByText(socket, text) {
  console.log(`▶ Clicking button with exact text: "${text}"`);
  const js = `
    (function() {
      const targetText = ${JSON.stringify(text)};
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find(b => b.textContent.trim() === targetText);
      if (!target) {
        console.warn('[MCP settings test] Button not found:', targetText);
        return;
      }
      target.click();
    })();
  `;
  await sendRequest(socket, 'browser_execute', { code: js });
}

async function clickSectionToggle(socket, labelText) {
  console.log(`▶ Toggling button in row: "${labelText}"`);
  const js = `
    (function() {
      const labelText = ${JSON.stringify(labelText)};
      const rows = Array.from(document.querySelectorAll('div'));
      const row = rows.find(r => r.textContent && r.textContent.includes(labelText) && r.querySelector('button'));
      if (!row) {
        console.warn('[MCP settings test] Row not found for label:', labelText);
        return;
      }
      const btn = row.querySelector('button');
      if (!btn) {
        console.warn('[MCP settings test] No button in row for label:', labelText);
        return;
      }
      btn.click();
    })();
  `;
  await sendRequest(socket, 'browser_execute', { code: js });
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
      if (!('id' in msg)) {
        // Notification, ignore.
        continue;
      }
      const pendingEntry = pending.get(msg.id);
      if (!pendingEntry) continue;
      pending.delete(msg.id);
      clearTimeout(pendingEntry.timeout);
      if (msg.error) {
        pendingEntry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        pendingEntry.resolve(msg.result);
      }
    }
  });

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  console.log('✓ Connected to Tauri MCP socket\n');

  try {
    // Navigate to the Settings page by path
    console.log('▶ Navigating to /settings via browser_navigate...');
    await sendRequest(socket, 'browser_navigate', { url: 'https://app.local/settings' });
    await new Promise((r) => setTimeout(r, 1500));

    // Top-right header buttons
    await clickButtonByText(socket, 'Export');
    await new Promise((r) => setTimeout(r, 500));
    await clickButtonByText(socket, 'Save Changes');
    await new Promise((r) => setTimeout(r, 500));

    // Monitoring toggles
    await clickSectionToggle(socket, 'Desktop notifications');
    await new Promise((r) => setTimeout(r, 300));
    await clickSectionToggle(socket, 'Real-time file watching');
    await new Promise((r) => setTimeout(r, 300));

    // Data actions
    await clickButtonByText(socket, 'Export all data');
    await new Promise((r) => setTimeout(r, 500));
    await clickButtonByText(socket, 'Clear scan history');
    await new Promise((r) => setTimeout(r, 500));

    console.log('\n✅ Finished exercising Settings buttons via Tauri MCP.\n');
  } catch (err) {
    console.error('\n❌ Settings MCP test failed:', err.message);
    process.exitCode = 1;
  } finally {
    socket.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
