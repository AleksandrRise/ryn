// Test recording/replay commands for MCP bridge
// Implements: test_record, test_replay

use tauri::{AppHandle, Manager, Runtime};
use serde_json::{json, Value};

use crate::state::{MCPState, TestAction};

/// Start recording user interactions
/// Returns: { recording_id: string }
pub async fn record<R: Runtime>(app: &AppHandle<R>, _params: &Value) -> Result<Value, String> {
    // Generate recording ID
    let recording_id = uuid::Uuid::new_v4().to_string();

    // Initialize empty recording
    app.state::<MCPState>()
        .recordings
        .lock()
        .map_err(|e| format!("State lock poisoned: {}", e))?
        .insert(recording_id.clone(), Vec::new());

    // TODO: Inject JavaScript to capture DOM events (click, input, etc.)
    // and invoke back to Rust to append to recording

    Ok(json!({
        "recording_id": recording_id,
        "recording": true
    }))
}

/// Replay recorded interactions
/// Params: { recording: TestAction[] }
pub async fn replay<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let recording: Vec<TestAction> = params.get("recording")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or("Missing or invalid parameter: recording")?;

    // Get first window
    let window = super::get_window(app, None)?;

    // Replay each action
    for action in &recording {
        match action.action_type.as_str() {
            "click" => {
                if let Some(selector) = action.data.get("selector").and_then(|v| v.as_str()) {
                    let js = format!(r#"document.querySelector("{}").click();"#, selector);
                    window.eval(&js)
                        .map_err(|e| format!("Failed to replay click: {}", e))?;
                }
            }
            "type" => {
                if let Some(text) = action.data.get("text").and_then(|v| v.as_str()) {
                    let js = format!(r#"
                        document.activeElement.value = "{}";
                        document.activeElement.dispatchEvent(new Event('input'));
                    "#, text.replace('"', "\\\""));
                    window.eval(&js)
                        .map_err(|e| format!("Failed to replay type: {}", e))?;
                }
            }
            "navigate" => {
                if let Some(url) = action.data.get("url").and_then(|v| v.as_str()) {
                    let parsed_url = tauri::Url::parse(url)
                        .map_err(|e| format!("Invalid URL: {}", e))?;
                    window.navigate(parsed_url)
                        .map_err(|e| format!("Failed to replay navigate: {}", e))?;
                }
            }
            _ => {
                log::warn!("[MCP] Unknown action type in replay: {}", action.action_type);
            }
        }

        // Small delay between actions
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    Ok(json!({
        "replayed": true,
        "actions": recording.len()
    }))
}
