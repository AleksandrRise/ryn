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
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::Mutex;
use std::collections::HashMap;
use tokio::sync::oneshot;

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
 * Global request ID counter for generating unique request IDs
 */
static REQUEST_ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/**
 * Generates a unique request ID
 */
fn generate_request_id() -> String {
    let id = REQUEST_ID_COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("req-{}", id)
}

/**
 * Manages pending requests and their responses
 *
 * This struct allows the Rust backend to wait for responses from the TypeScript LangGraph agent.
 * When a request is sent to the agent, a oneshot channel is created and stored in this state.
 * When the agent completes, the TypeScript bridge invokes run_agent_response command,
 * which sends the response through the corresponding oneshot channel.
 */
#[derive(Debug)]
pub struct AgentRunnerState {
    /// Maps request_id to oneshot sender for that request's response
    pending_responses: HashMap<String, oneshot::Sender<AgentResponse>>,
}

impl AgentRunnerState {
    /// Create a new AgentRunnerState
    pub fn new() -> Self {
        Self {
            pending_responses: HashMap::new(),
        }
    }

    /// Register a pending request and return a receiver for its response
    ///
    /// # Returns
    /// A tuple of (request_id, receiver) where receiver can be awaited to get the response
    pub fn register_request(&mut self) -> (String, oneshot::Receiver<AgentResponse>) {
        let request_id = generate_request_id();
        let (tx, rx) = oneshot::channel();
        self.pending_responses.insert(request_id.clone(), tx);
        (request_id, rx)
    }

    /// Send a response for a pending request
    ///
    /// # Arguments
    /// * `request_id` - The ID of the request to respond to
    /// * `response` - The response to send
    ///
    /// # Returns
    /// Ok(()) if the request was found and the response was sent
    /// Err if the request was not found or already responded
    pub fn respond_to_request(&mut self, request_id: &str, response: AgentResponse) -> Result<()> {
        if let Some(tx) = self.pending_responses.remove(request_id) {
            // If the receiver has been dropped (timeout), send will fail silently
            let _ = tx.send(response);
            Ok(())
        } else {
            Err(anyhow::anyhow!(
                "Request {} not found or already responded",
                request_id
            ))
        }
    }

    /// Check if a request is still pending
    pub fn is_pending(&self, request_id: &str) -> bool {
        self.pending_responses.contains_key(request_id)
    }

    /// Get the number of pending requests
    pub fn pending_count(&self) -> usize {
        self.pending_responses.len()
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
    /// Shared state for managing pending requests and responses
    state: Arc<Mutex<AgentRunnerState>>,
}

impl AgentRunner {
    pub fn new(config: AgentRunnerConfig) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(AgentRunnerState::new())),
        }
    }

    /// Get a reference to the shared state
    pub fn state(&self) -> Arc<Mutex<AgentRunnerState>> {
        Arc::clone(&self.state)
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

    #[test]
    fn test_agent_runner_state_creation() {
        let state = AgentRunnerState::new();
        assert_eq!(state.pending_count(), 0);
    }

    #[test]
    fn test_register_request_generates_unique_ids() {
        let mut state = AgentRunnerState::new();

        let (id1, _rx1) = state.register_request();
        let (id2, _rx2) = state.register_request();
        let (id3, _rx3) = state.register_request();

        // IDs should be unique
        assert_ne!(id1, id2);
        assert_ne!(id2, id3);
        assert_ne!(id1, id3);

        // IDs should start with "req-"
        assert!(id1.starts_with("req-"));
        assert!(id2.starts_with("req-"));
        assert!(id3.starts_with("req-"));

        // State should track all requests
        assert_eq!(state.pending_count(), 3);
        assert!(state.is_pending(&id1));
        assert!(state.is_pending(&id2));
        assert!(state.is_pending(&id3));
    }

    #[tokio::test]
    async fn test_respond_to_request_success() {
        let mut state = AgentRunnerState::new();

        let (request_id, rx) = state.register_request();

        // Create a response
        let response = AgentResponse {
            success: true,
            violations: vec![],
            fixes: vec![],
            current_step: "complete".to_string(),
            error: None,
        };

        // Respond to the request
        let result = state.respond_to_request(&request_id, response.clone());
        assert!(result.is_ok());

        // Verify the response is received
        let received = rx.await;
        assert!(received.is_ok());
        let received_response = received.unwrap();
        assert_eq!(received_response.success, true);
        assert_eq!(received_response.current_step, "complete");

        // Request should no longer be pending
        assert!(!state.is_pending(&request_id));
        assert_eq!(state.pending_count(), 0);
    }

    #[test]
    fn test_respond_to_nonexistent_request() {
        let mut state = AgentRunnerState::new();

        let response = AgentResponse {
            success: true,
            violations: vec![],
            fixes: vec![],
            current_step: "complete".to_string(),
            error: None,
        };

        // Try to respond to a request that doesn't exist
        let result = state.respond_to_request("nonexistent-request", response);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }

    #[tokio::test]
    async fn test_respond_to_request_twice() {
        let mut state = AgentRunnerState::new();

        let (request_id, _rx) = state.register_request();

        let response = AgentResponse {
            success: true,
            violations: vec![],
            fixes: vec![],
            current_step: "complete".to_string(),
            error: None,
        };

        // First response should succeed
        let result1 = state.respond_to_request(&request_id, response.clone());
        assert!(result1.is_ok());

        // Second response should fail (request already responded)
        let result2 = state.respond_to_request(&request_id, response);
        assert!(result2.is_err());
        assert!(result2.unwrap_err().to_string().contains("not found"));
    }

    #[tokio::test]
    async fn test_multiple_concurrent_requests() {
        let mut state = AgentRunnerState::new();

        // Register multiple requests
        let mut receivers = Vec::new();
        for _ in 0..5 {
            let (request_id, rx) = state.register_request();
            receivers.push((request_id, rx));
        }

        assert_eq!(state.pending_count(), 5);

        // Respond to each request
        for (i, (request_id, _)) in receivers.iter_mut().enumerate() {
            let response = AgentResponse {
                success: true,
                violations: vec![],
                fixes: vec![],
                current_step: format!("step-{}", i),
                error: None,
            };

            state.respond_to_request(&request_id, response).unwrap();
        }

        // All requests should be processed
        assert_eq!(state.pending_count(), 0);

        // Verify each response
        for (i, (_, rx)) in receivers.into_iter().enumerate() {
            let response = rx.await.unwrap();
            assert_eq!(response.current_step, format!("step-{}", i));
        }
    }

    #[test]
    fn test_agent_runner_has_state() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let state = runner.state();
        // State should be created and empty
        assert_eq!(state.blocking_lock().pending_count(), 0);
    }

    #[tokio::test]
    async fn test_agent_runner_state_shared_between_calls() {
        let config = AgentRunnerConfig::default();
        let runner = AgentRunner::new(config);

        let state1 = runner.state();
        let state2 = runner.state();

        // Both references should point to the same state
        let mut state1_guard = state1.lock().await;
        let (request_id, _rx) = state1_guard.register_request();

        drop(state1_guard);

        // Check from state2 reference
        let state2_guard = state2.lock().await;
        assert!(state2_guard.is_pending(&request_id));
    }
}
