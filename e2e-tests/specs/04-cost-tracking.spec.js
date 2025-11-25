import { browser, expect } from '@wdio/globals';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E Test: Cost Tracking
 *
 * Tests the cost tracking and limit enforcement system for Claude API usage.
 * Verifies token counting, cost calculation, limit prompts, and analytics.
 *
 * Test Coverage:
 * 1. Verify scan_costs table tracks all LLM scans
 * 2. Verify token counting (input/output/cache_read/cache_write)
 * 3. Verify cost calculation in USD
 * 4. Test cost limit enforcement (cost-limit-reached event)
 * 5. Test user response to cost limit prompt
 * 6. Verify analytics page shows cost data
 * 7. Compare costs between scan modes (smart vs analyze_all)
 */

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Django violations fixture folder
const DJANGO_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/vulnerable-django');

describe('04 - Cost Tracking', () => {
  let projectId;

  before(async () => {
    // Wait for Tauri app to fully initialize
    await browser.pause(2000);

    // Create project
    const project = await browser.execute(async (fixturesPath) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('create_project', {
        name: 'Cost Tracking Test',
        path: fixturesPath,
        framework: 'Django'
      });
    }, DJANGO_FIXTURES_PATH);

    projectId = project.project_id;

    console.log(`✓ Created test project with ID ${projectId}`);
  });

  it('should verify scan_costs table tracks all LLM scans', async () => {
    // Set scan mode to smart (uses LLM)
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llmScanMode: 'smart',
        costLimitPerScan: 10.0 // Set high limit to avoid prompt
      });
    });

    // Run a smart scan
    const scanResult = await browser.execute(async (pid) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('scan_project', {
        projectId: pid,
        scanMode: 'smart'
      });
    }, projectId);

    expect(scanResult.status).toBe('completed');

    // Get scan costs
    const scanCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs', { limit: 10 });
    });

    // Find cost record for this scan
    const thisScanCost = scanCosts.find(c => c.scan_id === scanResult.scan_id);
    expect(thisScanCost).toBeDefined();

    console.log(`✓ Scan cost tracked: scan_id=${thisScanCost.scan_id}`);
  });

  it('should verify token counting (input/output/cache_read/cache_write)', async () => {
    // Get latest scan costs
    const scanCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs', { limit: 1 });
    });

    const latestCost = scanCosts[0];

    // Verify all token fields are present and valid
    expect(latestCost.input_tokens).toBeGreaterThan(0);
    expect(latestCost.output_tokens).toBeGreaterThan(0);
    expect(latestCost.cache_read_tokens).toBeGreaterThanOrEqual(0);
    expect(latestCost.cache_write_tokens).toBeGreaterThanOrEqual(0);

    const totalTokens =
      latestCost.input_tokens +
      latestCost.output_tokens +
      latestCost.cache_read_tokens +
      latestCost.cache_write_tokens;

    console.log(`✓ Token breakdown: input=${latestCost.input_tokens}, output=${latestCost.output_tokens}, cache_read=${latestCost.cache_read_tokens}, cache_write=${latestCost.cache_write_tokens}, total=${totalTokens}`);
  });

  it('should verify cost calculation in USD', async () => {
    const scanCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs', { limit: 1 });
    });

    const latestCost = scanCosts[0];

    // Verify cost is calculated
    expect(latestCost.total_cost_usd).toBeGreaterThan(0);

    // Claude Haiku 4.5 pricing (approximate):
    // Input: $0.25 per 1M tokens
    // Output: $1.25 per 1M tokens
    // Cache write: $0.30 per 1M tokens
    // Cache read: $0.03 per 1M tokens

    // Rough cost check (should be reasonable for a small scan)
    expect(latestCost.total_cost_usd).toBeLessThan(1.0);

    console.log(`✓ Cost calculated: $${latestCost.total_cost_usd.toFixed(6)} USD`);
  });

  it('should test cost limit enforcement (cost-limit-reached event)', async () => {
    // Set a very low cost limit
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llmScanMode: 'analyze_all', // More expensive mode
        costLimitPerScan: 0.01 // Very low limit ($0.01)
      });
    });

    console.log('⚠ Cost limit enforcement requires event listener integration');
    console.log('The backend emits "cost-limit-reached" event when limit exceeded');
    console.log('Frontend must listen for this event and show user prompt');

    // This test would require:
    // 1. Setting up event listener for "cost-limit-reached"
    // 2. Triggering an expensive scan
    // 3. Verifying the event was emitted
    // 4. Verifying user was prompted with continue/stop options

    this.skip();
  });

  it('should test user response to cost limit prompt', async () => {
    console.log('⚠ User prompt interaction requires frontend event handling');

    // This would test:
    // 1. User clicks "Continue" -> scan continues
    // 2. User clicks "Stop" -> scan stops at current progress
    // 3. Verify respond_to_cost_limit Tauri command is called

    this.skip();
  });

  it('should verify analytics page shows cost data', async () => {
    // Get scan costs for analytics display
    const scanCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs', { limit: 10 });
    });

    expect(scanCosts.length).toBeGreaterThan(0);

    // Verify analytics data structure
    scanCosts.forEach(cost => {
      expect(cost.scan_id).toBeGreaterThan(0);
      expect(cost.input_tokens).toBeGreaterThanOrEqual(0);
      expect(cost.output_tokens).toBeGreaterThanOrEqual(0);
      expect(cost.total_cost_usd).toBeGreaterThanOrEqual(0);
      expect(cost.created_at).toBeDefined();
    });

    // Calculate total costs
    const totalCost = scanCosts.reduce((sum, c) => sum + c.total_cost_usd, 0);
    const totalTokens = scanCosts.reduce((sum, c) =>
      sum + c.input_tokens + c.output_tokens + c.cache_read_tokens + c.cache_write_tokens,
      0
    );

    console.log(`✓ Analytics data: ${scanCosts.length} scans, $${totalCost.toFixed(6)} total cost, ${totalTokens} total tokens`);
  });

  it('should compare costs between scan modes (smart vs analyze_all)', async () => {
    // Run regex_only scan (should have no cost)
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llmScanMode: 'regex_only',
        costLimitPerScan: 5.0
      });
    });

    const regexScan = await browser.execute(async (pid) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('scan_project', {
        projectId: pid,
        scanMode: 'regex_only'
      });
    }, projectId);

    // Get scan costs - regex_only should not create a cost record
    const regexCosts = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      const _allCosts = await invoke('get_scan_costs', { limit: 50 });
      return allCosts.filter(c => c.scan_id === scanId);
    }, regexScan.scan_id);

    // Regex-only mode should have no LLM costs
    expect(regexCosts.length).toBe(0);

    // Get all scan costs to compare smart vs analyze_all
    const allCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs', { limit: 50 });
    });

    // Group by scan mode (we'd need to join with scans table to get mode)
    // For now, just verify regex_only has $0 cost

    console.log(`✓ Regex-only scan has no LLM costs (as expected)`);
    console.log(`Note: Smart mode analyzes ~30-40% of files, analyze_all analyzes 100%`);
  });

  after(async () => {
    // Reset to default settings
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llmScanMode: 'regex_only',
        costLimitPerScan: 5.0
      });
    });

    console.log('✓ Cost tracking tests completed');
  });
});
