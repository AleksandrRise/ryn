/**
 * LangGraph Agent Test Suite
 *
 * Comprehensive tests for the SOC 2 compliance agent state machine.
 * Tests cover: node execution, state transitions, violation detection, and fix generation.
 */

import { describe, it, expect } from 'vitest'
import { runAgent, agent } from './agent'
import { AgentState, Framework } from './types'
import { SOC2_PROMPTS, renderPrompt } from './prompts'

describe('LangGraph Agent', () => {
  // ============= BASIC STATE TESTS =============

  describe('State Machine Initialization', () => {
    it('should initialize agent with valid state', () => {
      expect(agent).toBeDefined()
    })

    it('should start at parse step', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: 'def test(): pass',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.success).toBe(true)
      expect(result.state.currentStep).toBe('validated')
    })

    it('should handle empty violations list', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: 'def test(): pass',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.violations).toEqual([])
      expect(result.fixes).toEqual([])
    })
  })

  // ============= PARSE NODE TESTS =============

  describe('Parse Node', () => {
    it('should validate empty code', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: '',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.error).toBeDefined()
      expect(result.state.error).toContain('empty')
    })

    it('should validate empty file path', async () => {
      const input: AgentState = {
        filePath: '',
        code: 'def test(): pass',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.error).toBeDefined()
      expect(result.state.error).toContain('path')
    })

    it('should detect Django framework for .py files', async () => {
      const input: AgentState = {
        filePath: 'views.py',
        code: 'def my_view(request): pass',
        framework: 'unknown',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.framework).toBe('django')
    })

    it('should detect Express framework for .js files', async () => {
      const input: AgentState = {
        filePath: 'routes.js',
        code: 'router.get("/")',
        framework: 'unknown',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.framework).toBe('express')
    })

    it('should preserve provided framework', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: 'code',
        framework: 'flask',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.framework).toBe('flask')
    })
  })

  // ============= ANALYZE NODE TESTS =============

  describe('Analyze Node - Python', () => {
    it('should detect missing @login_required decorator', async () => {
      const code = `def user_profile(request):
    return render(request, 'profile.html')`

      const input: AgentState = {
        filePath: 'views.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const cc61Violations = result.violations.filter((v) => v.controlId === 'CC6.1')
      expect(cc61Violations.length).toBeGreaterThan(0)
      expect(cc61Violations[0].severity).toBe('high')
    })

    it('should detect hardcoded passwords', async () => {
      const code = `password = 'admin123'
db_url = 'mysql://user:pass@localhost'`

      const input: AgentState = {
        filePath: 'config.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const cc67Violations = result.violations.filter((v) => v.controlId === 'CC6.7')
      expect(cc67Violations.length).toBeGreaterThan(0)
      expect(cc67Violations[0].severity).toBe('critical')
    })

    it('should detect hardcoded API keys', async () => {
      const code = `api_key = 'sk_live_1234567890abcdef'`

      const input: AgentState = {
        filePath: 'integrations.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const cc67Violations = result.violations.filter((v) => v.controlId === 'CC6.7')
      expect(cc67Violations.length).toBeGreaterThan(0)
    })

    it('should detect missing audit logs on save', async () => {
      const code = `user.profile.save()
product.quantity -= 1`

      const input: AgentState = {
        filePath: 'models.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const cc72Violations = result.violations.filter((v) => v.controlId === 'CC7.2')
      expect(cc72Violations.length).toBeGreaterThan(0)
      expect(cc72Violations[0].description).toContain('logging')
    })

    it('should detect unhandled external calls', async () => {
      const code = `response = requests.get(external_url)
data = response.json()`

      const input: AgentState = {
        filePath: 'services.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const a12Violations = result.violations.filter((v) => v.controlId === 'A1.2')
      expect(a12Violations.length).toBeGreaterThan(0)
      expect(a12Violations[0].severity).toBe('high')
    })
  })

  describe('Analyze Node - JavaScript/TypeScript', () => {
    it('should detect missing auth middleware on routes', async () => {
      const code = `router.get('/api/users', (req, res) => {
  res.json(User.find())
})`

      const input: AgentState = {
        filePath: 'routes.js',
        code,
        framework: 'express',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const cc61Violations = result.violations.filter((v) => v.controlId === 'CC6.1')
      expect(cc61Violations.length).toBeGreaterThan(0)
    })

    it('should detect hardcoded secrets in JS', async () => {
      const code = `const apiKey = 'sk_live_1234567890'
const password = 'secret123'`

      const input: AgentState = {
        filePath: 'config.js',
        code,
        framework: 'express',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const cc67Violations = result.violations.filter((v) => v.controlId === 'CC6.7')
      expect(cc67Violations.length).toBeGreaterThan(0)
    })

    it('should detect HTTP usage', async () => {
      const code = `fetch('http://api.example.com/data')
const client = new http.Client()`

      const input: AgentState = {
        filePath: 'api.js',
        code,
        framework: 'express',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      const cc67Violations = result.violations.filter((v) => v.controlId === 'CC6.7')
      expect(cc67Violations.some((v) => v.description.includes('HTTPS'))).toBe(true)
    })
  })

  // ============= GENERATE FIXES NODE TESTS =============

  describe('Generate Fixes Node', () => {
    it('should generate fix for CC6.1 Django', async () => {
      const code = `def user_view(request):
    return render(request, 'user.html')`

      const input: AgentState = {
        filePath: 'views.py',
        code,
        framework: 'django',
        violations: [
          {
            controlId: 'CC6.1',
            severity: 'high',
            description: 'Missing login_required',
            filePath: 'views.py',
            lineNumber: 1,
            codeSnippet: 'def user_view(request):',
          },
        ],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.fixes.length).toBe(1)
      expect(result.fixes[0].fixedCode).toContain('@login_required')
    })

    it('should generate fix for CC6.1 Express', async () => {
      const code = `router.get('/users', (req, res) => { })`

      const input: AgentState = {
        filePath: 'routes.js',
        code,
        framework: 'express',
        violations: [
          {
            controlId: 'CC6.1',
            severity: 'high',
            description: 'Missing auth middleware',
            filePath: 'routes.js',
            lineNumber: 1,
            codeSnippet: "router.get('/users',",
          },
        ],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.fixes.length).toBe(1)
      expect(result.fixes[0].fixedCode).toContain('authenticate')
    })

    it('should generate fix for CC6.7 secrets', async () => {
      const code = `api_key = 'sk_live_1234'`

      const input: AgentState = {
        filePath: 'config.py',
        code,
        framework: 'django',
        violations: [
          {
            controlId: 'CC6.7',
            severity: 'critical',
            description: 'Hardcoded API key',
            filePath: 'config.py',
            lineNumber: 1,
            codeSnippet: "api_key = 'sk_live_1234'",
          },
        ],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.fixes.length).toBe(1)
      expect(result.fixes[0].explanation).toContain('environment')
    })

    it('should generate fix for CC7.2 logging', async () => {
      const code = `user.save()`

      const input: AgentState = {
        filePath: 'models.py',
        code,
        framework: 'django',
        violations: [
          {
            controlId: 'CC7.2',
            severity: 'medium',
            description: 'Missing audit log',
            filePath: 'models.py',
            lineNumber: 1,
            codeSnippet: 'user.save()',
          },
        ],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.fixes.length).toBe(1)
      expect(result.fixes[0].fixedCode).toContain('logger')
    })

    it('should generate fix for A1.2 error handling', async () => {
      const code = `response = requests.get(url)`

      const input: AgentState = {
        filePath: 'services.py',
        code,
        framework: 'django',
        violations: [
          {
            controlId: 'A1.2',
            severity: 'high',
            description: 'Unhandled external call',
            filePath: 'services.py',
            lineNumber: 1,
            codeSnippet: 'response = requests.get(url)',
          },
        ],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.fixes.length).toBe(1)
      expect(result.fixes[0].fixedCode).toContain('try')
    })

    it('should mark all Phase 3 fixes as review trust level', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: 'code',
        framework: 'django',
        violations: [
          {
            controlId: 'CC6.1',
            severity: 'high',
            description: 'Test',
            filePath: 'test.py',
            lineNumber: 1,
            codeSnippet: 'code',
          },
        ],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      result.fixes.forEach((fix) => {
        expect(fix.trustLevel).toBe('review')
      })
    })

    it('should generate multiple fixes for multiple violations', async () => {
      const input: AgentState = {
        filePath: 'views.py',
        code: 'code',
        framework: 'django',
        violations: [
          {
            controlId: 'CC6.1',
            severity: 'high',
            description: 'Test 1',
            filePath: 'views.py',
            lineNumber: 1,
            codeSnippet: 'code1',
          },
          {
            controlId: 'CC6.7',
            severity: 'critical',
            description: 'Test 2',
            filePath: 'views.py',
            lineNumber: 2,
            codeSnippet: 'code2',
          },
          {
            controlId: 'CC7.2',
            severity: 'medium',
            description: 'Test 3',
            filePath: 'views.py',
            lineNumber: 3,
            codeSnippet: 'code3',
          },
        ],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.fixes.length).toBe(3)
      expect(result.violations.length).toBe(3)
    })
  })

  // ============= STATE TRANSITION TESTS =============

  describe('State Transitions', () => {
    it('should transition through all steps', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: 'def view(request): pass',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.currentStep).toBe('validated')
    })

    it('should preserve file path through transitions', async () => {
      const filePath = 'my/custom/path/views.py'
      const input: AgentState = {
        filePath,
        code: 'code',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.filePath).toBe(filePath)
    })

    it('should preserve code through transitions', async () => {
      const code = 'def my_function(request):\n    return render(request, "template.html")'
      const input: AgentState = {
        filePath: 'test.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.code).toBe(code)
    })

    it('should set timestamp on state', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: 'code',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.state.timestamp).toBeDefined()
    })
  })

  // ============= ERROR HANDLING TESTS =============

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const input: AgentState = {
        filePath: '',
        code: '',
        framework: 'unknown',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.success).toBe(false)
      expect(result.state.error).toBeDefined()
    })

    it('should not crash on unsupported framework', async () => {
      const input: AgentState = {
        filePath: 'test.rb',
        code: 'def test; end',
        framework: 'unknown',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.success).toBe(true)
    })

    it('should continue processing on parse errors', async () => {
      const input: AgentState = {
        filePath: 'test.py',
        code: '   ',
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)
      expect(result.success).toBe(false)
      expect(result.state.error).toBeDefined()
    })
  })

  // ============= FRAMEWORK-SPECIFIC TESTS =============

  describe('Framework Detection', () => {
    const frameworks: Framework[] = ['django', 'flask', 'express', 'nextjs', 'react', 'unknown']

    frameworks.forEach((framework) => {
      it(`should handle ${framework} framework`, async () => {
        const input: AgentState = {
          filePath: 'test.py',
          code: 'code',
          framework,
          violations: [],
          fixes: [],
          currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
        }

        const result = await runAgent(input as any)
        expect(result.state.framework).toBeDefined()
      })
    })
  })

  // ============= PROMPT TESTS =============

  describe('Prompt Rendering', () => {
    it('should render analysis prompt with variables', () => {
      const template = 'Code: {code}, Framework: {framework}'
      const rendered = renderPrompt(template, {
        code: 'def test(): pass',
        framework: 'django',
      })
      expect(rendered).toContain('def test(): pass')
      expect(rendered).toContain('django')
    })

    it('should handle object variables in prompts', () => {
      const template = 'Violations: {violations}'
      const rendered = renderPrompt(template, {
        violations: [{ controlId: 'CC6.1', severity: 'high' }],
      })
      expect(rendered).toContain('CC6.1')
    })

    it('should have all SOC 2 prompts defined', () => {
      const controlIds = Object.keys(SOC2_PROMPTS)
      expect(controlIds).toContain('CC6.1')
      expect(controlIds).toContain('CC6.7')
      expect(controlIds).toContain('CC7.2')
      expect(controlIds).toContain('A1.2')
    })

    it('should have analysis and fix prompts for each control', () => {
      Object.entries(SOC2_PROMPTS).forEach(([controlId, control]) => {
        expect(control.analysisPrompt).toBeDefined()
        expect(control.analysisPrompt).toContain(controlId)
        expect(control.fixGenerationPrompt).toBeDefined()
        expect(control.fixGenerationPrompt).toContain(controlId)
      })
    })
  })

  // ============= INTEGRATION TESTS =============

  describe('Integration Tests', () => {
    it('should process complete Django violation workflow', async () => {
      const code = `
def user_list(request):
    api_key = 'sk_live_12345'
    users = User.objects.all()
    return render(request, 'users.html')
`

      const input: AgentState = {
        filePath: 'views.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)

      // Should detect multiple violations
      expect(result.violations.length).toBeGreaterThan(0)

      // Should have CC6.1 (missing auth)
      expect(result.violations.some((v) => v.controlId === 'CC6.1')).toBe(true)

      // Should have CC6.7 (hardcoded secret)
      expect(result.violations.some((v) => v.controlId === 'CC6.7')).toBe(true)

      // Should generate fixes for all violations
      expect(result.fixes.length).toBeGreaterThan(0)

      // All fixes should have trust level
      result.fixes.forEach((fix) => {
        expect(['auto', 'review', 'manual']).toContain(fix.trustLevel)
      })
    })

    it('should process complete Express violation workflow', async () => {
      const code = `
router.post('/api/admin/users', (req, res) => {
  const password = 'admin123'
  User.create({ ...req.body, password })
  res.json({ success: true })
})
`

      const input: AgentState = {
        filePath: 'routes.js',
        code,
        framework: 'express',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)

      // Should detect violations
      expect(result.violations.length).toBeGreaterThan(0)

      // Should detect auth and secrets violations
      const controlIds = result.violations.map((v) => v.controlId)
      expect(controlIds.some((id) => id === 'CC6.1' || id === 'CC6.7')).toBe(true)

      // Should generate corresponding fixes
      expect(result.fixes.length).toBeGreaterThan(0)
    })

    it('should handle clean code without violations', async () => {
      const code = `
@login_required
def safe_view(request):
    api_key = os.getenv('API_KEY')
    logger.info('User accessed view')
    try:
        response = requests.get(external_url)
    except Exception as e:
        logger.error(f'Error: {e}')
    return render(request, 'template.html')
`

      const input: AgentState = {
        filePath: 'views.py',
        code,
        framework: 'django',
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: undefined,
        timestamp: undefined,
      }

      const result = await runAgent(input as any)

      // Should have few or no violations for well-written code
      expect(result.violations.length).toBeLessThanOrEqual(2)
    })
  })
})
