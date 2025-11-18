import { join } from 'path'

/**
 * WebdriverIO Configuration for Ryn E2E Tests
 * Tests run against actual Tauri app with real backend
 */

const wdioConfig = {
  runner: 'local',
  port: 4723,
  specs: [
    'e2e-tests/specs/**/*.spec.js',
  ],
  exclude: [],

  maxInstances: 1,
  capabilities: [{
    platformName: 'mac',
    'appium:automationName': 'mac2',
    'appium:app': join(
      process.cwd(),
      'src-tauri/target/release/Ryn.app/Contents/MacOS/Ryn'
    ),
  }],

  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:3000',
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  reporters: ['spec'],

  beforeSession: async () => {
    // Ensure Tauri driver is installed
    try {
      require('tauri-driver')
    } catch {
      throw new Error('tauri-driver not found. Install with: cargo install tauri-driver')
    }
  },

  before: async () => {
    // Global setup before tests run
    console.log('Starting E2E tests against Ryn backend')
  },

  after: async () => {
    console.log('E2E tests completed')
  },
}

export { wdioConfig as config }
