// Event subscription commands for MCP bridge
// Implements: events_subscribe, events_unsubscribe, events_list

use tauri::{AppHandle, Listener, Manager, Runtime};
use serde_json::{json, Value};

use crate::state::MCPState;

/// Subscribe to events
/// Params: { types: string[] }
pub async fn subscribe<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let types: Vec<String> = params.get("types")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or("Missing or invalid parameter: types (expected array of strings)")?;

    let state = app.state::<MCPState>();

    for event_type in &types {
        // Clone sender for the closure
        let sender = state.notification_sender.clone();
        let event_type_owned = event_type.clone();
        
        let id = app.listen(event_type.clone(), move |event| {
            // Try to parse payload as JSON, otherwise keep as string
            let payload_str = event.payload();
            let payload_json: Value = serde_json::from_str(payload_str)
                .unwrap_or_else(|_| Value::String(payload_str.to_string()));
                
            // Create JSON-RPC notification
            let notification = json!({
                "jsonrpc": "2.0",
                "method": "notifications/event",
                "params": {
                    "event": event_type_owned,
                    "payload": payload_json,
                    // window_label, id, etc. might be available in event? 
                    // tauri::Event has window_label() but it depends on event type
                }
            });
            
            // Broadcast
            // Ignore error if no receivers (channel closed or empty)
            let _ = sender.send(notification);
        });

        // Store EventId for later unsubscription
        state.event_subscriptions.lock()
            .map_err(|e| format!("State lock poisoned: {}", e))?
            .insert(event_type.clone(), id);
    }

    Ok(json!({
        "subscribed": types,
        "count": types.len()
    }))
}

/// Unsubscribe from events
/// Params: { types: string[] }
pub async fn unsubscribe<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let types: Vec<String> = params.get("types")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or("Missing or invalid parameter: types (expected array of strings)")?;

    let state = app.state::<MCPState>();
    let mut subs = state.event_subscriptions.lock()
        .map_err(|e| format!("State lock poisoned: {}", e))?;

    let mut unsubscribed = Vec::new();

    for event_type in types {
        if let Some(id) = subs.remove(&event_type) {
            app.unlisten(id);
            unsubscribed.push(event_type);
        }
    }

    Ok(json!({
        "unsubscribed": unsubscribed,
        "count": unsubscribed.len()
    }))
}

/// List available event types
/// Returns hardcoded list of Tauri event types
pub async fn list<R: Runtime>(_app: &AppHandle<R>, _params: &Value) -> Result<Value, String> {
    // Standard Tauri event types
    let events = vec![
        // Window events
        "tauri://focus",
        "tauri://blur",
        "tauri://resize",
        "tauri://move",
        "tauri://close-requested",
        "tauri://destroyed",
        "tauri://scale-change",
        "tauri://theme-changed",
        // Webview events
        "tauri://created",
        "tauri://error",
        // Menu events (if applicable)
        "tauri://menu",
        // File drop events
        "tauri://file-drop",
        "tauri://file-drop-hover",
        "tauri://file-drop-cancelled",
    ];

    Ok(json!({
        "events": events,
        "count": events.len()
    }))
}