use tauri::{AppHandle, Runtime};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use image::ImageFormat;
use screenshots::Screen;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::time::Duration;

/// Capture a screenshot of the specified window
/// Params: { label?: string, path?: string }
///
/// This implementation uses the window's physical outer position and size
/// directly, and captures exactly that rectangle from the screen that contains
/// the window center. No DPI/scale conversion is applied; everything stays in
/// the same physical coordinate space to avoid capturing the wrong region or
/// an entire desktop.
pub async fn capture<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label").and_then(|v| v.as_str());
    let custom_path = params.get("path").and_then(|v| v.as_str());

    let window = super::get_window(app, label)?;

    // Bring window to front to reduce capture of overlapping apps
    let _ = window.set_focus();
    let _ = window.set_always_on_top(true);
    // Give the window a brief moment to rise above others
    tauri::async_runtime::sleep(Duration::from_millis(150)).await;

    // Prefer capturing just the inner webview (content) region so tests
    // see exactly the app UI rather than the entire OS chrome.
    let scale = window
        .scale_factor()
        .map_err(|e| format!("Failed to get scale factor: {}", e))?;

    // Use outer position/size (includes title bar) then convert to physical
    let pos = window
        .outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?
        .to_physical::<i32>(scale);
    let size = window
        .outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;

    if size.width == 0 || size.height == 0 {
        return Err("Window has zero width or height".to_string());
    }

    // Determine which screen the window is on based on its center point.
    let center_x = pos.x + (size.width as i32 / 2);
    let center_y = pos.y + (size.height as i32 / 2);

    let screen = Screen::from_point(center_x, center_y)
        .map_err(|e| format!("Window is not visible on any screen: {}", e))?;

    let display = screen.display_info;

    // Coordinates of the window relative to the top-left of the screen, all in
    // physical pixels.
    let rel_x = pos.x - display.x;
    let rel_y = pos.y - display.y;

    // Capture the exact outer window rectangle in physical pixels.
    let image = screen
        .capture_area(rel_x, rel_y, size.width, size.height)
        .map_err(|e| format!("Screenshot capture failed: {}", e))?;

    // Convert to PNG buffer using image crate
    let buffer = {
        let mut buf = Vec::new();
        let dyn_img = image::DynamicImage::ImageRgba8(image);
        dyn_img
            .write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Png)
            .map_err(|e| format!("Failed to encode PNG: {}", e))?;
        buf
    };

    // Always return base64 so MCP clients (like Codex) can embed the
    // screenshot directly without having to read files from disk.
    let base64_data = STANDARD.encode(&buffer);

    // Optionally save to disk if the caller provided an explicit path.
    let file_path = if let Some(p) = custom_path {
        let path = PathBuf::from(p);
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, &buffer).map_err(|e| format!("Failed to save file: {}", e))?;
        Some(path)
    } else {
        None
    };

    // Restore always_on_top to avoid side effects
    let _ = window.set_always_on_top(false);

    Ok(json!({
        "data": base64_data,
        "path": file_path.map(|p| p.to_string_lossy().into_owned()),
        "width": size.width,
        "height": size.height
    }))
}
