#!/usr/bin/env node

const net = require('net');
const socketPath = '/tmp/tauri-mcp.sock';

const testCode = `
(async () => {
  // Simple async test without console.log
  await new Promise(resolve => setTimeout(resolve, 100));
  return 'async test completed';
})();
`;

const command = { command: 'execute_js', payload: { code: testCode } };

const client = net.createConnection(socketPath, () => {
  client.write(JSON.stringify(command) + '\n');
});

let responseData = '';
client.on('data', (data) => {
  responseData += data.toString();
  try {
    const response = JSON.parse(responseData);
    console.log('Result:', JSON.stringify(response, null, 2));
    client.end();
  } catch (e) {}
});

client.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

client.on('end', () => process.exit(0));

setTimeout(() => {
  console.error('Timeout');
  client.end();
  process.exit(1);
}, 10000);
