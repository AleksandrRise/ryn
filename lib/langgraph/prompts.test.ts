/**
 * SOC 2 Prompts Test Suite
 *
 * Tests for prompt template rendering and validation
 */

import { describe, it, expect } from 'vitest'
import {
  SOC2_PROMPTS,
  getAnalysisPrompt,
  getFixPrompt,
  renderPrompt,
  getAllControlIds,
  isValidControlId,
} from './prompts'

describe('SOC2 Prompts', () => {
  // ============= PROMPT STRUCTURE TESTS =============

  describe('Prompt Templates Structure', () => {
    it('should have all 4 control prompts defined', () => {
      const controlIds = Object.keys(SOC2_PROMPTS)
      expect(controlIds).toEqual(['CC6.1', 'CC6.7', 'CC7.2', 'A1.2'])
    })

    it('should have name and description for each control', () => {
      Object.entries(SOC2_PROMPTS).forEach(([controlId, control]) => {
        expect(control.name).toBeDefined()
        expect(control.name.length).toBeGreaterThan(0)
        expect(control.description).toBeDefined()
        expect(control.description.length).toBeGreaterThan(0)
        expect(control.requirement).toBeDefined()
        expect(control.requirement.length).toBeGreaterThan(0)
      })
    })

    it('should have analysis and fix prompts for each control', () => {
      Object.entries(SOC2_PROMPTS).forEach(([controlId, control]) => {
        expect(control.analysisPrompt).toBeDefined()
        expect(control.analysisPrompt.length).toBeGreaterThan(100)
        expect(control.fixGenerationPrompt).toBeDefined()
        expect(control.fixGenerationPrompt.length).toBeGreaterThan(100)
      })
    })
  })

  // ============= CC6.1 PROMPT TESTS =============

  describe('CC6.1 Access Control Prompts', () => {
    it('should contain authentication patterns', () => {
      const prompt = SOC2_PROMPTS['CC6.1'].analysisPrompt
      expect(prompt).toContain('@login_required')
      expect(prompt).toContain('authentication')
      expect(prompt).toContain('RBAC')
    })

    it('should contain framework-specific guidance', () => {
      const prompt = SOC2_PROMPTS['CC6.1'].analysisPrompt
      expect(prompt).toContain('{framework}')
      expect(prompt).toContain('@login_required')
    })

    it('should have fix prompt with decorator guidance', () => {
      const prompt = SOC2_PROMPTS['CC6.1'].fixGenerationPrompt
      expect(prompt).toContain('@login_required')
      expect(prompt).toContain('@permission_required')
      expect(prompt).toContain('middleware')
    })

    it('should contain violation patterns', () => {
      const prompt = SOC2_PROMPTS['CC6.1'].analysisPrompt
      expect(prompt).toContain('without @login_required')
      expect(prompt).toContain('without auth')
    })
  })

  // ============= CC6.7 PROMPT TESTS =============

  describe('CC6.7 Cryptography & Secrets Prompts', () => {
    it('should contain secret detection patterns', () => {
      const prompt = SOC2_PROMPTS['CC6.7'].analysisPrompt
      expect(prompt).toContain('hardcoded')
      expect(prompt).toContain('secrets')
      expect(prompt).toContain('API key')
      expect(prompt).toContain('password')
    })

    it('should mention HTTPS requirement', () => {
      const prompt = SOC2_PROMPTS['CC6.7'].analysisPrompt
      expect(prompt).toContain('https')
      expect(prompt).toContain('TLS')
    })

    it('should have fix prompt with environment variable guidance', () => {
      const prompt = SOC2_PROMPTS['CC6.7'].fixGenerationPrompt
      expect(prompt).toContain('os.getenv')
      expect(prompt).toContain('process.env')
      expect(prompt).toContain('environment variable')
    })

    it('should mention secret types', () => {
      const prompt = SOC2_PROMPTS['CC6.7'].analysisPrompt
      expect(prompt).toContain('API key')
      expect(prompt).toContain('token')
      expect(prompt).toContain('password')
    })
  })

  // ============= CC7.2 PROMPT TESTS =============

  describe('CC7.2 Logging & Monitoring Prompts', () => {
    it('should mention audit logging requirement', () => {
      const prompt = SOC2_PROMPTS['CC7.2'].analysisPrompt
      expect(prompt).toContain('audit log')
      expect(prompt).toContain('logging')
    })

    it('should mention sensitive operation logging', () => {
      const prompt = SOC2_PROMPTS['CC7.2'].analysisPrompt
      expect(prompt).toContain('sensitive')
      expect(prompt).toContain('user')
      expect(prompt).toContain('audit')
    })

    it('should warn against logging secrets', () => {
      const prompt = SOC2_PROMPTS['CC7.2'].analysisPrompt
      expect(prompt).toContain('password')
      expect(prompt).toContain('token')
      expect(prompt).toContain('secret')
    })

    it('should have fix prompt with logging guidance', () => {
      const prompt = SOC2_PROMPTS['CC7.2'].fixGenerationPrompt
      expect(prompt).toContain('logger')
      expect(prompt).toContain('structured')
      expect(prompt).toContain('JSON')
    })

    it('should mention violation types', () => {
      const prompt = SOC2_PROMPTS['CC7.2'].analysisPrompt
      expect(prompt).toContain('missing_audit_log')
      expect(prompt).toContain('logging_secrets')
      expect(prompt).toContain('logging_pii')
    })
  })

  // ============= A1.2 PROMPT TESTS =============

  describe('A1.2 Resilience & Error Handling Prompts', () => {
    it('should mention error handling requirement', () => {
      const prompt = SOC2_PROMPTS['A1.2'].analysisPrompt
      expect(prompt).toContain('error handling')
      expect(prompt).toContain('retry')
      expect(prompt).toContain('circuit breaker')
    })

    it('should mention external service calls', () => {
      const prompt = SOC2_PROMPTS['A1.2'].analysisPrompt
      expect(prompt).toContain('external')
      expect(prompt).toContain('API')
      expect(prompt).toContain('database')
    })

    it('should mention timeout requirement', () => {
      const prompt = SOC2_PROMPTS['A1.2'].analysisPrompt
      expect(prompt).toContain('timeout')
    })

    it('should have fix prompt with resilience guidance', () => {
      const prompt = SOC2_PROMPTS['A1.2'].fixGenerationPrompt
      expect(prompt).toContain('try-catch')
      expect(prompt).toContain('retry')
      expect(prompt).toContain('exponential backoff')
      expect(prompt).toContain('circuit breaker')
    })

    it('should mention failure types', () => {
      const prompt = SOC2_PROMPTS['A1.2'].analysisPrompt
      expect(prompt).toContain('no_error_handling')
      expect(prompt).toContain('no_retry')
      expect(prompt).toContain('no_timeout')
    })
  })

  // ============= PROMPT RENDERING TESTS =============

  describe('Prompt Rendering', () => {
    it('should render simple variable substitution', () => {
      const template = 'Code: {code}'
      const rendered = renderPrompt(template, { code: 'def test(): pass' })
      expect(rendered).toBe('Code: def test(): pass')
    })

    it('should render multiple variables', () => {
      const template = 'Code: {code}, Framework: {framework}'
      const rendered = renderPrompt(template, {
        code: 'def test(): pass',
        framework: 'django',
      })
      expect(rendered).toContain('def test(): pass')
      expect(rendered).toContain('django')
    })

    it('should handle object serialization', () => {
      const template = 'Data: {data}'
      const rendered = renderPrompt(template, {
        data: { key: 'value', number: 42 },
      })
      expect(rendered).toContain('key')
      expect(rendered).toContain('value')
      expect(rendered).toContain('42')
    })

    it('should handle array serialization', () => {
      const template = 'Items: {items}'
      const rendered = renderPrompt(template, {
        items: [{ id: 1 }, { id: 2 }],
      })
      expect(rendered).toContain('id')
      expect(rendered).toContain('1')
      expect(rendered).toContain('2')
    })

    it('should preserve text outside placeholders', () => {
      const template = 'This is a test with {code} in the middle'
      const rendered = renderPrompt(template, { code: 'xyz' })
      expect(rendered).toContain('This is a test with')
      expect(rendered).toContain('in the middle')
      expect(rendered).toContain('xyz')
    })

    it('should handle empty values', () => {
      const template = 'Code: {code}'
      const rendered = renderPrompt(template, { code: '' })
      expect(rendered).toBe('Code: ')
    })

    it('should handle missing variables by leaving placeholder', () => {
      const template = 'Code: {code}'
      const rendered = renderPrompt(template, {})
      expect(rendered).toContain('{code}')
    })
  })

  // ============= HELPER FUNCTION TESTS =============

  describe('Helper Functions', () => {
    it('should get analysis prompt by control ID', () => {
      const prompt = getAnalysisPrompt('CC6.1')
      expect(prompt).toBe(SOC2_PROMPTS['CC6.1'].analysisPrompt)
    })

    it('should get fix prompt by control ID', () => {
      const prompt = getFixPrompt('CC6.1')
      expect(prompt).toBe(SOC2_PROMPTS['CC6.1'].fixGenerationPrompt)
    })

    it('should throw on invalid analysis prompt control', () => {
      expect(() => getAnalysisPrompt('INVALID')).toThrow()
    })

    it('should throw on invalid fix prompt control', () => {
      expect(() => getFixPrompt('INVALID')).toThrow()
    })

    it('should return all control IDs', () => {
      const ids = getAllControlIds()
      expect(ids).toEqual(['CC6.1', 'CC6.7', 'CC7.2', 'A1.2'])
    })

    it('should validate control IDs', () => {
      expect(isValidControlId('CC6.1')).toBe(true)
      expect(isValidControlId('CC6.7')).toBe(true)
      expect(isValidControlId('CC7.2')).toBe(true)
      expect(isValidControlId('A1.2')).toBe(true)
      expect(isValidControlId('INVALID')).toBe(false)
      expect(isValidControlId('CC8.1')).toBe(false)
    })
  })

  // ============= PROMPT VARIABLE TESTS =============

  describe('Prompt Variables', () => {
    it('should have {code} placeholder in analysis prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.analysisPrompt).toContain('{code}')
      })
    })

    it('should have {framework} placeholder in analysis prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.analysisPrompt).toContain('{framework}')
      })
    })

    it('should have {violations} placeholder in analysis prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.analysisPrompt).toContain('{violations}')
      })
    })

    it('should have {originalCode} placeholder in fix prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.fixGenerationPrompt).toContain('{originalCode}')
      })
    })

    it('should have {framework} placeholder in fix prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.fixGenerationPrompt).toContain('{framework}')
      })
    })
  })

  // ============= CONTENT VALIDATION TESTS =============

  describe('Content Validation', () => {
    it('should have examples in analysis prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.analysisPrompt.length).toBeGreaterThan(200)
      })
    })

    it('should have examples in fix prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.fixGenerationPrompt.length).toBeGreaterThan(200)
      })
    })

    it('should mention control requirement in both prompts', () => {
      Object.entries(SOC2_PROMPTS).forEach(([controlId, control]) => {
        expect(control.analysisPrompt).toContain(controlId)
        expect(control.fixGenerationPrompt).toContain(controlId)
      })
    })

    it('should not have hardcoded passwords in prompts', () => {
      Object.values(SOC2_PROMPTS).forEach((control) => {
        expect(control.analysisPrompt).not.toMatch(/password\s*=\s*['"][^'"]{10,}['"]/)
        expect(control.fixGenerationPrompt).not.toMatch(/password\s*=\s*['"][^'"]{10,}['"]/)
      })
    })

    it('CC6.1 should mention roles and permissions', () => {
      const prompt = SOC2_PROMPTS['CC6.1'].analysisPrompt
      expect(prompt.toLowerCase()).toContain('role')
      expect(prompt).toContain('RBAC')
    })

    it('CC6.7 should mention encryption', () => {
      const prompt = SOC2_PROMPTS['CC6.7'].analysisPrompt
      expect(prompt.toLowerCase()).toContain('encrypt')
    })

    it('CC7.2 should mention PII', () => {
      const prompt = SOC2_PROMPTS['CC7.2'].analysisPrompt
      expect(prompt).toContain('PII')
      expect(prompt).toContain('redact')
    })

    it('A1.2 should mention recovery', () => {
      const description = SOC2_PROMPTS['A1.2'].description
      expect(description.toLowerCase()).toContain('recover')
    })
  })
})
