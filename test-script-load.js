#!/usr/bin/env node

const net = require('net');
const socketPath = '/tmp/tauri-mcp.sock';

const testCode = `
(async () => {
  try {
    console.log('[TEST] Starting script load test...');

    // Try to load a simple external script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    document.head.appendChild(script);

    const result = await new Promise((resolve, reject) => {
      script.onload = () => resolve('Script loaded successfully');
      script.onerror = (err) => reject(new Error('Script failed to load'));
      setTimeout(() => reject(new Error('Script load timeout')), 10000);
    });

    console.log('[TEST]', result);
    console.log('[TEST] html2canvas type:', typeof html2canvas);

    return result + ', html2canvas type: ' + typeof html2canvas;
  } catch (error) {
    console.error('[TEST] ERROR:', error);
    return 'FAILED: ' + error.message;
  }
})();
`;

const command = { command: 'execute_js', payload: { code: testCode } };

console.log('[TEST] Testing external script loading...');

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
