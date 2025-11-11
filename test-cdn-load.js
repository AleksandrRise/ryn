#!/usr/bin/env node

const net = require('net');
const socketPath = '/tmp/tauri-mcp.sock';

const testCode = `
(async () => {
  try {
    // Load html2canvas from CDN
    if (typeof window.html2canvas === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load'));
      });
    }
    return 'html2canvas loaded: ' + typeof html2canvas;
  } catch (error) {
    return 'ERROR: ' + error.message;
  }
})();
`;

const command = { command: 'execute_js', payload: { code: testCode } };

console.log('[TEST] Testing CDN load...');

const client = net.createConnection(socketPath, () => {
  client.write(JSON.stringify(command) + '\n');
});

let responseData = '';
client.on('data', (data) => {
  responseData += data.toString();
  try {
    const response = JSON.parse(responseData);
    console.log('[TEST] Result:', JSON.stringify(response, null, 2));
    client.end();
  } catch (e) {}
});

client.on('error', (err) => {
  console.error('[TEST] Error:', err.message);
  process.exit(1);
});

client.on('end', () => process.exit(0));

setTimeout(() => {
  console.error('[TEST] Timeout');
  client.end();
  process.exit(1);
}, 15000);
