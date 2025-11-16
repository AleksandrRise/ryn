//! LangGraph AI agent communication commands
//!
//! Handles bidirectional communication between the Rust backend and TypeScript LangGraph agent
//! via Tauri's IPC system.

use crate::langgraph::agent_runner::{AgentResponse, AgentRequest, AgentRunner};
use serde::Serialize;
use tauri::{Emitter, State};

/// Event payload emitted by Rust when requesting agent invocation
#[derive(Clone, Serialize, Debug)]
pub struct RunAgentRequestEvent {
    /// Unique request ID for matching responses
    pub request_id: String,
    /// Request payload sent to agent
    pub request: AgentRequest,
}

/// Response from the TypeScript bridge after agent execution
///
/// This command is called by the TypeScript bridge (lib/langgraph/tauri-bridge.ts)
/// after the LangGraph agent completes processing.
///
/// It delivers the response to the waiting AgentRunner::run() call via the
/// oneshot channel stored in AgentRunner's pending_responses HashMap.
#[tauri::command]
pub async fn run_agent_response(
    agent_runner: State<'_, AgentRunner>,
    request_id: String,
    response: AgentResponse,
) -> Result<(), String> {
    println!(
        "[LangGraph] Received response for request_id: {} (success: {})",
        request_id, response.success
    );

    // Deliver the response to the waiting AgentRunner::run() call
    let state_arc = agent_runner.state();
    let mut state = state_arc.lock().await;
    state
        .respond_to_request(&request_id, response)
        .map_err(|e| format!("Failed to deliver agent response: {}", e))
}

/// Emit a run-agent-request event to the frontend
///
/// Called by AgentRunner::run() to invoke the TypeScript agent
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `request_id` - Unique request ID for matching responses
/// * `request` - Agent request payload
pub fn emit_agent_request_event(
    app: &tauri::AppHandle,
    request_id: String,
    request: AgentRequest,
) -> Result<(), String> {
    let event = RunAgentRequestEvent {
        request_id,
        request,
    };

    app.emit("run-agent-request", &event)
        .map_err(|e| format!("Failed to emit agent request: {}", e))
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
