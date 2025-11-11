#!/usr/bin/env node

const fs = require('fs');
const net = require('net');

const socketPath = '/tmp/tauri-mcp.sock';

const command = {
  command: 'webview_screenshot',
  payload: {
    max_width: 1920,
    quality: 0.85
  }
};

console.log('[TEST] Testing webview_screenshot command...');
console.log('[TEST] Payload:', JSON.stringify(command.payload));

const client = net.createConnection(socketPath, () => {
  console.log('[TEST] Connected to MCP socket');
  client.write(JSON.stringify(command) + '\n');
});

let responseData = '';
client.on('data', (data) => {
  responseData += data.toString();
  try {
    const response = JSON.parse(responseData);
    console.log('[TEST] Response received');
    
    if (response.error) {
      console.error('[ERROR]', response.error);
      client.end();
      process.exit(1);
    }

    const result = response.result || response.data;
    
    // Verify it's a data URL
    if (typeof result !== 'string' || !result.startsWith('data:image/jpeg')) {
      console.error('[ERROR] Invalid screenshot data format');
      console.error('[ERROR] Result type:', typeof result);
      console.error('[ERROR] First 100 chars:', result?.substring(0, 100));
      client.end();
      process.exit(1);
    }

    console.log('[SUCCESS] Screenshot generated!');
    console.log('[INFO] Data URL length:', result.length);
    console.log('[INFO] Data URL prefix:', result.substring(0, 60) + '...');
    
    // Extract and validate base64
    try {
      const base64 = result.replace(/^data:image\/jpeg;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      console.log('[INFO] Screenshot size:', Math.round(buffer.length / 1024), 'KB');
      
      // Save screenshot for manual verification
      const screenshotPath = '/tmp/ryn-screenshot-test.jpg';
      fs.writeFileSync(screenshotPath, buffer);
      console.log('[INFO] Screenshot saved to:', screenshotPath);
    } catch (e) {
      console.error('[WARNING] Could not save screenshot:', e.message);
    }
    
    console.log('[SUCCESS] webview_screenshot command works correctly!');
    client.end();
  } catch (e) {
    // Wait for more data
  }
});

client.on('error', (err) => {
  console.error('[ERROR] Socket error:', err.message);
  process.exit(1);
});

client.on('end', () => process.exit(0));

setTimeout(() => {
  console.error('[ERROR] Timeout waiting for response');
  client.end();
  process.exit(1);
}, 15000);
