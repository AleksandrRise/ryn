/**
 * Direct Claude AI Agent for Fix Generation
 *
 * This module provides direct integration with Claude via langchain-rust,
 * eliminating the need for cross-language TypeScript bridge.
 */

use serde::{Deserialize, Serialize};
use crate::models::{Violation, Fix};
use anyhow::Result;
use langchain_rust::llm::claude::Claude;
use langchain_rust::language_models::llm::LLM;

/**
 * Violation representation for agent communication
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentViolation {
    pub control_id: String,
    pub severity: String,
    pub description: String,
    pub file_path: String,
    pub line_number: i64,
    pub code_snippet: String,
}

/**
 * Fix representation for agent communication
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentFix {
    pub violation_id: Option<String>,
    pub original_code: String,
    pub fixed_code: String,
    pub explanation: String,
    pub trust_level: String,
}

/**
 * Response payload from the agent
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub success: bool,
    pub violations: Vec<AgentViolation>,
    pub fixes: Vec<AgentFix>,
    pub current_step: String,
    pub error: Option<String>,
}

/**
 * Convert database Violation to agent Violation
 */
pub fn violation_to_agent(violation: &Violation) -> AgentViolation {
    AgentViolation {
        control_id: violation.control_id.clone(),
        severity: violation.severity.clone(),
        description: violation.description.clone(),
        file_path: violation.file_path.clone(),
        line_number: violation.line_number,
        code_snippet: violation.code_snippet.clone(),
    }
}

/**
 * Convert agent Fix to database Fix
 */
pub fn agent_to_fix(violation_id: i64, agent_fix: &AgentFix) -> Fix {
    let trust_level = match agent_fix.trust_level.as_str() {
        "auto" => "auto",
        "review" => "review",
        "manual" => "manual",
        _ => "review",
    };

    Fix {
        id: 0, // Will be set by database
        violation_id,
        original_code: agent_fix.original_code.clone(),
        fixed_code: agent_fix.fixed_code.clone(),
        explanation: agent_fix.explanation.clone(),
        trust_level: trust_level.to_string(),
        applied_at: None,
        applied_by: "ryn-ai".to_string(),
        git_commit_sha: None,
        backup_path: None,
    }
}

/**
 * Configuration for the agent runner
 */
#[derive(Debug, Clone)]
pub struct AgentRunnerConfig {
    pub max_tokens: usize,
    pub model_name: String,
    pub temperature: f32,
}

impl Default for AgentRunnerConfig {
    fn default() -> Self {
        Self {
            max_tokens: 4096,
            model_name: "claude-3-5-sonnet-20240620".to_string(),
            temperature: 0.3,
        }
    }
}

/**
 * Agent runner: direct Claude API integration
 */
pub struct AgentRunner {
    config: AgentRunnerConfig,
}

impl AgentRunner {
    pub fn new(config: AgentRunnerConfig) -> Self {
        Self { config }
    }

    /**
     * Run the agent to generate fixes using Claude API directly
     *
     * # Arguments
     * * `file_path` - Path to the file being analyzed
     * * `code` - Source code to analyze
     * * `framework` - Framework/language (django, flask, express, etc.)
     * * `violations` - Database violations to include in the request
     *
     * # Returns
     * AgentResponse with generated fixes or an error
     */
    pub async fn run(
        &self,
        file_path: &str,
        code: &str,
        framework: &str,
        violations: Vec<Violation>,
    ) -> Result<AgentResponse> {
        // Validate input
        if code.trim().is_empty() {
            return Err(anyhow::anyhow!("Code cannot be empty"));
        }

        if file_path.trim().is_empty() {
            return Err(anyhow::anyhow!("File path cannot be empty"));
        }

        // Convert violations for agent
        let agent_violations: Vec<AgentViolation> = violations
            .iter()
            .map(violation_to_agent)
            .collect();

        if agent_violations.is_empty() {
            return Ok(AgentResponse {
                success: true,
                violations: vec![],
                fixes: vec![],
                current_step: "complete".to_string(),
                error: None,
            });
        }

        // Get API key from environment
        let api_key = std::env::var("ANTHROPIC_API_KEY")
            .map_err(|_| anyhow::anyhow!("ANTHROPIC_API_KEY environment variable not set"))?;

        // Create Claude client
        let claude = Claude::new()
            .with_model(&self.config.model_name)
            .with_api_key(&api_key);

        // Build prompt for fix generation
        let prompt = self.build_fix_generation_prompt(
            file_path,
            code,
            framework,
            &agent_violations,
        );

        println!("[AgentRunner] Calling Claude API with model: {}", self.config.model_name);

        // Call Claude API
        let response = claude.invoke(&prompt).await
            .map_err(|e| anyhow::anyhow!("Claude API error: {}", e))?;

        println!("[AgentRunner] Received response from Claude");

        // Parse the response to extract fixes
        let fixes = self.parse_fix_response(&response, &agent_violations)?;

        Ok(AgentResponse {
            success: true,
            violations: agent_violations,
            fixes,
            current_step: "complete".to_string(),
            error: None,
        })
    }

