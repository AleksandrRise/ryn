//! LangGraph AI agent communication commands
//!
//! Handles bidirectional communication between the Rust backend and TypeScript LangGraph agent
//! via Tauri's IPC system.

use crate::langgraph::agent_runner::AgentResponse;
use serde::Serialize;

/// Legacy event payload - no longer used since switching to direct Claude integration
#[derive(Clone, Serialize, Debug)]
#[allow(dead_code)]
pub struct RunAgentRequestEvent {
    pub request_id: String,
}

/// Response from the TypeScript bridge after agent execution
///
/// NOTE: This command is a legacy stub from the event-based bridge architecture.
/// It's no longer used since we switched to direct Claude API integration via langchain-rust.
/// Kept for backwards compatibility.
#[tauri::command]
pub async fn run_agent_response(
    request_id: String,
    response: AgentResponse,
) -> Result<(), String> {
    println!(
        "[LangGraph] Received legacy response for request_id: {} (success: {}) - No-op, using direct Claude integration",
        request_id, response.success
    );
    Ok(())
}

/// Legacy event emission function - no longer used since switching to direct Claude integration
///
/// NOTE: This function is a legacy stub from the event-based bridge architecture.
/// It's no longer used since we switched to direct Claude API integration via langchain-rust.
/// Kept for backwards compatibility.
#[allow(dead_code)]
pub fn emit_agent_request_event(
    _app: &tauri::AppHandle,
    request_id: String,
) -> Result<(), String> {
    println!(
        "[LangGraph] Legacy emit_agent_request_event called for request_id: {} - No-op, using direct Claude integration",
        request_id
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_run_agent_response_success() {
        let response = AgentResponse {
            success: true,
            violations: vec![],
            fixes: vec![],
            current_step: "complete".to_string(),
            error: None,
        };

        let result = run_agent_response("test-req-123".to_string(), response).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_run_agent_response_with_error() {
        let response = AgentResponse {
            success: false,
            violations: vec![],
            fixes: vec![],
            current_step: "error".to_string(),
            error: Some("Agent processing failed".to_string()),
        };

        let result = run_agent_response("test-req-456".to_string(), response).await;
        assert!(result.is_ok());
    }
}
