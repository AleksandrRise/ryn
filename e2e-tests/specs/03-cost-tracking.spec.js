/**
 * E2E Tests: Cost Tracking and Limits
 *
 * Tests the cost tracking functionality to ensure accurate token usage monitoring
 * and proper enforcement of cost limits during LLM scans:
 * - Token usage tracking during LLM analysis (input, output, cache read/write)
 * - Cost limit enforcement with user prompts
 * - Scan termination when user declines cost limit override
 *
 * Architecture reference (from src-tauri/src/commands/scan.rs):
 * - Every 10 files analyzed, backend checks cost_limit_per_scan setting
 * - If exceeded, emits "cost-limit-reached" event to frontend
 * - User responds via respond_to_cost_limit command (continue: true/false)
 * - All costs stored in scan_costs table (tokens + USD)
 */

import { browser, expect } from '@wdio/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Django violations fixture folder (contains multiple files for LLM analysis)
const DJANGO_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/django-violations');

describe('Cost Tracking E2E Tests', () => {
  let projectId;

  /**
   * Setup: Create project with Django fixtures
   */
  before(async () => {
    // Navigate to settings page to configure scan mode and cost limit
    await browser.url('/settings');

    // Set LLM scan mode to "smart" (analyzes ~30-40% of files with AI)
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llm_scan_mode: 'smart',
        cost_limit_per_scan: 0.01, // Very low limit ($0.01) to trigger cost-limit event
      });
    });

    console.log('Configured settings: llm_scan_mode=smart, cost_limit_per_scan=$0.01');

    // Navigate to scan page
    await browser.url('/scan');

    // Create project using Django violations fixture
    projectId = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('create_project', {
          name: 'Cost Tracking Test Project',
          path: fixturesPath,
        });
        return project.project_id;
      },
      DJANGO_FIXTURES_PATH
    );

    console.log(`Created project with ID: ${projectId}`);
  });

  /**
   * Test: Track Token Usage During LLM Scan
   *
   * Tests that the application accurately tracks token usage when performing
   * LLM analysis on files during a scan.
   *
   * Scenario:
   * 1. Start a scan in "smart" mode (AI analyzes security-critical files)
   * 2. Wait for scan to complete
   * 3. Navigate to analytics page
   * 4. Verify token usage data is displayed (input, output, cache tokens)
   * 5. Verify total cost in USD is calculated
   *
   * Expected:
   * - scan_costs table should have entries with token counts > 0
   * - Analytics page should display token usage breakdown
   * - Total cost should be calculated based on Claude Haiku 4.5 pricing
   */
  it('should track token usage during LLM scan', async () => {
    console.log('Starting LLM scan with cost tracking...');

    // Start scan
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await scanButton.click();

    // Wait for scan to complete (may take longer due to LLM analysis)
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return statusText.toLowerCase().includes('complete');
      },
      {
        timeout: 120000, // 2 minutes - LLM scans take longer
        timeoutMsg: 'Scan did not complete within 2 minutes',
        interval: 2000,
      }
    );

    console.log('Scan completed, checking cost tracking data...');

    // Navigate to analytics page to view cost data
    await browser.url('/analytics');

    // Wait for analytics page to load
    const analyticsContainer = await browser.$('[data-testid="analytics-container"]');
    await expect(analyticsContainer).toBeDisplayed();

    // Verify token usage card is displayed
    const tokenUsageCard = await browser.$('[data-testid="token-usage-card"]');
    await expect(tokenUsageCard).toBeDisplayed();

    // Get token usage data from the UI
    const inputTokens = await browser.$('[data-testid="input-tokens"]');
    const outputTokens = await browser.$('[data-testid="output-tokens"]');
    const cacheReadTokens = await browser.$('[data-testid="cache-read-tokens"]');
    const cacheWriteTokens = await browser.$('[data-testid="cache-write-tokens"]');
    const totalCost = await browser.$('[data-testid="total-cost-usd"]');

    // Verify all token counts are displayed and non-zero (LLM was used)
    const inputCount = parseInt(await inputTokens.getText());
    const outputCount = parseInt(await outputTokens.getText());

    expect(inputCount).toBeGreaterThan(0);
    expect(outputCount).toBeGreaterThan(0);

    // Verify total cost is calculated and displayed
    const costText = await totalCost.getText();
    expect(costText).toMatch(/\$\d+\.\d{2}/); // Matches $X.XX format

    console.log(`✓ Token usage tracked: ${inputCount} input, ${outputCount} output`);
    console.log(`✓ Total cost: ${costText}`);

    // Alternatively, verify via Tauri command to check scan_costs table
    const scanCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs');
    });

    expect(scanCosts.length).toBeGreaterThan(0);
    const latestCost = scanCosts[0];

    expect(latestCost.input_tokens).toBeGreaterThan(0);
    expect(latestCost.output_tokens).toBeGreaterThan(0);
    expect(latestCost.total_cost_usd).toBeGreaterThan(0);

    console.log('✓ Scan cost data verified in database');
  });

  /**
   * Test: Prompt User When Cost Limit is Exceeded
   *
   * Tests that when the cost limit is exceeded during a scan, the application
   * prompts the user for confirmation to continue.
   *
   * Scenario:
   * 1. Set a very low cost limit ($0.001) to guarantee it will be exceeded
   * 2. Start a scan in "analyze_all" mode (analyzes every file)
   * 3. Wait for cost-limit-reached event or modal to appear
   * 4. Verify the prompt displays current cost and asks to continue
   * 5. Click "Continue" to override the limit
   * 6. Verify scan completes successfully
   *
   * Expected:
   * - Cost limit prompt modal should appear during scan
   * - Modal should show current cost and limit
   * - Clicking "Continue" should allow scan to proceed
   */
  it('should prompt user when cost limit is exceeded', async () => {
    console.log('Configuring very low cost limit to trigger prompt...');

    // Set extremely low cost limit to guarantee it will be exceeded
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llm_scan_mode: 'analyze_all', // Analyze all files to maximize cost
        cost_limit_per_scan: 0.001, // $0.001 - will be exceeded after first few files
      });
    });

    console.log('Settings updated: llm_scan_mode=analyze_all, cost_limit_per_scan=$0.001');

    // Navigate back to scan page
    await browser.url('/scan');

    // Start scan
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await scanButton.click();

    console.log('Scan started, waiting for cost limit prompt...');

    // Wait for cost limit modal to appear
    const costLimitModal = await browser.$('[data-testid="cost-limit-modal"]');
    await costLimitModal.waitForDisplayed({
      timeout: 60000,
      timeoutMsg: 'Cost limit modal did not appear within 60 seconds. Cost limit may not have been exceeded.',
    });

    console.log('✓ Cost limit modal appeared');

    // Verify modal content
    const modalTitle = await browser.$('[data-testid="modal-title"]');
    await expect(modalTitle).toHaveText(expect.stringContaining('Cost Limit'));

    // Verify current cost is displayed
    const currentCostDisplay = await browser.$('[data-testid="current-cost"]');
    await expect(currentCostDisplay).toBeDisplayed();

    // Verify cost limit is displayed
    const limitDisplay = await browser.$('[data-testid="cost-limit"]');
    await expect(limitDisplay).toHaveText(expect.stringContaining('$0.001'));

    console.log('✓ Cost limit modal displays current cost and limit');

    // Click "Continue" button to override the limit
    const continueButton = await browser.$('button[data-testid="continue-scan-btn"]');
    await continueButton.click();

    console.log('Clicked "Continue" to override cost limit');

    // Verify modal closes
    await browser.waitUntil(
      async () => {
        const isDisplayed = await costLimitModal.isDisplayed();
        return !isDisplayed;
      },
      {
        timeout: 5000,
        timeoutMsg: 'Cost limit modal did not close after clicking Continue',
      }
    );

    // Wait for scan to complete
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return statusText.toLowerCase().includes('complete');
      },
      {
        timeout: 120000,
        timeoutMsg: 'Scan did not complete after overriding cost limit',
        interval: 2000,
      }
    );

    console.log('✓ Scan completed successfully after cost limit override');

    // Verify violations were detected (scan actually completed)
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');
    expect(violationRows.length).toBeGreaterThan(0);

    console.log(`✓ Scan detected ${violationRows.length} violations`);
  });

  /**
   * Test: Stop Scanning When User Declines Cost Limit Override
   *
   * Tests that when the user declines to override the cost limit, the scan
   * is properly terminated.
   *
   * Scenario:
   * 1. Set a very low cost limit to trigger the prompt quickly
   * 2. Start a scan
   * 3. Wait for cost-limit-reached prompt
   * 4. Click "Stop Scan" to decline the override
   * 5. Verify scan is terminated
   * 6. Verify partial results are still available
   *
   * Expected:
   * - Cost limit prompt should appear
   * - Clicking "Stop Scan" should terminate the scan
   * - Scan status should show "Stopped" or "Cancelled"
   * - Any violations detected before limit should still be visible
   */
  it('should stop scanning if user declines cost limit override', async () => {
    console.log('Configuring low cost limit and starting scan...');

    // Ensure low cost limit is still set
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llm_scan_mode: 'analyze_all',
        cost_limit_per_scan: 0.001, // Very low limit
      });
    });

    // Navigate to scan page
    await browser.url('/scan');

    // Clear any previous violations by creating a new project
    const newProjectId = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('create_project', {
          name: 'Cost Limit Decline Test',
          path: fixturesPath,
        });
        return project.project_id;
      },
      DJANGO_FIXTURES_PATH
    );

    console.log(`Created new test project with ID: ${newProjectId}`);

    // Start scan
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await scanButton.click();

    console.log('Scan started, waiting for cost limit prompt...');

    // Wait for cost limit modal to appear
    const costLimitModal = await browser.$('[data-testid="cost-limit-modal"]');
    await costLimitModal.waitForDisplayed({
      timeout: 60000,
      timeoutMsg: 'Cost limit modal did not appear',
    });

    console.log('✓ Cost limit modal appeared');

    // Click "Stop Scan" button to decline the override
    const stopButton = await browser.$('button[data-testid="stop-scan-btn"]');
    await expect(stopButton).toBeDisplayed();
    await stopButton.click();

    console.log('Clicked "Stop Scan" to decline cost limit override');

    // Verify modal closes
    await browser.waitUntil(
      async () => {
        const isDisplayed = await costLimitModal.isDisplayed();
        return !isDisplayed;
      },
      {
        timeout: 5000,
        timeoutMsg: 'Cost limit modal did not close after clicking Stop',
      }
    );

    // Verify scan status shows it was stopped
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return (
          statusText.toLowerCase().includes('stopped') ||
          statusText.toLowerCase().includes('cancelled') ||
          statusText.toLowerCase().includes('incomplete')
        );
      },
      {
        timeout: 10000,
        timeoutMsg: 'Scan status did not update to stopped/cancelled',
        interval: 500,
      }
    );

    const finalStatus = await scanStatus.getText();
    console.log(`✓ Scan terminated with status: ${finalStatus}`);

    // Verify that partial results are still available
    // (Violations detected before cost limit was hit should be visible)
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');

    // Should have at least some violations from regex phase (which is free)
    // or from LLM analysis before limit was exceeded
    expect(violationRows.length).toBeGreaterThan(0);

    console.log(`✓ Partial results available: ${violationRows.length} violations detected before stop`);

    // Verify scan button is re-enabled (can start a new scan)
    const scanButtonAfter = await browser.$('button[data-testid="scan-project-btn"]');
    await expect(scanButtonAfter).toBeEnabled();

    console.log('✓ Scan button re-enabled, ready for new scan');
  });

  /**
   * Cleanup: Reset settings to defaults
   */
  after(async () => {
    console.log('Resetting settings to defaults...');

    // Reset to smart mode with reasonable cost limit
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llm_scan_mode: 'smart',
        cost_limit_per_scan: 1.0, // $1.00 default
      });
    });

    console.log('Cost tracking tests complete');
  });
});
/* eslint-disable @typescript-eslint/no-unused-vars */
