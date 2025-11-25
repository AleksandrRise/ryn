// Window management commands for MCP bridge
// Implements: window_list, window_info, window_show, window_hide, window_move, window_resize

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Runtime, Size};
use serde_json::{json, Value};

/// List all webview windows
/// Returns array of window labels
pub async fn list<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    let windows = app.webview_windows();
    let labels: Vec<String> = windows.keys().cloned().collect();

    Ok(json!(labels))
}

/// Get detailed information about a specific window
/// Params: { label: string }
/// Returns: { label, position, size, is_visible, is_focused, is_minimized, is_maximized, is_fullscreen }
pub async fn info<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    // Parse params
    let label = params.get("label")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: label")?;

    // Get window by label
    let window = super::get_window(app, Some(label))?;

    // Get window properties
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get position: {}", e))?;
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get size: {}", e))?;
    let is_visible = window.is_visible()
        .map_err(|e| format!("Failed to get visibility: {}", e))?;
    let is_focused = window.is_focused()
        .map_err(|e| format!("Failed to get focus: {}", e))?;
    let is_minimized = window.is_minimized()
        .map_err(|e| format!("Failed to get minimized state: {}", e))?;
    let is_maximized = window.is_maximized()
        .map_err(|e| format!("Failed to get maximized state: {}", e))?;
    let is_fullscreen = window.is_fullscreen()
        .map_err(|e| format!("Failed to get fullscreen state: {}", e))?;

    Ok(json!({
        "label": label,
        "position": { "x": position.x, "y": position.y },
        "size": { "width": size.width, "height": size.height },
        "is_visible": is_visible,
        "is_focused": is_focused,
        "is_minimized": is_minimized,
        "is_maximized": is_maximized,
        "is_fullscreen": is_fullscreen,
        "title": window.title().unwrap_or_default()
    }))
}

/// Show a window
/// Params: { label: string }
pub async fn show<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: label")?;

    let window = super::get_window(app, Some(label))?;

    window.show()
        .map_err(|e| format!("Failed to show window: {}", e))?;

    Ok(json!({"shown": true}))
}

/// Hide a window
/// Params: { label: string }
pub async fn hide<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: label")?;

    let window = super::get_window(app, Some(label))?;

    window.hide()
        .map_err(|e| format!("Failed to hide window: {}", e))?;

    Ok(json!({"hidden": true}))
}

/// Move a window to a specific position
/// Params: { label: string, x: number, y: number }
pub async fn move_window<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: label")?;
    let x = params.get("x")
        .and_then(|v| v.as_i64())
        .ok_or("Missing required parameter: x")? as i32;
    let y = params.get("y")
        .and_then(|v| v.as_i64())
        .ok_or("Missing required parameter: y")? as i32;

    let window = super::get_window(app, Some(label))?;

    let position = Position::Physical(PhysicalPosition { x, y });
    window.set_position(position)
        .map_err(|e| format!("Failed to move window: {}", e))?;

    Ok(json!({"moved": true, "position": { "x": x, "y": y }}))
}

/// Resize a window
/// Params: { label: string, width: number, height: number }
pub async fn resize<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: label")?;
    let width = params.get("width")
        .and_then(|v| v.as_u64())
        .ok_or("Missing required parameter: width")? as u32;
    let height = params.get("height")
        .and_then(|v| v.as_u64())
        .ok_or("Missing required parameter: height")? as u32;

    let window = super::get_window(app, Some(label))?;

    let size = Size::Physical(PhysicalSize { width, height });
    window.set_size(size)
        .map_err(|e| format!("Failed to resize window: {}", e))?;

    Ok(json!({"resized": true, "size": { "width": width, "height": height }}))
}
