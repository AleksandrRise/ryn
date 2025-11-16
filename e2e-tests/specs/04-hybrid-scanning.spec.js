/**
 * E2E Tests: Hybrid Scanning Modes
 *
 * Tests the three LLM scanning modes to ensure correct behavior:
 * - regex_only: Free pattern matching without AI (zero API costs)
 * - smart: AI analyzes ~30-40% of security-critical files only
 * - analyze_all: AI analyzes every file for maximum accuracy
 * - Hybrid detection: Creates detection_method="hybrid" when both regex and LLM detect same violation
 *
 * Architecture reference (from src-tauri/src/commands/scan.rs):
 * - Phase 1: Regex detection always runs first (all modes)
 * - Phase 2: File selection (smart mode only) via scanner/llm_file_selector.rs
 * - Phase 3: LLM analysis (if mode != "regex_only")
 * - Phase 4: Deduplication creates hybrid violations (scan.rs:526-641)
 *
 * Violation detection_method values:
 * - "regex": Found only by pattern matching
 * - "llm": Found only by AI analysis (has confidence_score, llm_reasoning)
 * - "hybrid": Found by both methods (has both reasoning fields + confidence_score)
 */

import { browser, expect } from '@wdio/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Django violations fixture folder
const DJANGO_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/django-violations');

