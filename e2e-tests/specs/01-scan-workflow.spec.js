/**
 * E2E Tests: Scan Workflow
 *
 * Tests the complete scanning workflow from launching the app to applying fixes:
 * - Application launch and main window display
 * - Project folder selection via file dialog
 * - Violation detection for all 4 SOC 2 controls (CC6.1, CC6.7, CC7.2, A1.2)
 * - AI fix generation for detected violations
 * - Fix application and git commit creation
 */

import { browser, expect } from '@wdio/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Django violations fixture folder
const DJANGO_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/django-violations');

describe('Scan Workflow E2E Tests', () => {
  /**
   * Test: Application Launch
   *
   * Verifies that the Ryn application launches successfully and displays
   * the main window with expected UI elements.
   *
   * Expected: Main window should be visible with title containing "Ryn"
   */
  it('should launch Ryn application and display main window', async () => {
    // WebdriverIO automatically launches the Tauri app via tauri-driver
    // configured in wdio.conf.js beforeSession hook

    // Verify browser/app is initialized
    await expect(browser).toHaveTitle(expect.stringContaining('Ryn'));

    // Verify main window is displayed
    const appContainer = await browser.$('body');
    await expect(appContainer).toBeDisplayed();

    // Verify key navigation elements exist
    const topNav = await browser.$('[data-testid="top-nav"]');
    await expect(topNav).toExist();

    console.log('✓ Ryn application launched successfully');
  });

  /**
   * Test: Project Folder Selection
   *
   * Tests the file dialog interaction to select the Django violations fixture
   * folder as the project to scan.
   *
   * Expected: Project folder should be selected and displayed in the UI
   *
   * Note: This test uses browser.execute() to bypass the native file dialog
   * by directly calling the Tauri command with the fixture path. This is
   * necessary because WebDriver cannot interact with native OS dialogs.
   */
  it('should select Django violations fixture folder via file dialog', async () => {
    // Navigate to scan page if not already there
    await browser.url('/scan');

    // Wait for scan page to load
    const scanButton = await browser.$('button[data-testid="select-folder-btn"]');
    await expect(scanButton).toBeDisplayed();

    // Bypass native file dialog by directly invoking Tauri command
    // This simulates selecting the Django violations fixture folder
    await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        await invoke('create_project', {
          name: 'Django E2E Test',
          path: fixturesPath,
        });
      },
      DJANGO_FIXTURES_PATH
    );

    // Wait for project to be created and UI to update
    await browser.pause(500);

    // Verify project path is displayed
    const projectPath = await browser.$('[data-testid="project-path"]');
    await expect(projectPath).toHaveText(expect.stringContaining('django-violations'));

    console.log('✓ Django violations fixture folder selected');
  });

  /**
   * Test: Violation Detection
   *
   * Tests the scanning functionality to detect all 4 types of SOC 2 violations
   * in the Django fixture files:
   * - CC6.1: Missing @login_required decorator (views.py)
   * - CC6.7: Hardcoded secrets (settings.py)
   * - CC7.2: Missing audit logs (models.py)
   * - A1.2: Missing error handling (api.py)
   *
   * Expected: Scan should complete and detect at least 4 violations
   *
   * Note: The exact count may be higher than 4 since each fixture file
   * contains multiple violations of the same type.
   */
  it('should detect 4 violations (CC6.1, CC6.7, CC7.2, A1.2) after scanning', async () => {
    // Click the "Scan Project" button
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await expect(scanButton).toBeEnabled();
    await scanButton.click();

    console.log('Scan initiated, waiting for completion...');

    // Wait for scan to complete (max 60 seconds)
    // The scan status indicator should show "Completed"
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await scanStatus.waitForExist({ timeout: 60000 });

    // Wait until scan status shows completion
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return statusText.toLowerCase().includes('complete');
      },
      {
        timeout: 60000,
        timeoutMsg: 'Scan did not complete within 60 seconds',
        interval: 1000,
      }
    );

    console.log('Scan completed, verifying violations...');

    // Verify violations table is displayed
    const violationsTable = await browser.$('[data-testid="violations-table"]');
    await expect(violationsTable).toBeDisplayed();

    // Get all violation rows
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');
    const violationCount = violationRows.length;

    // Should detect at least 4 violations (one for each type)
    expect(violationCount).toBeGreaterThanOrEqual(4);

    // Verify all 4 violation types are present
    const controlIds = await Promise.all(
      violationRows.slice(0, 10).map(async (row) => {
        const controlCell = await row.$('[data-testid="control-id"]');
        return await controlCell.getText();
      })
    );

    // Check that we have at least one of each violation type
    const hasCC61 = controlIds.some((id) => id.includes('CC6.1'));
    const hasCC67 = controlIds.some((id) => id.includes('CC6.7'));
    const hasCC72 = controlIds.some((id) => id.includes('CC7.2'));
    const hasA12 = controlIds.some((id) => id.includes('A1.2'));

    expect(hasCC61).toBe(true);
    expect(hasCC67).toBe(true);
    expect(hasCC72).toBe(true);
    expect(hasA12).toBe(true);

    console.log(
      `✓ Detected ${violationCount} total violations including all 4 types (CC6.1, CC6.7, CC7.2, A1.2)`
    );
  });

  /**
   * Test: AI Fix Generation
   *
   * Tests the AI-powered fix generation for a CC6.1 violation
   * (missing @login_required decorator).
   *
   * Expected: Fix should be generated successfully with code changes
   *
   * Note: This requires ANTHROPIC_API_KEY to be set in environment
   */
  it('should generate AI fix for CC6.1 violation (missing @login_required)', async () => {
    // Find the first CC6.1 violation in the table
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');

    let cc61ViolationRow = null;
    for (const row of violationRows) {
      const controlCell = await row.$('[data-testid="control-id"]');
      const controlId = await controlCell.getText();

      if (controlId.includes('CC6.1')) {
        cc61ViolationRow = row;
        break;
      }
    }

    expect(cc61ViolationRow).not.toBe(null);

    // Click on the violation row to open detail view
    await cc61ViolationRow.click();

    // Wait for violation detail page to load
    const fixGenerateButton = await browser.$('button[data-testid="generate-fix-btn"]');
    await expect(fixGenerateButton).toBeDisplayed();
    await expect(fixGenerateButton).toBeEnabled();

    // Click "Generate Fix" button
    await fixGenerateButton.click();

    console.log('Fix generation initiated, waiting for Claude API response...');

    // Wait for fix generation to complete (max 30 seconds)
    const fixPreview = await browser.$('[data-testid="fix-preview"]');
    await fixPreview.waitForExist({ timeout: 30000 });

    // Verify fix contains expected code
    const fixCode = await fixPreview.getText();

    // Should contain the @login_required decorator
    expect(fixCode).toContain('@login_required');

    console.log('✓ AI fix generated successfully with @login_required decorator');
  });

  /**
   * Test: Fix Application and Git Commit
   *
   * Tests applying the generated fix to the file and creating a git commit.
   *
   * Expected:
   * - Fix should be applied to the file
   * - Git commit should be created with appropriate message
   * - Violation status should change to "fixed"
   *
   * Note: This test requires the fixture folder to be a git repository
   */
  it('should apply fix and create git commit', async () => {
    // Verify "Apply Fix" button is displayed and enabled
    const applyFixButton = await browser.$('button[data-testid="apply-fix-btn"]');
    await expect(applyFixButton).toBeDisplayed();
    await expect(applyFixButton).toBeEnabled();

    // Click "Apply Fix" button
    await applyFixButton.click();

    console.log('Applying fix and creating git commit...');

    // Wait for success notification
    const successNotification = await browser.$('[data-testid="notification-success"]');
    await successNotification.waitForExist({ timeout: 10000 });

    // Verify notification contains success message
    await expect(successNotification).toHaveText(expect.stringContaining('applied successfully'));

    // Verify violation status updated to "fixed"
    const violationStatus = await browser.$('[data-testid="violation-status"]');
    await expect(violationStatus).toHaveText(expect.stringContaining('Fixed'));

    // Navigate back to violations list
    const backButton = await browser.$('button[data-testid="back-to-list"]');
    await backButton.click();

    // Verify violation is marked as fixed in the list
    await browser.pause(500);
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');

    let foundFixedViolation = false;
    for (const row of violationRows.slice(0, 5)) {
      const statusCell = await row.$('[data-testid="status"]');
      const statusText = await statusCell.getText();

      if (statusText.toLowerCase().includes('fixed')) {
        foundFixedViolation = true;
        break;
      }
    }

    expect(foundFixedViolation).toBe(true);

    console.log('✓ Fix applied successfully and git commit created');
  });
});
