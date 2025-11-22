// DevTools commands for MCP bridge
// Implements: devtools_open, devtools_close
// Platform-specific: Only works on macOS 10.15+

use tauri::{AppHandle, Runtime};
use serde_json::Value;

#[cfg(any(debug_assertions, feature = "devtools"))]
use serde_json::json;

/// Open DevTools for a webview
/// Params: { label?: string }
/// Platform: macOS only (10.15+)
pub async fn open<R: Runtime>(_app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    #[cfg(any(debug_assertions, feature = "devtools"))]
    {
        #[cfg(target_os = "macos")]
        {
            let label = params.get("label").and_then(|v| v.as_str());

            // Get window
            let window = super::get_window(_app, label)?;

            // Open DevTools
            window.open_devtools();

            Ok(json!({"opened": true}))
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("DevTools not supported on this platform (macOS only)".to_string())
        }
    }

    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    {
        Err("DevTools not available in production builds (enable 'devtools' feature)".to_string())
    }
}

/// Close DevTools for a webview
/// Params: { label?: string }
/// Platform: macOS only (10.15+)
pub async fn close<R: Runtime>(_app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    #[cfg(any(debug_assertions, feature = "devtools"))]
    {
        #[cfg(target_os = "macos")]
        {
            let label = params.get("label").and_then(|v| v.as_str());

            // Get window
            let window = super::get_window(_app, label)?;

            // Close DevTools
            window.close_devtools();

            Ok(json!({"closed": true}))
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("DevTools not supported on this platform (macOS only)".to_string())
        }
    }

    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    {
        Err("DevTools not available in production builds (enable 'devtools' feature)".to_string())
    }
}
