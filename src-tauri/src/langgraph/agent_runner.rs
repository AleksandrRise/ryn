/**
 * Rust-TypeScript Bridge for LangGraph Agent
 *
 * This module provides the Rust side of the agent invocation.
 * It communicates with the TypeScript LangGraph agent running in Tauri
 * via the invoke_handler mechanism.
 */

use serde::{Deserialize, Serialize};
use crate::models::{Violation, Fix};
use anyhow::Result;

/**
 * Request payload sent to the TypeScript agent
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRequest {
    pub file_path: String,
    pub code: String,
    pub framework: String,
    pub violations: Vec<AgentViolation>,
}

/**
 * Violation representation for agent communication
 * Slightly different from the database model
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
 * Response payload from the TypeScript agent
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
 * Convert agent Violation back to database Violation
 */
pub fn agent_to_violation(scan_id: i64, agent_violation: &AgentViolation) -> Violation {
    Violation {
        id: 0, // Will be set by database
        scan_id,
        control_id: agent_violation.control_id.clone(),
        severity: agent_violation.severity.clone(),
        description: agent_violation.description.clone(),
        file_path: agent_violation.file_path.clone(),
        line_number: agent_violation.line_number,
        code_snippet: agent_violation.code_snippet.clone(),
        status: "open".to_string(),
        detected_at: chrono::Utc::now().to_rfc3339(),
        detection_method: "regex".to_string(),
        confidence_score: None,
        llm_reasoning: None,
        regex_reasoning: None,
        function_name: None,
        class_name: None,
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
            model_name: "claude-haiku-4.5".to_string(),
            temperature: 0.3,
        }
    }
}

/**
 * Agent runner: orchestrates invocation of TypeScript agent
 *
 * In Phase 3, this is a mock implementation.
 * Phase 6+ will implement real Tauri invoke calls.
 */
pub struct AgentRunner {
    #[allow(dead_code)]
    config: AgentRunnerConfig,
}

impl AgentRunner {
    pub fn new(config: AgentRunnerConfig) -> Self {
        Self { config }
    }

