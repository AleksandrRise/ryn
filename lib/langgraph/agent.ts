/**
 * LangGraph Agent for SOC 2 Compliance Analysis and Fix Generation
 *
 * This is the core agent orchestration system that processes code violations
 * and generates fixes through a state machine workflow.
 *
 * Workflow: parse → analyze → generate_fixes → validate → end
 */

import { StateGraph, Annotation } from '@langchain/langgraph'
import { AgentState, AgentResponse, NodeInput, NodeOutput, Violation, Fix, Framework } from './types'
import { renderPrompt, getAnalysisPrompt, getFixPrompt } from './prompts'

/**
 * Agent state annotation with reducer functions for state updates
 * Each field defines how updates are merged with existing state
 */
const AgentStateAnnotation = Annotation.Root({
  filePath: Annotation<string>(),
  code: Annotation<string>(),
  framework: Annotation<Framework>(),
  violations: Annotation<Violation[]>({
    default: () => [],
    reducer: (_existing: Violation[], update: Violation[]) => update,
  }),
  fixes: Annotation<Fix[]>({
    default: () => [],
    reducer: (_existing: Fix[], update: Fix[]) => update,
  }),
  currentStep: Annotation<string>({
    default: () => 'parse',
  }),
  error: Annotation<string | undefined>({
    default: () => undefined,
  }),
  timestamp: Annotation<string | undefined>({
    default: () => new Date().toISOString(),
  }),
})

/**
 * Parse Node: Extract code metadata and validate input
 *
 * Responsibilities:
 * - Validate file path and code content
 * - Detect language from file extension
 * - Extract function/class names
 * - Prepare code for analysis
 */
async function parseNode(state: AgentState): Promise<NodeOutput> {
  try {
    const fileExtension = state.filePath.split('.').pop()?.toLowerCase()

    // Validate input
    if (!state.code || state.code.trim().length === 0) {
      return {
        ...state,
        currentStep: 'analyzed',
        error: 'Code is empty or invalid',
        violations: [],
      }
    }

    if (!state.filePath) {
      return {
        ...state,
        currentStep: 'analyzed',
        error: 'File path is required',
        violations: [],
      }
    }

    // Detect language/framework if not provided
    let detectedFramework = state.framework
    if (detectedFramework === 'unknown' || !detectedFramework) {
      if (fileExtension === 'py') {
        detectedFramework = 'django' // Default Python to Django
      } else if (['js', 'jsx', 'ts', 'tsx'].includes(fileExtension || '')) {
        detectedFramework = 'express' // Default JS/TS to Express
      }
    }

    return {
      filePath: state.filePath,
      code: state.code,
      framework: detectedFramework,
      currentStep: 'analyzed',
      violations: [],
      fixes: [],
      error: undefined,
    }
  } catch (error) {
    return {
      ...state,
      currentStep: 'analyzed',
      error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      violations: [],
    }
  }
}

/**
 * Analyze Node: Identify violations using pattern matching and LLM analysis
 *
 * Responsibilities:
 * - Apply regex patterns for each control
 * - Use Claude to analyze semantic issues
 * - Combine static and semantic analysis
 * - Return refined violation list
 *
 * NOTE: In Phase 3, this returns mock violations.
 * Real Claude integration happens in Phase 6.
 */
