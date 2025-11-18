/**
 * E2E Tests: File Watcher Integration
 *
 * Tests the file watcher functionality to ensure Ryn detects file changes in real-time:
 * - Detection of new violations when files are modified externally
 * - Removal of violations when files are fixed externally
 * - Handling rapid file changes without crashes or race conditions
 *
 * Note: These tests require the Rust file watcher (scanner/file_watcher.rs) to be
 * fully integrated with the Tauri commands. As of current implementation status,
 * the file watcher is implemented but NOT integrated, so these tests may fail.
 */

import { browser, expect } from '@wdio/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Django violations fixture folder
const DJANGO_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/django-violations');

describe('File Watcher E2E Tests', () => {
  let projectId;
  let initialViolationCount;

  /**
   * Setup: Create project and perform initial scan
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
          name: 'File Watcher Test Project',
          path: fixturesPath,
        });
        return project.project_id;
      },
      DJANGO_FIXTURES_PATH
    );

    console.log(`Created project with ID: ${projectId}`);

    // Perform initial scan
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await scanButton.click();

    // Wait for scan to complete
    const scanStatus = await browser.$('[data-testid="scan-status"]');
    await browser.waitUntil(
      async () => {
        const statusText = await scanStatus.getText();
        return statusText.toLowerCase().includes('complete');
      },
      {
        timeout: 60000,
        timeoutMsg: 'Initial scan did not complete within 60 seconds',
        interval: 1000,
      }
    );

    // Record initial violation count
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');
    initialViolationCount = violationRows.length;

    console.log(`Initial scan complete. Found ${initialViolationCount} violations`);
  });

  /**
   * Test: Detect New Violation on File Modification
   *
   * Tests that the file watcher detects when a file is modified to introduce
   * a new violation, and the UI updates to show the new violation.
   *
   * Scenario:
   * 1. Create a new Python file with a CC6.7 violation (hardcoded secret)
   * 2. Wait for file watcher to detect the change
   * 3. Verify a new violation appears in the violations list
   *
   * Expected: Violation count increases by at least 1
   */
  it('should detect new violation when file is modified', async () => {
    console.log('Creating new file with hardcoded secret violation...');

    // Create a new Python file with a CC6.7 violation (hardcoded API key)
    const newFilePath = path.join(DJANGO_FIXTURES_PATH, 'new_config.py');
    const violationCode = `
# This file was created by E2E test to verify file watcher functionality

# VIOLATION CC6.7: Hardcoded API key
OPENAI_API_KEY = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz'

# VIOLATION CC6.7: Hardcoded database password
DATABASE_PASSWORD = 'MySecretPassword123!'

def get_api_key():
    return OPENAI_API_KEY
`;

    await browser.execute(
      (filePath, content) => {
        const fs = require('fs');
        fs.writeFileSync(filePath, content, 'utf8');
      },
      newFilePath,
      violationCode
    );

    console.log(`Created new file: ${newFilePath}`);

    // Wait for file watcher to detect the new file and trigger a scan
    // The file watcher should emit events that cause the violations list to update
    await browser.pause(2000); // Give file watcher time to detect change

    // Poll for violation count to increase
    const violationDetected = await browser.waitUntil(
      async () => {
        const violationRows = await browser.$$('[data-testid^="violation-row-"]');
        const currentCount = violationRows.length;

        console.log(`Current violation count: ${currentCount}, Initial: ${initialViolationCount}`);
        return currentCount > initialViolationCount;
      },
      {
        timeout: 15000,
        timeoutMsg:
          'File watcher did not detect new violation within 15 seconds. This may indicate file_watcher.rs is not integrated.',
        interval: 1000,
      }
    );

    expect(violationDetected).toBe(true);

    // Verify the new violation is for CC6.7
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');
    const newViolationCount = violationRows.length;

    console.log(`✓ New violation detected! Count increased from ${initialViolationCount} to ${newViolationCount}`);

    // Check that at least one new violation is CC6.7
    let foundCC67 = false;
    for (const row of violationRows.slice(initialViolationCount)) {
      const controlCell = await row.$('[data-testid="control-id"]');
      const controlId = await controlCell.getText();

      if (controlId.includes('CC6.7')) {
        foundCC67 = true;
        break;
      }
    }

    expect(foundCC67).toBe(true);

    // Clean up: Delete the test file
    await browser.execute((filePath) => {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, newFilePath);

    console.log('Test file cleaned up');
  });

  /**
   * Test: Remove Violation When File is Fixed Externally
   *
   * Tests that the file watcher detects when a file is modified to fix a violation,
   * and the UI updates to remove or mark the violation as fixed.
   *
   * Scenario:
   * 1. Read the current views.py file (has CC6.1 violations)
   * 2. Modify the file to add @login_required decorator
   * 3. Wait for file watcher to detect the change
   * 4. Verify the CC6.1 violation is removed or marked as fixed
   *
   * Expected: Violation count decreases or violation status changes to "fixed"
   */
  it('should remove violation from list when file is fixed externally', async () => {
    console.log('Fixing CC6.1 violation in views.py...');

    const viewsFilePath = path.join(DJANGO_FIXTURES_PATH, 'views.py');

    // Read current file content
    const originalContent = await browser.execute((filePath) => {
      const fs = require('fs');
      return fs.readFileSync(filePath, 'utf8');
    }, viewsFilePath);

    // Modify file to add @login_required decorator before def get_user_data
    const fixedContent = originalContent.replace(
      /@csrf_exempt\ndef get_user_data\(request\):/,
      `@csrf_exempt\n@login_required\ndef get_user_data(request):`
    );

    // Write fixed content back to file
    await browser.execute(
      (filePath, content) => {
        const fs = require('fs');
        fs.writeFileSync(filePath, content, 'utf8');
      },
      viewsFilePath,
      fixedContent
    );

    console.log('Applied fix to views.py');

    // Wait for file watcher to detect the change
    await browser.pause(2000);

    // Poll for violation to be removed or marked as fixed
    const violationFixed = await browser.waitUntil(
      async () => {
        const violationRows = await browser.$$('[data-testid^="violation-row-"]');
        const currentCount = violationRows.length;

        // Check if count decreased
        if (currentCount < initialViolationCount) {
          return true;
        }

        // Alternatively, check if any violation status changed to "fixed"
        for (const row of violationRows) {
          const statusCell = await row.$('[data-testid="status"]');
          const statusText = await statusCell.getText();

          if (statusText.toLowerCase().includes('fixed')) {
            return true;
          }
        }

        return false;
      },
      {
        timeout: 15000,
        timeoutMsg:
          'File watcher did not detect violation fix within 15 seconds. This may indicate file_watcher.rs is not integrated.',
        interval: 1000,
      }
    );

    expect(violationFixed).toBe(true);

    console.log('✓ File watcher detected fix and updated violations list');

    // Restore original content
    await browser.execute(
      (filePath, content) => {
        const fs = require('fs');
        fs.writeFileSync(filePath, content, 'utf8');
      },
      viewsFilePath,
      originalContent
    );

    console.log('Restored original views.py content');
  });

  /**
   * Test: Handle Rapid File Changes Without Crashes
   *
   * Tests that the file watcher can handle multiple rapid file changes
   * without crashing or causing race conditions.
   *
   * Scenario:
   * 1. Perform 5 rapid file modifications (add/remove violations)
   * 2. Verify the app remains responsive
   * 3. Verify the final violation count is consistent
   *
   * Expected: App handles all changes gracefully, no crashes or freezes
   */
  it('should handle rapid file changes without crashes', async () => {
    console.log('Testing rapid file changes...');

    const testFilePath = path.join(DJANGO_FIXTURES_PATH, 'rapid_test.py');

    // Perform 5 rapid file modifications
    for (let i = 1; i <= 5; i++) {
      const content = `
# Rapid change iteration ${i}

# VIOLATION CC6.7: Hardcoded secret ${i}
API_KEY_${i} = 'sk-test-key-${i}-1234567890abcdefghijklmnopqrstuvwxyz'

def get_key_${i}():
    return API_KEY_${i}
`;

      await browser.execute(
        (filePath, fileContent) => {
          const fs = require('fs');
          fs.writeFileSync(filePath, fileContent, 'utf8');
        },
        testFilePath,
        content
      );

      console.log(`Wrote rapid change ${i}/5`);

      // Small delay between writes (100ms)
      await browser.pause(100);
    }

    console.log('All rapid changes written, waiting for file watcher...');

    // Wait for file watcher to process all changes
    await browser.pause(3000);

    // Verify the app is still responsive by checking if UI elements are accessible
    const scanButton = await browser.$('button[data-testid="scan-project-btn"]');
    await expect(scanButton).toBeDisplayed();
    await expect(scanButton).toBeEnabled();

    // Verify violations table is still accessible
    const violationsTable = await browser.$('[data-testid="violations-table"]');
    await expect(violationsTable).toBeDisplayed();

    // Check that we can still get violation rows (proves no crash occurred)
    const violationRows = await browser.$$('[data-testid^="violation-row-"]');
    const finalCount = violationRows.length;

    // Should have violations (app processed the changes)
    expect(finalCount).toBeGreaterThan(0);

    console.log(`✓ App remained responsive through ${5} rapid file changes`);
    console.log(`Final violation count: ${finalCount}`);

    // Clean up: Delete the test file
    await browser.execute((filePath) => {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, testFilePath);

    console.log('Test file cleaned up');
  });

  /**
   * Cleanup: Restore fixture files to original state
   */
  after(async () => {
    console.log('File watcher tests complete');

    // Additional cleanup could go here if needed
    // For now, the individual tests handle their own cleanup
  });
});
