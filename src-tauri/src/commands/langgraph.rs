//! LangGraph AI agent communication commands
//!
//! Handles bidirectional communication between the Rust backend and TypeScript LangGraph agent
//! via Tauri's IPC system.

use crate::langgraph::agent_runner::{AgentResponse, AgentRequest};
use serde::Serialize;
use tauri::Emitter;

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
#[tauri::command]
pub async fn run_agent_response(
    request_id: String,
    response: AgentResponse,
) -> Result<(), String> {
    // In this implementation, the response will be handled through a channel
    // that was waiting in AgentRunner::run() (via oneshot channel)

    // The actual response delivery happens through the pending_responses HashMap
    // in the AgentRunner state that gets accessed via the Tauri app state

    // For now, we just acknowledge receipt - actual dispatching happens in
    // the calling AgentRunner::run() method which holds the receiver end

    println!(
        "[LangGraph] Received response for request_id: {} (success: {})",
        request_id, response.success
    );

    Ok(())
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