    /**
     * Run the agent on code
     *
     * This method would invoke the TypeScript agent via Tauri IPC.
     * Phase 3: Returns mock response for testing
     * Phase 8+: Implements real Tauri invoke call
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

        // Create request
        let request = AgentRequest {
            file_path: file_path.to_string(),
            code: code.to_string(),
            framework: framework.to_string(),
            violations: agent_violations,
        };

        // In Phase 3, return mock response
        // In Phase 8, this would be:
        // let response: AgentResponse = invoke("run_agent", &request).await?;
        let response = self.mock_run(&request)?;

        Ok(response)
    }

    /**
     * Mock implementation for Phase 3 testing
     */
    fn mock_run(&self, request: &AgentRequest) -> Result<AgentResponse> {
        let violations = request.violations.clone();
        let mut fixes = Vec::new();

        // Generate mock fixes for each violation
        for violation in &violations {
            let fixed_code = match violation.control_id.as_str() {
                "CC6.1" => {
                    if request.framework == "django" {
                        format!("@login_required\n{}", violation.code_snippet)
                    } else {
                        format!("authenticate, {}", violation.code_snippet)
                    }
                }
                "CC6.7" => format!("os.getenv('SECRET')", ),
                "CC7.2" => {
                    if request.framework == "django" {
                        format!("logger.info('audit log')\n{}", violation.code_snippet)
                    } else {
                        format!("logger.info('audit log');\n{}", violation.code_snippet)
                    }
                }
                "A1.2" => {
                    if request.framework == "django" {
                        format!("try:\n    {}\nexcept Exception as e:\n    logger.error(e)", violation.code_snippet)
                    } else {
                        format!("try {{\n    {}\n}} catch (e) {{\n    logger.error(e);\n}}", violation.code_snippet)
                    }
                }
                _ => violation.code_snippet.clone(),
            };

            fixes.push(AgentFix {
                violation_id: Some(violation.control_id.clone()),
                original_code: violation.code_snippet.clone(),
                fixed_code,
                explanation: format!(
                    "Fixed {} violation: {}",
                    violation.control_id, violation.description
                ),
                trust_level: "review".to_string(),
            });
        }

        Ok(AgentResponse {
            success: true,
            violations,
            fixes,
            current_step: "validated".to_string(),
            error: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_runner_creation() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);
        assert_eq!(runner.config.model_name, "claude-haiku-4.5");
    }

    #[test]
    fn test_violation_conversion() {
        let violation = Violation {
            id: 1,
            scan_id: 1,
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Missing auth".to_string(),
            file_path: "test.py".to_string(),
            line_number: 42,
            code_snippet: "def view(request):".to_string(),
            status: "open".to_string(),
            detected_at: "2025-01-01T00:00:00Z".to_string(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };

        let agent_violation = violation_to_agent(&violation);
        assert_eq!(agent_violation.control_id, "CC6.1");
        assert_eq!(agent_violation.line_number, 42);
    }

    #[test]
    fn test_agent_to_violation_conversion() {
        let agent_violation = AgentViolation {
            control_id: "CC6.7".to_string(),
            severity: "critical".to_string(),
            description: "Hardcoded secret".to_string(),
            file_path: "test.py".to_string(),
            line_number: 10,
            code_snippet: "password = 'secret'".to_string(),
        };

        let violation = agent_to_violation(1, &agent_violation);
        assert_eq!(violation.scan_id, 1);
        assert_eq!(violation.control_id, "CC6.7");
        assert_eq!(violation.severity, "critical");
    }

    #[test]
    fn test_agent_to_fix_conversion() {
        let agent_fix = AgentFix {
            violation_id: Some("v1".to_string()),
            original_code: "password = 'secret'".to_string(),
            fixed_code: "password = os.getenv('SECRET')".to_string(),
            explanation: "Moved secret to env var".to_string(),
            trust_level: "review".to_string(),
        };

        let fix = agent_to_fix(1, &agent_fix);
        assert_eq!(fix.violation_id, 1);
        assert_eq!(fix.trust_level, "review");
        assert!(fix.applied_at.is_none());
    }

    #[tokio::test]
    async fn test_agent_runner_empty_code() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let result = runner
            .run("test.py", "", "django", vec![])
            .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty"));
    }

    #[tokio::test]
    async fn test_agent_runner_empty_path() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let result = runner
            .run("", "code", "django", vec![])
            .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("path"));
    }

    #[tokio::test]
    async fn test_agent_runner_django_auth_fix() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let violation = Violation {
            id: 1,
            scan_id: 1,
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Missing login_required".to_string(),
            file_path: "views.py".to_string(),
            line_number: 5,
            code_snippet: "def my_view(request):".to_string(),
            status: "open".to_string(),
            detected_at: "2025-01-01T00:00:00Z".to_string(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };

        let result = runner
            .run("views.py", "def my_view(request):\n    pass", "django", vec![violation])
            .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.success);
        assert!(!response.fixes.is_empty());
        assert!(response.fixes[0].fixed_code.contains("@login_required"));
    }

    #[tokio::test]
    async fn test_agent_runner_express_auth_fix() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let violation = Violation {
            id: 1,
            scan_id: 1,
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Missing auth middleware".to_string(),
            file_path: "routes.js".to_string(),
            line_number: 5,
            code_snippet: "router.get('/api/users'".to_string(),
            status: "open".to_string(),
            detected_at: "2025-01-01T00:00:00Z".to_string(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };

        let result = runner
            .run("routes.js", "router.get('/api/users'", "express", vec![violation])
            .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.success);
        assert!(!response.fixes.is_empty());
        assert!(response.fixes[0].fixed_code.contains("authenticate"));
    }

    #[tokio::test]
    async fn test_agent_runner_multiple_violations() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let violations = vec![
            Violation {
                id: 1,
                scan_id: 1,
                control_id: "CC6.1".to_string(),
                severity: "high".to_string(),
                description: "Missing auth".to_string(),
                file_path: "views.py".to_string(),
                line_number: 5,
                code_snippet: "def view1(request):".to_string(),
                status: "open".to_string(),
                detected_at: "2025-01-01T00:00:00Z".to_string(),
                detection_method: "regex".to_string(),
                confidence_score: None,
                llm_reasoning: None,
                regex_reasoning: None,
            function_name: None,
            class_name: None,
            },
            Violation {
                id: 2,
                scan_id: 1,
                control_id: "CC6.7".to_string(),
                severity: "critical".to_string(),
                description: "Hardcoded secret".to_string(),
                file_path: "views.py".to_string(),
                line_number: 10,
                code_snippet: "api_key = 'secret'".to_string(),
                status: "open".to_string(),
                detected_at: "2025-01-01T00:00:00Z".to_string(),
                detection_method: "regex".to_string(),
                confidence_score: None,
                llm_reasoning: None,
                regex_reasoning: None,
            function_name: None,
            class_name: None,
            },
        ];

        let result = runner
            .run("views.py", "code", "django", violations)
            .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.violations.len(), 2);
        assert_eq!(response.fixes.len(), 2);
    }

    #[tokio::test]
    async fn test_agent_runner_response_structure() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let result = runner
            .run("test.py", "code", "django", vec![])
            .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.success);
        assert_eq!(response.current_step, "validated");
        assert!(response.error.is_none());
    }
}
