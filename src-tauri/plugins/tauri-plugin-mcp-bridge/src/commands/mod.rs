// MCP command implementations
// Each module implements a group of related MCP tools

pub mod window;
pub mod webview;
pub mod devtools;
pub mod screenshot;
pub mod script;
pub mod events;
pub mod performance;
pub mod testing;

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

/// Helper function to get a window by label or return the first available window
pub fn get_window<R: Runtime>(
    app: &AppHandle<R>,
    label: Option<&str>,
) -> Result<WebviewWindow<R>, String> {
    let windows = app.webview_windows();

    if let Some(label) = label {
        windows
            .get(label)
            .cloned()
            .ok_or(format!("Window not found: {}", label))
    } else {
        windows
            .values()
            .next()
            .cloned()
            .ok_or("No windows available".to_string())
    }
}