    /**
     * Build a prompt for Claude to generate fixes for SOC 2 violations
     */
    fn build_fix_generation_prompt(
        &self,
        file_path: &str,
        code: &str,
        framework: &str,
        violations: &[AgentViolation],
    ) -> String {
        let violations_list = violations
            .iter()
            .enumerate()
            .map(|(i, v)| {
                format!(
                    "{}. **{}** (Line {}): {} - Severity: {}\n   Code: `{}`",
                    i + 1,
                    v.control_id,
                    v.line_number,
                    v.description,
                    v.severity,
                    v.code_snippet
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n");

        format!(
            r#"You are a security compliance expert helping fix SOC 2 violations in {framework} code.

**File**: {file_path}

**Full Code**:
```
{code}
```

**Violations Found**:
{violations_list}

**Task**: For EACH violation, generate a fix in the following JSON format:

```json
[
  {{
    "original_code": "exact code to replace",
    "fixed_code": "corrected code",
    "explanation": "brief explanation of the fix",
    "trust_level": "review"
  }}
]
```

**Requirements**:
- Provide fixes in the EXACT order of the violations listed above
- Include ONLY the minimal code that needs to change (not the entire file)
- Ensure fixes are production-ready and follow {framework} best practices
- Each fix should address the specific SOC 2 control requirement
- Return ONLY the JSON array, no additional text

Generate the fixes now:"#,
            framework = framework,
            file_path = file_path,
            code = code,
            violations_list = violations_list
        )
    }

    /**
     * Parse Claude's response to extract fixes
     */
    fn parse_fix_response(
        &self,
        response: &str,
        violations: &[AgentViolation],
    ) -> Result<Vec<AgentFix>> {
        // Try to extract JSON from the response
        let json_start = response.find('[').unwrap_or(0);
        let json_end = response.rfind(']').map(|i| i + 1).unwrap_or(response.len());
        let json_str = &response[json_start..json_end];

        // Parse JSON
        let fixes: Vec<AgentFix> = serde_json::from_str(json_str)
            .map_err(|e| anyhow::anyhow!("Failed to parse Claude response as JSON: {}", e))?;

        // Validate we got the right number of fixes
        if fixes.len() != violations.len() {
            return Err(anyhow::anyhow!(
                "Expected {} fixes but got {}",
                violations.len(),
                fixes.len()
            ));
        }

        Ok(fixes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_agent_runner_validates_empty_code() {
        let runner = AgentRunner::new(AgentRunnerConfig::default());
        let result = runner.run("test.py", "", "django", vec![]).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Code cannot be empty"));
    }

    #[tokio::test]
    async fn test_agent_runner_validates_empty_file_path() {
        let runner = AgentRunner::new(AgentRunnerConfig::default());
        let result = runner.run("", "code", "django", vec![]).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("File path cannot be empty"));
    }

    #[tokio::test]
    async fn test_agent_runner_handles_no_violations() {
        let runner = AgentRunner::new(AgentRunnerConfig::default());
        let result = runner.run("test.py", "code", "django", vec![]).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.success);
        assert_eq!(response.fixes.len(), 0);
    }

    #[test]
    fn test_build_fix_generation_prompt() {
        let runner = AgentRunner::new(AgentRunnerConfig::default());
        let violations = vec![AgentViolation {
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Missing authentication".to_string(),
            file_path: "test.py".to_string(),
            line_number: 10,
            code_snippet: "def get_user():".to_string(),
        }];

        let prompt = runner.build_fix_generation_prompt(
            "test.py",
            "def get_user():\n    pass",
            "django",
            &violations,
        );

        assert!(prompt.contains("SOC 2 violations"));
        assert!(prompt.contains("CC6.1"));
        assert!(prompt.contains("Missing authentication"));
        assert!(prompt.contains("test.py"));
    }

    #[test]
    fn test_parse_fix_response_valid_json() {
        let runner = AgentRunner::new(AgentRunnerConfig::default());
        let violations = vec![AgentViolation {
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Missing authentication".to_string(),
            file_path: "test.py".to_string(),
            line_number: 10,
            code_snippet: "def get_user():".to_string(),
        }];

        let response = r#"[
            {
                "original_code": "def get_user():",
                "fixed_code": "@login_required\ndef get_user():",
                "explanation": "Added login_required decorator",
                "trust_level": "review"
            }
        ]"#;

        let result = runner.parse_fix_response(response, &violations);
        assert!(result.is_ok());
        let fixes = result.unwrap();
        assert_eq!(fixes.len(), 1);
        assert_eq!(fixes[0].original_code, "def get_user():");
    }

    #[test]
    fn test_parse_fix_response_wrong_count() {
        let runner = AgentRunner::new(AgentRunnerConfig::default());
        let violations = vec![
            AgentViolation {
                control_id: "CC6.1".to_string(),
                severity: "high".to_string(),
                description: "Missing authentication".to_string(),
                file_path: "test.py".to_string(),
                line_number: 10,
                code_snippet: "def get_user():".to_string(),
            },
            AgentViolation {
                control_id: "CC6.7".to_string(),
                severity: "critical".to_string(),
                description: "Hardcoded secret".to_string(),
                file_path: "test.py".to_string(),
                line_number: 5,
                code_snippet: "PASSWORD = 'secret'".to_string(),
            },
        ];

        let response = r#"[
            {
                "original_code": "def get_user():",
                "fixed_code": "@login_required\ndef get_user():",
                "explanation": "Added login_required decorator",
                "trust_level": "review"
            }
        ]"#;

        let result = runner.parse_fix_response(response, &violations);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Expected 2 fixes but got 1"));
    }
}
