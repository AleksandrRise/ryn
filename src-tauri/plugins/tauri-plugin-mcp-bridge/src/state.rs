// Plugin state management for MCP bridge
// Stores event subscriptions, JS callbacks, test recordings, etc.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde_json::Value;
use tauri::EventId;
use tokio::sync::{oneshot, broadcast};

/// Sender for JS callback results
pub type CallbackSender = oneshot::Sender<Value>;

/// Action recorded during test recording
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestAction {
    /// Action type: "click", "type", "navigate", etc.
    pub action_type: String,

    /// Action-specific data (selector, text, URL, etc.)
    pub data: Value,

    /// Timestamp when action occurred
    pub timestamp: u64,
}

/// Global state for MCP bridge plugin
/// Managed via app.manage() in lib.rs
#[derive(Clone)]
pub struct MCPState {
    /// Event subscriptions: event_type -> EventId
    /// Used to track which events we're listening to so we can unlisten
    pub event_subscriptions: Arc<Mutex<HashMap<String, EventId>>>,

    /// Pending JS callbacks: callback_id -> oneshot sender
    /// When we execute JS that needs to return data, we register a callback
    /// and await it via the oneshot channel
    pub js_callbacks: Arc<Mutex<HashMap<String, CallbackSender>>>,

    /// Test recordings: recording_id -> list of actions
    /// Stores recorded user interactions for test replay
    pub recordings: Arc<Mutex<HashMap<String, Vec<TestAction>>>>,

    /// Notification broadcaster
    /// Used to send events to all connected clients
    pub notification_sender: broadcast::Sender<Value>,
}

impl Default for MCPState {
    fn default() -> Self {
        let (tx, _rx) = broadcast::channel(100);
        Self {
            event_subscriptions: Arc::new(Mutex::new(HashMap::new())),
            js_callbacks: Arc::new(Mutex::new(HashMap::new())),
            recordings: Arc::new(Mutex::new(HashMap::new())),
            notification_sender: tx,
        }
    }
}

impl MCPState {
    /// Create new MCP state
    pub fn new() -> Self {
        Self::default()
    }
}