async function analyzeNode(state: AgentState): Promise<NodeOutput> {
  try {
    const violations: Violation[] = []

    // Static pattern matching for common violations
    const lines = state.code.split('\n')

    if (state.framework === 'django' || state.framework === 'flask') {
      // Python-specific patterns

      // CC6.1: Missing @login_required decorator
      const functionPattern = /^\s*def\s+(\w+)\s*\(/m
      const loginRequiredPattern = /@login_required/
      const permissionPattern = /@permission_required|@require_permission/

      lines.forEach((line, index) => {
        if (functionPattern.test(line) && !loginRequiredPattern.test(lines[index - 1] || '')) {
          // Check if this looks like a view (has request parameter)
          if (line.includes('request')) {
            violations.push({
              controlId: 'CC6.1',
              severity: 'high',
              description: 'View function missing @login_required decorator',
              filePath: state.filePath,
              lineNumber: index + 1,
              codeSnippet: line.trim(),
              detectedAt: new Date().toISOString(),
            })
          }
        }
      })

      // CC6.7: Hardcoded secrets (basic pattern)
      const secretPatterns = [
        /password\s*=\s*['"]((?!.*\{.*\}).{0,100})['"]/i,
        /api_key\s*=\s*['"](sk_|pk_|[a-z0-9]{20,})['"]/i,
        /token\s*=\s*['"](ghp_|gho_|[a-z0-9]{40,})['"]/i,
        /secret\s*=\s*['"]((?!.*\{.*\}).{0,100})['"]/i,
      ]

      lines.forEach((line, index) => {
        secretPatterns.forEach((pattern) => {
          if (pattern.test(line)) {
            violations.push({
              controlId: 'CC6.7',
              severity: 'critical',
              description: 'Hardcoded secret detected',
              filePath: state.filePath,
              lineNumber: index + 1,
              codeSnippet: line.trim(),
              detectedAt: new Date().toISOString(),
            })
          }
        })
      })

      // CC7.2: Missing audit logs
      const sensitiveOps = /\.save\(\)|\.delete\(\)|\.create\(|UPDATE |INSERT |DELETE FROM/
      const loggingPattern = /logger\.|print\(|logging\./

      lines.forEach((line, index) => {
        if (sensitiveOps.test(line) && !loggingPattern.test(lines[index + 1] || '')) {
          violations.push({
            controlId: 'CC7.2',
            severity: 'medium',
            description: 'Sensitive operation without audit logging',
            filePath: state.filePath,
            lineNumber: index + 1,
            codeSnippet: line.trim(),
            detectedAt: new Date().toISOString(),
          })
        }
      })

      // A1.2: Missing error handling
      const externalCallPattern = /requests\.|\.get\(|\.post\(|\.query\(|\.execute\(/
      const tryExceptPattern = /try:|except /

      let inTryBlock = false
      lines.forEach((line, index) => {
        if (tryExceptPattern.test(line)) {
          inTryBlock = tryExceptPattern.test(line) && line.includes('try')
        }

        if (externalCallPattern.test(line) && !inTryBlock) {
          violations.push({
            controlId: 'A1.2',
            severity: 'high',
            description: 'External call without error handling',
            filePath: state.filePath,
            lineNumber: index + 1,
            codeSnippet: line.trim(),
            detectedAt: new Date().toISOString(),
          })
        }
      })
    } else if (['express', 'nextjs', 'react'].includes(state.framework)) {
      // JavaScript/TypeScript patterns

      // CC6.1: Missing auth middleware
      const routePattern = /router\.(get|post|put|delete|patch)\s*\(/
      const authPattern = /auth|authenticate|requireLogin|checkAuth/

      lines.forEach((line, index) => {
        if (routePattern.test(line)) {
          const nextLine = lines[index + 1] || ''
          if (!authPattern.test(nextLine) && !authPattern.test(line)) {
            violations.push({
              controlId: 'CC6.1',
              severity: 'high',
              description: 'Route missing authentication middleware',
              filePath: state.filePath,
              lineNumber: index + 1,
              codeSnippet: line.trim(),
              detectedAt: new Date().toISOString(),
            })
          }
        }
      })

      // CC6.7: Hardcoded secrets
      const jsSecretPatterns = [
        /password\s*[:=]\s*['"]((?!.*\{.*\}).{0,100})['"]/i,
        /apiKey\s*[:=]\s*['"](sk_|pk_)[a-z0-9]+['"]/i,
        /token\s*[:=]\s*['"](ghp_|gho_)[a-z0-9]+['"]/i,
      ]

      lines.forEach((line, index) => {
        jsSecretPatterns.forEach((pattern) => {
          if (pattern.test(line)) {
            violations.push({
              controlId: 'CC6.7',
              severity: 'critical',
              description: 'Hardcoded secret detected',
              filePath: state.filePath,
              lineNumber: index + 1,
              codeSnippet: line.trim(),
              detectedAt: new Date().toISOString(),
            })
          }
        })
      })

      // CC6.7: HTTP vs HTTPS
      if (/http:\/\//i.test(state.code) && !/https:\/\//i.test(state.code)) {
        violations.push({
          controlId: 'CC6.7',
          severity: 'high',
          description: 'Insecure HTTP call detected, use HTTPS',
          filePath: state.filePath,
          lineNumber: 1,
          codeSnippet: 'http://',
          detectedAt: new Date().toISOString(),
        })
      }
    }

    return {
      filePath: state.filePath,
      code: state.code,
      framework: state.framework,
      violations,
      fixes: [],
      currentStep: 'fixes_generated',
      error: undefined,
    }
  } catch (error) {
    return {
      ...state,
      currentStep: 'fixes_generated',
      error: `Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Generate Fixes Node: Create AI-generated fixes for violations
 *
 * Responsibilities:
 * - For each violation, generate corresponding fix
 * - Call Claude API (Phase 6) or return mock fixes (Phase 3)
 * - Track trust level (auto/review/manual)
 * - Return enhanced fixes with explanations
 */
async function generateFixesNode(state: AgentState): Promise<NodeOutput> {
  try {
    const fixes: Fix[] = []

    // In Phase 3, generate mock fixes based on violation type
    // Phase 6 will replace this with real Claude API calls
    state.violations.forEach((violation, index) => {
      let fixedCode = state.code
      let explanation = ''

      switch (violation.controlId) {
        case 'CC6.1': {
          // Add login_required decorator (Python) or auth middleware (JS)
          if (state.framework === 'django' || state.framework === 'flask') {
            explanation =
              'Added @login_required decorator to protect the view. Users must be authenticated to access this endpoint.'
            fixedCode = fixedCode.replace(
              violation.codeSnippet,
              `@login_required\n${violation.codeSnippet}`
            )
          } else if (['express', 'nextjs'].includes(state.framework)) {
            explanation = 'Added authentication middleware to verify user identity before allowing access.'
            fixedCode = fixedCode.replace(
              violation.codeSnippet,
              `authenticate, ${violation.codeSnippet}`
            )
          }
          break
        }

        case 'CC6.7': {
          // Move secret to environment variable
          explanation =
            'Moved hardcoded secret to environment variable using process.env or os.getenv(). Never commit secrets to git.'
          const secretMatch = violation.codeSnippet.match(/=\s*['"]([^'"]+)['"]/)?.[1]
          if (secretMatch) {
            fixedCode = fixedCode.replace(
              violation.codeSnippet,
              violation.codeSnippet.replace(
                `'${secretMatch}'`,
                "os.getenv('SECRET_NAME')"
              )
            )
          }
          break
        }

        case 'CC7.2': {
          // Add logging statement
          explanation = 'Added audit logging to track this sensitive operation for compliance and debugging.'
          if (state.framework === 'django' || state.framework === 'flask') {
            fixedCode = fixedCode.replace(
              violation.codeSnippet,
              `logger.info(f'Operation: {violation.description}')\n${violation.codeSnippet}`
            )
          } else if (['express', 'nextjs'].includes(state.framework)) {
            fixedCode = fixedCode.replace(
              violation.codeSnippet,
              `logger.info('Operation performed');\n${violation.codeSnippet}`
            )
          }
          break
        }

        case 'A1.2': {
          // Add error handling
          explanation = 'Wrapped external call in try-catch with proper error handling to prevent cascading failures.'
          if (state.framework === 'django' || state.framework === 'flask') {
            fixedCode = fixedCode.replace(
              violation.codeSnippet,
              `try:\n    ${violation.codeSnippet}\nexcept Exception as e:\n    logger.error(f"Error: {e}")\n    # Handle error gracefully`
            )
          } else if (['express', 'nextjs'].includes(state.framework)) {
            fixedCode = fixedCode.replace(
              violation.codeSnippet,
              `try {\n    ${violation.codeSnippet}\n} catch (error) {\n    logger.error('Error:', error);\n    // Handle error gracefully\n}`
            )
          }
          break
        }
      }

      fixes.push({
        violationId: violation.id || `v${index}`,
        originalCode: violation.codeSnippet,
        fixedCode: fixedCode.includes(violation.codeSnippet) ? fixedCode : violation.codeSnippet,
        explanation,
        trustLevel: 'review', // Phase 3: all fixes marked as review until Phase 6
        appliedAt: undefined,
        gitCommitSha: undefined,
      })
    })

    return {
      filePath: state.filePath,
      code: state.code,
      framework: state.framework,
      violations: state.violations,
      fixes,
      currentStep: 'validated',
      error: undefined,
    }
  } catch (error) {
    return {
      ...state,
      currentStep: 'validated',
      error: `Fix generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Validate Node: Verify fixes don't introduce syntax errors
 *
 * Responsibilities:
 * - Check fix syntax (Phase 4+ with AST parser)
 * - Verify fixes address the violation
 * - Check for regressions
 * - Return final validation results
 */
async function validateNode(state: AgentState): Promise<NodeOutput> {
  try {
    // In Phase 3, skip deep validation
    // Phase 4+ will add syntax checking with tree-sitter

    const validatedFixes = state.fixes.map((fix) => ({
      ...fix,
      // Mark as validated if it contains code (not empty)
      trustLevel: fix.fixedCode && fix.fixedCode.length > 0 ? 'review' : 'manual',
    }))

    return {
      filePath: state.filePath,
      code: state.code,
      framework: state.framework,
      violations: state.violations,
      fixes: validatedFixes,
      currentStep: 'validated',
      error: undefined,
    }
  } catch (error) {
    return {
      ...state,
      currentStep: 'validated',
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Build the LangGraph state machine
 */
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode('parse', parseNode)
  .addNode('analyze', analyzeNode)
  .addNode('generate_fixes', generateFixesNode)
  .addNode('validate', validateNode)
  .addEdge('parse', 'analyze')
  .addEdge('analyze', 'generate_fixes')
  .addEdge('generate_fixes', 'validate')
  .addEdge('validate', '__end__')
  .setEntryPoint('parse')

/**
 * Compile the workflow into an executable agent
 */
export const agent = workflow.compile()

/**
 * Execute the agent with given input
 *
 * Usage:
 * ```typescript
 * const result = await runAgent({
 *   filePath: "app/views.py",
 *   code: "def my_view(request): ...",
 *   framework: "django",
 *   violations: [],
 *   fixes: [],
 *   currentStep: "parse"
 * })
 * ```
 */
export async function runAgent(input: AgentState): Promise<AgentResponse> {
  try {
    const result = await agent.invoke(input)

    return {
      state: result,
      success: !result.error,
      violations: result.violations,
      fixes: result.fixes,
      error: result.error,
    }
  } catch (error) {
    return {
      state: {
        ...input,
        error: `Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      success: false,
      violations: [],
      fixes: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
