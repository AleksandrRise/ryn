#!/usr/bin/env node

const net = require('net');

const socketPath = '/tmp/tauri-mcp.sock';

// Test if html2canvas can be imported
const testCode = `
(async () => {
  try {
    const { default: html2canvas } = await import('html2canvas');
    return 'html2canvas imported successfully: ' + typeof html2canvas;
  } catch (error) {
    return 'html2canvas import FAILED: ' + error.message;
  }
})();
`;

const command = {
  command: 'execute_js',
  payload: {
    code: testCode
  }
};

console.log('[TEST] Testing html2canvas import...');

const client = net.createConnection(socketPath, () => {
  console.log('[TEST] Connected');
  client.write(JSON.stringify(command) + '\n');
});

let responseData = '';

client.on('data', (data) => {
  responseData += data.toString();
  try {
    const response = JSON.parse(responseData);
    console.log('[TEST] Result:', response);
    client.end();
  } catch (e) {
    // Incomplete JSON
  }
});

client.on('error', (err) => {
  console.error('[TEST] Error:', err.message);
  process.exit(1);
});

client.on('end', () => {
  process.exit(0);
});

setTimeout(() => {
  console.error('[TEST] Timeout');
  client.end();
  process.exit(1);
}, 10000);
