/**
 * SOC 2 Compliance Prompt Templates
 *
 * Comprehensive prompt templates for each SOC 2 control.
 * Used by the LangGraph agent to analyze violations and generate fixes.
 *
 * Each prompt includes:
 * - Control description and requirement
 * - Common violation patterns
 * - Fix examples
 * - Framework-specific guidance
 */

export const SOC2_PROMPTS = {
  'CC6.1': {
    name: 'Access Control (CC6.1)',
    description: 'Logical access controls must authenticate users and enforce role-based access control (RBAC)',
    requirement: 'All authenticated endpoints must require a valid login. All sensitive operations must check user permissions.',

    analysisPrompt: `You are a SOC 2 compliance auditor analyzing code for Access Control violations.

CONTROL: CC6.1 - Logical Access Controls
REQUIREMENT: All authenticated endpoints must require a valid login. All sensitive operations must check user permissions.

FRAMEWORK: {framework}

VIOLATION PATTERNS:
- View/endpoint without @login_required or auth middleware
- Route that accepts requests without authentication check
- Admin operation without role check (only checks is_authenticated)
- No permission verification on API endpoints
- Hardcoded user IDs (user_id = 1)

CODE TO ANALYZE:
\`\`\`{framework}
{code}
\`\`\`

VIOLATIONS DETECTED:
{violations}

For each violation, determine:
1. Is this a real authentication gap? (YES/NO)
2. What is the impact? (critical/high/medium/low)
3. What decorator or middleware is needed?
4. Does the fix require RBAC or just auth?

Return only a JSON array of refined violations with these fields:
{
  "controlId": "CC6.1",
  "severity": "critical|high|medium|low",
  "description": "specific finding",
  "codeSnippet": "the problematic code",
  "lineNumber": 42,
  "suggestedFix": "specific decorator or check to add"
}`,

    fixGenerationPrompt: `You are a Python/JavaScript code fixer specializing in authentication and authorization.

CONTROL: CC6.1 - Logical Access Controls
FRAMEWORK: {framework}

VIOLATION TO FIX:
Description: {violationDescription}
Code snippet:
\`\`\`{framework}
{originalCode}
\`\`\`

REQUIREMENTS:
1. Add authentication decorator if missing
2. Add permission/role check if missing
3. Follow {framework} conventions
4. Maintain function signature
5. Add meaningful comments

For Django: Use @login_required, @permission_required, or @require_permission
For Express: Use middleware like \`(req, res, next) => req.user ? next() : res.status(401).json(...)\`
For Next.js: Use middleware auth or getServerSession checks

Return ONLY valid {framework} code:
\`\`\`{framework}
[FIXED CODE HERE]
\`\`\`

EXPLANATION:
[Brief explanation of the fix]`,
  },

  'CC6.7': {
    name: 'Cryptography & Secrets (CC6.7)',
    description: 'Sensitive data must be encrypted and secrets must not be hardcoded',
    requirement: 'No hardcoded secrets (passwords, API keys, tokens). Use environment variables or secure vaults. Enforce TLS for external calls.',

    analysisPrompt: `You are a SOC 2 compliance auditor analyzing code for Secrets violations.

CONTROL: CC6.7 - Cryptography & Secrets
REQUIREMENT: No hardcoded secrets. Use environment variables. Enforce TLS for HTTP calls.

FRAMEWORK: {framework}

VIOLATION PATTERNS:
- Hardcoded API keys, passwords, tokens
- Hardcoded database URLs with credentials
- API calls using http:// instead of https://
- Secrets in git history
- Secrets in config files checked into repo
- Unencrypted database passwords

CODE TO ANALYZE:
\`\`\`{framework}
{code}
\`\`\`

VIOLATIONS DETECTED:
{violations}

For each violation, determine:
1. What type of secret is hardcoded? (API key/password/token/etc)
2. What is the blast radius if leaked? (critical/high/medium/low)
3. Should it be an env var or vault?
4. Is the HTTP call insecure?

Return only a JSON array:
{
  "controlId": "CC6.7",
  "severity": "critical|high|medium|low",
  "description": "specific secret vulnerability",
  "codeSnippet": "the problematic code",
  "lineNumber": 42,
  "secretType": "api_key|password|token|connection_string",
  "suggestedFix": "use os.getenv('SECRET_NAME') or similar"
}`,

    fixGenerationPrompt: `You are a Python/JavaScript code fixer specializing in secrets management.

CONTROL: CC6.7 - Cryptography & Secrets
FRAMEWORK: {framework}

VIOLATION TO FIX:
Description: {violationDescription}
Code snippet:
\`\`\`{framework}
{originalCode}
\`\`\`

REQUIREMENTS:
1. Remove the hardcoded secret
2. Use environment variable via dotenv or os.getenv
3. Add validation that secret exists
4. If HTTP call, change http:// to https://
5. Follow {framework} conventions

For Python: os.getenv('API_KEY') with dotenv
For JavaScript: process.env.API_KEY with dotenv

Return ONLY valid {framework} code:
\`\`\`{framework}
[FIXED CODE HERE]
\`\`\`

EXPLANATION:
[Brief explanation of the fix]`,
  },

  'CC7.2': {
    name: 'System Monitoring & Logging (CC7.2)',
    description: 'Sensitive operations must be logged. Logging must not contain secrets.',
    requirement: 'Log access to sensitive data, user authentication, and data modifications. Never log passwords, API keys, or tokens.',

    analysisPrompt: `You are a SOC 2 compliance auditor analyzing code for Logging violations.

CONTROL: CC7.2 - System Monitoring & Logging
REQUIREMENT: Log sensitive operations. Never log secrets or PII.

FRAMEWORK: {framework}

VIOLATION PATTERNS:
- Sensitive operation without logging (user login, permission change, data access)
- Logging secrets (passwords, tokens, API keys) in logs
- Logging PII (SSN, credit cards, phone numbers) without redaction
- Database queries without audit trail
- Admin operations without logging
- Error responses logging sensitive data

CODE TO ANALYZE:
\`\`\`{framework}
{code}
\`\`\`

VIOLATIONS DETECTED:
{violations}

For each violation, determine:
1. Is this a missing audit log for a sensitive operation?
2. Is this logging sensitive data that should be redacted?
3. What operation/data needs logging?
4. What severity? (critical if logging secrets, high if missing audit log)

Return only a JSON array:
{
  "controlId": "CC7.2",
  "severity": "critical|high|medium|low",
  "description": "specific logging violation",
  "codeSnippet": "the problematic code",
  "lineNumber": 42,
  "violationType": "missing_audit_log|logging_secrets|logging_pii",
  "suggestedFix": "add logger.info or remove sensitive fields from log"
}`,

    fixGenerationPrompt: `You are a Python/JavaScript code fixer specializing in audit logging.

CONTROL: CC7.2 - System Monitoring & Logging
FRAMEWORK: {framework}

VIOLATION TO FIX:
Description: {violationDescription}
Code snippet:
\`\`\`{framework}
{originalCode}
\`\`\`

REQUIREMENTS:
1. If missing audit log: Add logging for the sensitive operation
2. If logging secrets: Remove secret fields from the log statement
3. If logging PII: Add redaction or masking
4. Use structured logging (JSON format preferred)
5. Include timestamp, user, action, resource

For Python: Use logging module with logger.info/warning
For JavaScript: Use winston or similar structured logger

Return ONLY valid {framework} code:
\`\`\`{framework}
[FIXED CODE HERE]
\`\`\`

EXPLANATION:
[Brief explanation of the fix]`,
  },

  'A1.2': {
    name: 'Resilience & Error Handling (A1.2)',
    description: 'System must handle failures gracefully with retries, circuit breakers, and proper error recovery',
    requirement: 'All external service calls must have error handling, retries with exponential backoff, and circuit breaker pattern. Database queries must handle connection failures.',

    analysisPrompt: `You are a SOC 2 compliance auditor analyzing code for Resilience violations.

CONTROL: A1.2 - Resilience & Error Handling
REQUIREMENT: Handle external service failures gracefully. Retry with backoff. Use circuit breakers.

FRAMEWORK: {framework}

VIOLATION PATTERNS:
- External API call without try-catch
- Database query without exception handling
- No retry logic on transient failures
- No circuit breaker for repeated failures
- No timeout on external calls
- Propagating raw exceptions to user
- No fallback when service unavailable
- Infinite retry loop without backoff

CODE TO ANALYZE:
\`\`\`{framework}
{code}
\`\`\`

VIOLATIONS DETECTED:
{violations}

For each violation, determine:
1. Is this an external call (API, database, file system)?
2. Does it have try-catch or error handling?
3. Does it have retry logic?
4. Does it have timeout?
5. What is the impact if it fails? (critical/high/medium/low)

Return only a JSON array:
{
  "controlId": "A1.2",
  "severity": "critical|high|medium|low",
  "description": "specific resilience gap",
  "codeSnippet": "the problematic code",
  "lineNumber": 42,
  "failureType": "no_error_handling|no_retry|no_timeout|no_circuit_breaker",
  "suggestedFix": "add try-catch, retry with backoff, timeout, or circuit breaker"
}`,

    fixGenerationPrompt: `You are a Python/JavaScript code fixer specializing in resilience patterns.

CONTROL: A1.2 - Resilience & Error Handling
FRAMEWORK: {framework}

VIOLATION TO FIX:
Description: {violationDescription}
Code snippet:
\`\`\`{framework}
{originalCode}
\`\`\`

REQUIREMENTS:
1. Add try-catch or error handling
2. Add retry logic with exponential backoff if transient
3. Add timeout to prevent hanging
4. Add circuit breaker if calling external service repeatedly
5. Log the failure
6. Return graceful error response

For Python: Use tenacity for retries, implement circuit breaker pattern
For JavaScript: Use async/await with try-catch, node-retry or p-retry

Exponential backoff example: 1s, 2s, 4s, 8s (with jitter)
Circuit breaker: track failures, stop after N failures, retry after cooldown

Return ONLY valid {framework} code:
\`\`\`{framework}
[FIXED CODE HERE]
\`\`\`

EXPLANATION:
[Brief explanation of the fix]`,
  },
}

/**
 * Get prompt template for a specific control
 */
export function getAnalysisPrompt(controlId: string): string {
  const control = SOC2_PROMPTS[controlId as keyof typeof SOC2_PROMPTS]
  if (!control) {
    throw new Error(`Unknown control: ${controlId}`)
  }
  return control.analysisPrompt
}

/**
 * Get fix generation prompt for a specific control
 */
export function getFixPrompt(controlId: string): string {
  const control = SOC2_PROMPTS[controlId as keyof typeof SOC2_PROMPTS]
  if (!control) {
    throw new Error(`Unknown control: ${controlId}`)
  }
  return control.fixGenerationPrompt
}

/**
 * Render prompt with variables
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | object>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    result = result.replaceAll(placeholder, stringValue)
  }
  return result
}

/**
 * Get all control IDs
 */
export function getAllControlIds(): string[] {
  return Object.keys(SOC2_PROMPTS)
}

/**
 * Validate control ID
 */
export function isValidControlId(controlId: string): boolean {
  return controlId in SOC2_PROMPTS
}
