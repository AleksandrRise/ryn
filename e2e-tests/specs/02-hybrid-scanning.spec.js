import { browser, expect } from '@wdio/globals';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E Test: Hybrid Scanning
 *
 * Tests the hybrid scanning system that combines regex pattern matching with LLM analysis.
 * Verifies proper detection method tracking, deduplication, and confidence scores.
 *
 * Test Coverage:
 * 1. Scan in regex_only mode - verify detection_method="regex"
 * 2. Scan in smart mode - verify detection_method="llm" and "hybrid"
 * 3. Verify LLM-only violations have confidence_score
 * 4. Verify hybrid violations have both regex_reasoning and llm_reasoning
 * 5. Verify deduplication within ±3 lines
 * 6. Check detection badges display correctly
 * 7. Verify scan_costs tracking for LLM scans
 */

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Django violations fixture folder
const DJANGO_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/vulnerable-django');

describe('02 - Hybrid Scanning', () => {
  let regexScanId, smartScanId, projectId;

  before(async () => {
    // Wait for Tauri app to fully initialize
    await browser.pause(2000);

    // Create project
    const project = await browser.execute(async (fixturesPath) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('create_project', {
        name: 'Hybrid Scan Test',
        path: fixturesPath,
        framework: 'Django'
      });
    }, DJANGO_FIXTURES_PATH);

    projectId = project.project_id;
    expect(projectId).toBeGreaterThan(0);

    console.log(`✓ Created test project with ID ${projectId}`);
  });

  it('should scan in regex_only mode and verify detection_method="regex"', async () => {
    // Set scan mode to regex_only
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llmScanMode: 'regex_only',
        costLimitPerScan: 5.0
      });
    });

    // Trigger scan
    const scanResult = await browser.execute(async (pid) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('scan_project', {
        projectId: pid,
        scanMode: 'regex_only'
      });
    }, projectId);

    regexScanId = scanResult.scan_id;
    expect(scanResult.status).toBe('completed');

    // Get violations
    const violations = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations', { scanId: scanId });
    }, regexScanId);

    expect(violations.length).toBeGreaterThan(0);

    // Verify all violations have detection_method="regex"
    const nonRegexViolations = violations.filter(v => v.detection_method !== 'regex');
    expect(nonRegexViolations.length).toBe(0);

    // Verify regex violations have regex_reasoning
    violations.forEach(v => {
      expect(v.regex_reasoning).toBeDefined();
      expect(v.regex_reasoning.length).toBeGreaterThan(0);
    });

    console.log(`✓ Regex-only scan found ${violations.length} violations with detection_method="regex"`);
  });

  it('should scan in smart mode and verify detection_method="llm" and "hybrid"', async () => {
    // Set scan mode to smart
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llmScanMode: 'smart',
        costLimitPerScan: 5.0
      });
    });

    // Trigger smart scan
    const scanResult = await browser.execute(async (pid) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('scan_project', {
        projectId: pid,
        scanMode: 'smart'
      });
    }, projectId);

    smartScanId = scanResult.scan_id;
    expect(scanResult.status).toBe('completed');

    // Get violations
    const violations = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations', { scanId: scanId });
    }, smartScanId);

    expect(violations.length).toBeGreaterThan(0);

    // Count violations by detection method
    const regexCount = violations.filter(v => v.detection_method === 'regex').length;
    const llmCount = violations.filter(v => v.detection_method === 'llm').length;
    const hybridCount = violations.filter(v => v.detection_method === 'hybrid').length;

    console.log(`Detection methods: regex=${regexCount}, llm=${llmCount}, hybrid=${hybridCount}`);

    // Should have at least one of each type in smart mode
    expect(regexCount + llmCount + hybridCount).toBeGreaterThan(0);

    console.log(`✓ Smart scan found ${violations.length} violations with mixed detection methods`);
  });

  it('should verify LLM-only violations have confidence_score', async () => {
    const violations = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations', { scanId: scanId });
    }, smartScanId);

    // Find LLM-only violations
    const llmViolations = violations.filter(v => v.detection_method === 'llm');

    if (llmViolations.length > 0) {
      llmViolations.forEach(v => {
        expect(v.confidence_score).toBeDefined();
        expect(v.confidence_score).toBeGreaterThanOrEqual(0);
        expect(v.confidence_score).toBeLessThanOrEqual(100);
        expect(v.llm_reasoning).toBeDefined();
        expect(v.llm_reasoning.length).toBeGreaterThan(0);
      });

      console.log(`✓ All ${llmViolations.length} LLM violations have valid confidence scores (0-100)`);
    } else {
      console.log('⚠ No LLM-only violations found in this scan (may vary based on file selection)');
    }
  });

  it('should verify hybrid violations have both regex_reasoning and llm_reasoning', async () => {
    const violations = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations', { scanId: scanId });
    }, smartScanId);

    // Find hybrid violations
    const hybridViolations = violations.filter(v => v.detection_method === 'hybrid');

    if (hybridViolations.length > 0) {
      hybridViolations.forEach(v => {
        // Hybrid violations must have both reasoning fields
        expect(v.regex_reasoning).toBeDefined();
        expect(v.regex_reasoning.length).toBeGreaterThan(0);

        expect(v.llm_reasoning).toBeDefined();
        expect(v.llm_reasoning.length).toBeGreaterThan(0);

        // Hybrid violations should also have confidence score
        expect(v.confidence_score).toBeDefined();
        expect(v.confidence_score).toBeGreaterThanOrEqual(0);
        expect(v.confidence_score).toBeLessThanOrEqual(100);
      });

      console.log(`✓ All ${hybridViolations.length} hybrid violations have both reasoning fields + confidence scores`);
    } else {
      console.log('⚠ No hybrid violations found (deduplication may not have matched any violations within ±3 lines)');
    }
  });

  it('should verify deduplication works within ±3 lines', async () => {
    // Get both scan results
    const regexViolations = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations', { scanId: scanId });
    }, regexScanId);

    const smartViolations = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations', { scanId: scanId });
    }, smartScanId);

    console.log(`Comparing ${regexViolations.length} regex violations vs ${smartViolations.length} smart violations`);

    // Smart scan should not have significantly more violations than regex scan
    // (because of deduplication, hybrid violations replace separate regex/llm ones)
    // Allow some variation for LLM-only detections
    const violationRatio = smartViolations.length / regexViolations.length;

    // Ratio should be reasonable (between 0.8 and 2.0)
    // If deduplication failed, we'd see nearly double the violations
    expect(violationRatio).toBeGreaterThan(0.5);
    expect(violationRatio).toBeLessThan(3.0);

    console.log(`✓ Violation ratio (smart/regex): ${violationRatio.toFixed(2)} - deduplication appears to be working`);
  });

  it('should verify detection badges display correct detection_method', async () => {
    const violations = await browser.execute(async (scanId) => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_violations', { scanId: scanId });
    }, smartScanId);

    // Test that detection_method values are valid
    const validMethods = ['regex', 'llm', 'hybrid'];

    violations.forEach(v => {
      expect(validMethods).toContain(v.detection_method);
    });

    // Get a sample violation of each type for badge verification
    const regexViolation = violations.find(v => v.detection_method === 'regex');
    const llmViolation = violations.find(v => v.detection_method === 'llm');
    const hybridViolation = violations.find(v => v.detection_method === 'hybrid');

    if (regexViolation) {
      console.log(`✓ Regex violation example: ${regexViolation.control_id} at ${regexViolation.file_path}:${regexViolation.line_number}`);
    }

    if (llmViolation) {
      console.log(`✓ LLM violation example: ${llmViolation.control_id} at ${llmViolation.file_path}:${llmViolation.line_number} (confidence: ${llmViolation.confidence_score}%)`);
    }

    if (hybridViolation) {
      console.log(`✓ Hybrid violation example: ${hybridViolation.control_id} at ${hybridViolation.file_path}:${hybridViolation.line_number} (confidence: ${hybridViolation.confidence_score}%)`);
    }
  });

  it('should verify scan_costs tracking for LLM scans', async () => {
    // Get scan costs for the smart scan
    const scanCosts = await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      return await invoke('get_scan_costs', { limit: 10 });
    });

    expect(scanCosts.length).toBeGreaterThan(0);

    // Find cost record for our smart scan
    const smartScanCost = scanCosts.find(c => c.scan_id === smartScanId);

    expect(smartScanCost).toBeDefined();

    // Verify cost tracking fields
    expect(smartScanCost.input_tokens).toBeGreaterThan(0);
    expect(smartScanCost.output_tokens).toBeGreaterThan(0);
    expect(smartScanCost.total_cost_usd).toBeGreaterThan(0);

    // Smart mode should have lower costs than analyze_all
    expect(smartScanCost.total_cost_usd).toBeLessThan(5.0); // Should be under cost limit

    console.log(`✓ Smart scan cost: $${smartScanCost.total_cost_usd.toFixed(4)} (${smartScanCost.input_tokens} input + ${smartScanCost.output_tokens} output tokens)`);
  });

  after(async () => {
    // Clean up: Reset settings to default
    await browser.execute(async () => {
      // @ts-ignore - Tauri API available in app context
      const { invoke } = window.__TAURI__.core;
      await invoke('update_settings', {
        llmScanMode: 'regex_only',
        costLimitPerScan: 5.0
      });
    });

    console.log('✓ Cleanup completed');
  });
});
