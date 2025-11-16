/**
 * E2E Tests: Multi-Framework Detection
 *
 * Tests the FrameworkDetector module to ensure accurate identification of web frameworks:
 * - Django: Detected from manage.py, settings.py, or requirements.txt with "django"
 * - Flask: Detected from app.py, routes.py, or requirements.txt with "Flask"/"flask"
 * - Express: Detected from package.json with "express" in dependencies
 * - Next.js: Detected from package.json with BOTH "next" and "react" in dependencies
 *
 * Architecture reference (from src-tauri/src/scanner/framework_detector.rs):
 * - Detection priority: Django → Flask → Next.js → Express → React
 * - Framework info is used to enhance LLM analysis prompts with framework-specific context
 * - Enables framework-aware rule detection (e.g., @login_required for Django, verifyToken for Express)
 */

import { browser, expect } from '@wdio/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to test fixture directories
const DJANGO_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/django-violations');
const FLASK_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/flask-violations');
const EXPRESS_FIXTURES_PATH = path.resolve(__dirname, '../fixtures/express-violations');

// Path to Ryn project root (which is itself a Next.js app)
const NEXTJS_PROJECT_PATH = path.resolve(__dirname, '../..');

describe('Multi-Framework Detection E2E Tests', () => {
  /**
   * Test: Detect Django Framework from settings.py
   *
   * Tests that the FrameworkDetector correctly identifies a Django project
   * when settings.py is present in the project root.
   *
   * Detection Logic (framework_detector.rs:93-112):
   * 1. Check for manage.py (exists)
   * 2. Check for settings.py (exists) ← Triggers detection
   * 3. Check requirements.txt for "django" (case-insensitive)
   *
   * Scenario:
   * 1. Call detect_framework Tauri command with django-violations fixture path
   * 2. Verify returned framework is "django"
   *
   * Expected:
   * - detect_framework returns "django" based on presence of settings.py
   */
  it('should detect Django framework from settings.py', async () => {
    console.log(`Testing Django detection with fixture: ${DJANGO_FIXTURES_PATH}`);

    // Call Tauri command to detect framework
    const framework = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        return await invoke('detect_framework', {
          projectPath: fixturesPath,
        });
      },
      DJANGO_FIXTURES_PATH
    );

    console.log(`Detected framework: ${framework}`);

    // Verify Django was detected
    expect(framework).toBe('django');

    console.log('✓ Django framework detected from settings.py');
  });

  /**
   * Test: Detect Flask Framework from app.py
   *
   * Tests that the FrameworkDetector correctly identifies a Flask project
   * when app.py is present in the project root.
   *
   * Detection Logic (framework_detector.rs:114-128):
   * 1. Check for app.py or routes.py (exists) ← Triggers detection
   * 2. Check requirements.txt for "Flask" or "flask"
   *
   * Scenario:
   * 1. Call detect_framework Tauri command with flask-violations fixture path
   * 2. Verify returned framework is "flask"
   *
   * Expected:
   * - detect_framework returns "flask" based on presence of app.py
   */
  it('should detect Flask framework from app.py', async () => {
    console.log(`Testing Flask detection with fixture: ${FLASK_FIXTURES_PATH}`);

    // Call Tauri command to detect framework
    const framework = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        return await invoke('detect_framework', {
          projectPath: fixturesPath,
        });
      },
      FLASK_FIXTURES_PATH
    );

    console.log(`Detected framework: ${framework}`);

    // Verify Flask was detected
    expect(framework).toBe('flask');

    console.log('✓ Flask framework detected from app.py');
  });

  /**
   * Test: Detect Express Framework from package.json
   *
   * Tests that the FrameworkDetector correctly identifies an Express.js project
   * when package.json contains "express" in dependencies.
   *
   * Detection Logic (framework_detector.rs:50-68):
   * 1. Read package.json
   * 2. Check for "next" + "react" (not present)
   * 3. Check for "express" in dependencies (exists) ← Triggers detection
   * 4. Check for "react" only (not applicable)
   *
   * Scenario:
   * 1. Call detect_framework Tauri command with express-violations fixture path
   * 2. Verify returned framework is "express"
   *
   * Expected:
   * - detect_framework returns "express" based on package.json with express dependency
   */
  it('should detect Express framework from package.json with express dependency', async () => {
    console.log(`Testing Express detection with fixture: ${EXPRESS_FIXTURES_PATH}`);

    // Call Tauri command to detect framework
    const framework = await browser.execute(
      async (fixturesPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        return await invoke('detect_framework', {
          projectPath: fixturesPath,
        });
      },
      EXPRESS_FIXTURES_PATH
    );

    console.log(`Detected framework: ${framework}`);

    // Verify Express was detected
    expect(framework).toBe('express');

    console.log('✓ Express framework detected from package.json');
  });

  /**
   * Test: Detect Next.js Framework from package.json
   *
   * Tests that the FrameworkDetector correctly identifies a Next.js project
   * when package.json contains BOTH "next" and "react" in dependencies.
   *
   * Detection Logic (framework_detector.rs:50-68):
   * 1. Read package.json
   * 2. Check for BOTH "next" AND "react" in dependencies (exists) ← Triggers detection
   * 3. Returns "nextjs" before checking for express or react alone
   *
   * Scenario:
   * 1. Call detect_framework Tauri command with Ryn project root path
   * 2. Verify returned framework is "nextjs"
   *
   * Note:
   * - We use the actual Ryn project root, which is itself a Next.js application
   * - Ryn's package.json contains both "next": "16.0.1" and "react": "19.0.0"
   *
   * Expected:
   * - detect_framework returns "nextjs" based on package.json with next + react
   */
  it('should detect Next.js framework from package.json with next and react', async () => {
    console.log(`Testing Next.js detection with Ryn project: ${NEXTJS_PROJECT_PATH}`);

    // Call Tauri command to detect framework
    const framework = await browser.execute(
      async (projectPath) => {
        // @ts-ignore - Tauri API available in app context
        const { invoke } = window.__TAURI__.core;
        return await invoke('detect_framework', {
          projectPath: projectPath,
        });
      },
      NEXTJS_PROJECT_PATH
    );

    console.log(`Detected framework: ${framework}`);

    // Verify Next.js was detected
    expect(framework).toBe('nextjs');

    console.log('✓ Next.js framework detected from package.json with next + react');
  });

  /**
   * Additional Test: Verify Framework Detection is Case-Insensitive for Django
   *
   * Tests that Django detection from requirements.txt is case-insensitive.
   *
   * Note: This is an implicit test - our django-violations fixture doesn't have
   * requirements.txt, but the framework_detector.rs code shows case-insensitive
   * matching for "django" on line 106: `content.to_lowercase().contains("django")`
   *
   * This test is documented for future enhancement if we add requirements.txt fixtures.
   */

  /**
   * Additional Test: Verify Framework Detection Priority
   *
   * Tests that framework detection follows the correct priority order.
   *
   * Priority (framework_detector.rs:33-70):
   * 1. Django (highest priority)
   * 2. Flask
   * 3. Next.js
   * 4. Express
   * 5. React (lowest priority)
   *
   * If a project has both Django and Express files, Django should be detected.
   *
   * This test is documented for future enhancement if we create multi-framework fixtures.
   */
});