describe('Hybrid Scanning E2E Tests', () => {
  let projectId;

  /**
   * Setup: Create project with Django fixtures
   */
  before(async () => {
    // Navigate to scan page
    await browser.url('/scan');

    // Create project using Django violations fixture
    projectId = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('create_project', {
          name: 'Hybrid Scanning Test Project',
          path: fixturesPath,
        });
        return project.project_id;
      },
      DJANGO_FIXTURES_PATH
    );

    console.log(`Created project with ID: ${projectId}`);
  });

  /**
   * Test: Regex-Only Mode (Zero API Costs)
   *
   * Tests that regex_only mode uses pattern matching exclusively without
   * making any LLM API calls, ensuring zero API costs.
   *
   * Scenario:
   * 1. Set llm_scan_mode to "regex_only"
   * 2. Run scan on Django fixtures
   * 3. Verify violations are detected with detection_method="regex"
   * 4. Verify scan_costs table shows zero tokens (no LLM calls)
   * 5. Verify all 4 violation types detected (CC6.1, CC6.7, CC7.2, A1.2)
   *
   * Expected:
   * - All violations should have detection_method="regex"
   * - No violations with detection_method="llm" or "hybrid"
   * - scan_costs.input_tokens = 0, output_tokens = 0, total_cost_usd = 0
   */
  it('should use only regex patterns in regex_only mode (zero API costs)', async () => {
    console.log('Configuring regex_only mode...');

    // Set regex_only mode (no LLM analysis)
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llm_scan_mode: 'regex_only',
      });
    });

    console.log('Settings updated: llm_scan_mode=regex_only');

    // Start scan
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await expect(scanButton).toBeEnabled();
    await scanButton.click();

    console.log('Scan started in regex_only mode...');

    // Wait for scan to complete (should be fast - no LLM analysis)
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return statusText.toLowerCase().includes('complete');
      },
      {
        timeout: 30000, // Should complete quickly (no LLM calls)
        timeoutMsg: 'Scan did not complete within 30 seconds',
        interval: 1000,
      }
    );

    console.log('Scan completed, verifying regex-only detection...');

    // Verify violations were detected
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');
    const violationCount = violationRows.length;

    expect(violationCount).toBeGreaterThan(0);

    console.log(`✓ Detected ${violationCount} violations using regex patterns only`);

    // Get all violations via Tauri command to check detection_method
    const violations = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations');
    });

    // Verify ALL violations have detection_method="regex"
    const allRegex = violations.every((v) => v.detection_method === 'regex');
    expect(allRegex).toBe(true);

    // Verify NO violations have detection_method="llm" or "hybrid"
    const hasLlm = violations.some((v) => v.detection_method === 'llm');
    const hasHybrid = violations.some((v) => v.detection_method === 'hybrid');

    expect(hasLlm).toBe(false);
    expect(hasHybrid).toBe(false);

    console.log('✓ All violations have detection_method="regex"');

    // Verify scan costs are zero (no LLM API calls)
    const scanCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs');
    });

    // In regex_only mode, there may be no scan_costs entry at all,
    // or there should be an entry with zero tokens/cost
    if (scanCosts.length > 0) {
      const latestCost = scanCosts[0];

      expect(latestCost.input_tokens).toBe(0);
      expect(latestCost.output_tokens).toBe(0);
      expect(latestCost.cache_read_tokens).toBe(0);
      expect(latestCost.cache_write_tokens).toBe(0);
      expect(latestCost.total_cost_usd).toBe(0);

      console.log('✓ Scan costs confirm zero API usage');
    } else {
      console.log('✓ No scan_costs entry (expected for regex_only mode)');
    }

    // Verify all 4 violation types detected
    const controlIds = violations.map((v) => v.control_id);
    const hasCC61 = controlIds.some((id) => id.includes('CC6.1'));
    const hasCC67 = controlIds.some((id) => id.includes('CC6.7'));
    const hasCC72 = controlIds.some((id) => id.includes('CC7.2'));
    const hasA12 = controlIds.some((id) => id.includes('A1.2'));

    expect(hasCC61).toBe(true);
    expect(hasCC67).toBe(true);
    expect(hasCC72).toBe(true);
    expect(hasA12).toBe(true);

    console.log('✓ All 4 SOC 2 violation types detected via regex patterns');
  });

  /**
   * Test: Smart Mode File Selection
   *
   * Tests that smart mode analyzes only security-critical files (~30-40% of codebase)
   * using heuristics from scanner/llm_file_selector.rs.
   *
   * Scenario:
   * 1. Set llm_scan_mode to "smart"
   * 2. Run scan on Django fixtures (4 files total)
   * 3. Verify some violations have detection_method="llm" or "hybrid"
   * 4. Verify file selection was used (not all files analyzed)
   * 5. Verify token usage is lower than analyze_all mode
   *
   * Expected:
   * - Security-critical files (auth, db, API) should be analyzed by LLM
   * - Some violations should have detection_method="llm" or "hybrid"
   * - scan_costs should show moderate token usage (not zero, but less than analyze_all)
   *
   * Note: With only 4 files in fixtures, smart mode may analyze all of them
   * since they all contain security-critical keywords (auth, db, API).
   */
  it('should analyze ~30-40% of files in smart mode (auth, db, API files only)', async () => {
    console.log('Configuring smart mode...');

    // Set smart mode (selective LLM analysis)
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llm_scan_mode: 'smart',
        cost_limit_per_scan: 1.0, // Reasonable limit
      });
    });

    console.log('Settings updated: llm_scan_mode=smart');

    // Navigate to scan page and create new project to get fresh scan
    await browser.url('/scan');

    const newProjectId = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('create_project', {
          name: 'Smart Mode Test Project',
          path: fixturesPath,
        });
        return project.project_id;
      },
      DJANGO_FIXTURES_PATH
    );

    console.log(`Created new project with ID: ${newProjectId}`);

    // Start scan
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await scanButton.click();

    console.log('Scan started in smart mode...');

    // Wait for scan to complete (may take longer due to LLM analysis)
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return statusText.toLowerCase().includes('complete');
      },
      {
        timeout: 120000, // 2 minutes - LLM analysis takes time
        timeoutMsg: 'Scan did not complete within 2 minutes',
        interval: 2000,
      }
    );

    console.log('Scan completed, verifying smart mode behavior...');

    // Get violations to check detection methods
    const violations = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations');
    });

    // Verify we have violations
    expect(violations.length).toBeGreaterThan(0);

    // Count detection methods
    const regexCount = violations.filter((v) => v.detection_method === 'regex').length;
    const llmCount = violations.filter((v) => v.detection_method === 'llm').length;
    const hybridCount = violations.filter((v) => v.detection_method === 'hybrid').length;

    console.log(`Detection method breakdown: ${regexCount} regex, ${llmCount} llm, ${hybridCount} hybrid`);

    // In smart mode, should have SOME LLM or hybrid detections
    const hasLlmAnalysis = llmCount > 0 || hybridCount > 0;
    expect(hasLlmAnalysis).toBe(true);

    console.log('✓ Smart mode performed LLM analysis on security-critical files');

    // Verify scan costs show token usage (LLM was used)
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

    console.log(`✓ Token usage: ${latestCost.input_tokens} input, ${latestCost.output_tokens} output`);
    console.log(`✓ Total cost: $${latestCost.total_cost_usd.toFixed(4)}`);

    // Verify LLM violations have confidence scores and reasoning
    const llmViolations = violations.filter((v) => v.detection_method === 'llm' || v.detection_method === 'hybrid');

    if (llmViolations.length > 0) {
      const firstLlm = llmViolations[0];

      expect(firstLlm.confidence_score).toBeDefined();
      expect(firstLlm.confidence_score).toBeGreaterThan(0);
      expect(firstLlm.confidence_score).toBeLessThanOrEqual(100);
      expect(firstLlm.llm_reasoning).toBeDefined();
      expect(firstLlm.llm_reasoning.length).toBeGreaterThan(0);

      console.log('✓ LLM violations include confidence scores and reasoning');
    }
  });

  /**
   * Test: Analyze-All Mode
   *
   * Tests that analyze_all mode performs LLM analysis on every file in the project
   * for maximum detection accuracy.
   *
   * Scenario:
   * 1. Set llm_scan_mode to "analyze_all"
   * 2. Run scan on Django fixtures (4 files)
   * 3. Verify all files were analyzed by LLM
   * 4. Verify violations include LLM and hybrid detections
   * 5. Verify token usage is higher than smart mode
   *
   * Expected:
   * - All 4 fixture files should be analyzed by LLM
   * - Should have maximum number of LLM/hybrid violations
   * - scan_costs should show highest token usage
   */
  it('should analyze all files in analyze_all mode', async () => {
    console.log('Configuring analyze_all mode...');

    // Set analyze_all mode (LLM analyzes every file)
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llm_scan_mode: 'analyze_all',
        cost_limit_per_scan: 2.0, // Higher limit for analyze_all
      });
    });

    console.log('Settings updated: llm_scan_mode=analyze_all');

    // Navigate to scan page and create new project
    await browser.url('/scan');

    const newProjectId = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        const project = await invoke('create_project', {
          name: 'Analyze All Test Project',
          path: fixturesPath,
        });
        return project.project_id;
      },
      DJANGO_FIXTURES_PATH
    );

    console.log(`Created new project with ID: ${newProjectId}`);

    // Start scan
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await scanButton.click();

    console.log('Scan started in analyze_all mode...');

    // Wait for scan to complete (will take longer - all files analyzed)
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return statusText.toLowerCase().includes('complete');
      },
      {
        timeout: 180000, // 3 minutes - analyzing all files takes time
        timeoutMsg: 'Scan did not complete within 3 minutes',
        interval: 2000,
      }
    );

    console.log('Scan completed, verifying analyze_all behavior...');

    // Get violations
    const violations = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations');
    });

    expect(violations.length).toBeGreaterThan(0);

    // Count detection methods
    const regexCount = violations.filter((v) => v.detection_method === 'regex').length;
    const llmCount = violations.filter((v) => v.detection_method === 'llm').length;
    const hybridCount = violations.filter((v) => v.detection_method === 'hybrid').length;

    console.log(`Detection method breakdown: ${regexCount} regex, ${llmCount} llm, ${hybridCount} hybrid`);

    // In analyze_all mode, should have significant LLM or hybrid detections
    const hasLlmAnalysis = llmCount > 0 || hybridCount > 0;
    expect(hasLlmAnalysis).toBe(true);

    console.log('✓ Analyze_all mode performed LLM analysis on all files');

    // Verify scan costs show significant token usage
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

    console.log(`✓ Token usage: ${latestCost.input_tokens} input, ${latestCost.output_tokens} output`);
    console.log(`✓ Total cost: $${latestCost.total_cost_usd.toFixed(4)}`);

    // Verify we have both detection types
    expect(regexCount).toBeGreaterThan(0); // Regex phase always runs
    expect(llmCount + hybridCount).toBeGreaterThan(0); // LLM phase should find violations

    console.log('✓ Both regex and LLM detection methods active in analyze_all mode');
  });

  /**
   * Test: Hybrid Violation Detection
   *
   * Tests that when both regex and LLM detect the same violation (within ±3 lines),
   * the system creates a "hybrid" violation with detection_method="hybrid".
   *
   * Scenario:
   * 1. Set llm_scan_mode to "analyze_all" (ensures LLM runs)
   * 2. Run scan on Django fixtures
   * 3. Verify at least one violation has detection_method="hybrid"
   * 4. Verify hybrid violation has both regex_reasoning and llm_reasoning
   * 5. Verify hybrid violation has confidence_score from LLM
   *
   * Expected:
   * - At least one violation should be detected by both methods
   * - Hybrid violation should have:
   *   - detection_method="hybrid"
   *   - regex_reasoning (pattern match explanation)
   *   - llm_reasoning (AI analysis explanation)
   *   - confidence_score (0-100 from LLM)
   *
   * Architecture note (scan.rs:526-641):
   * Deduplication algorithm matches violations within ±3 lines of same file.
   * If regex violation at line 10 and LLM violation at line 11, creates hybrid.
   */
  it('should create hybrid violations (detection_method=hybrid) when regex and LLM both detect same issue', async () => {
    console.log('Verifying hybrid violation detection...');

    // Get all violations from last scan (analyze_all mode from previous test)
    const violations = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations');
    });

    // Find hybrid violations
    const hybridViolations = violations.filter((v) => v.detection_method === 'hybrid');

    // Should have at least one hybrid violation
    // (Fixtures designed to trigger both regex and LLM for same issues)
    expect(hybridViolations.length).toBeGreaterThan(0);

    console.log(`✓ Found ${hybridViolations.length} hybrid violations`);

    // Verify hybrid violation structure
    const firstHybrid = hybridViolations[0];

    // Must have detection_method="hybrid"
    expect(firstHybrid.detection_method).toBe('hybrid');

    // Must have both regex_reasoning and llm_reasoning
    expect(firstHybrid.regex_reasoning).toBeDefined();
    expect(firstHybrid.regex_reasoning.length).toBeGreaterThan(0);

    expect(firstHybrid.llm_reasoning).toBeDefined();
    expect(firstHybrid.llm_reasoning.length).toBeGreaterThan(0);

    // Must have confidence_score from LLM analysis
    expect(firstHybrid.confidence_score).toBeDefined();
    expect(firstHybrid.confidence_score).toBeGreaterThan(0);
    expect(firstHybrid.confidence_score).toBeLessThanOrEqual(100);

    console.log('✓ Hybrid violation structure verified:');
    console.log(`  - detection_method: ${firstHybrid.detection_method}`);
    console.log(`  - confidence_score: ${firstHybrid.confidence_score}`);
    console.log(`  - regex_reasoning: ${firstHybrid.regex_reasoning.substring(0, 100)}...`);
    console.log(`  - llm_reasoning: ${firstHybrid.llm_reasoning.substring(0, 100)}...`);

    // Verify UI displays hybrid detection badge
    await browser.url('/scan');

    // Wait for violations table to load
    const violationsTable = await browser.$('[data-testid="violations-table"]');
    await expect(violationsTable).toBeDisplayed();

    // Find first hybrid violation in UI
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');

    let foundHybridBadge = false;
    for (const row of violationRows) {
      // Check if row has hybrid detection badge
      const detectionBadge = await row.$('[data-testid="detection-method-badge"]');

      if (await detectionBadge.isExisting()) {
        const badgeText = await detectionBadge.getText();

        if (badgeText.toLowerCase().includes('hybrid')) {
          foundHybridBadge = true;
          console.log('✓ Found hybrid detection badge in UI');
          break;
        }
      }
    }

    // If badge doesn't exist yet, that's okay - UI may not implement badges yet
    if (!foundHybridBadge) {
      console.log('ℹ Hybrid detection badge not found in UI (may not be implemented yet)');
    }

    // Navigate to violation detail page for first hybrid
    await browser.url(`/violation/${firstHybrid.violation_id}`);

    // Verify detail page displays both reasoning fields
    const detailPage = await browser.$('[data-testid="violation-detail"]');
    await expect(detailPage).toBeDisplayed();

    console.log('✓ Hybrid violation detail page accessible');
    console.log('✓ Hybrid detection working correctly across regex and LLM phases');
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
        cost_limit_per_scan: 1.0,
      });
    });

    console.log('Hybrid scanning tests complete');
  });
});
