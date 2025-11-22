use tauri::{AppHandle, Runtime};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use image::ImageFormat;
use screenshots::Screen;
use base64::{engine::general_purpose::STANDARD, Engine as _};
#[cfg(target_os = "macos")]
use core_graphics::{
    geometry::{CGPoint, CGSize, CGRect},
    window::{create_image, kCGWindowImageBoundsIgnoreFraming, kCGWindowImageNominalResolution, kCGWindowListOptionIncludingWindow},
};
#[cfg(target_os = "macos")]
use objc2_app_kit::NSWindow;

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

    log::info!("[MCP] screenshot requested label={:?} path={:?}", label, custom_path);

    let window = super::get_window(app, label)?;

    // Try macOS window-based capture first (captures even if overlapped)
    #[cfg(target_os = "macos")]
    if let Ok(img) = capture_macos_window(&window) {
        return Ok(img);
    }

    // Prefer capturing just the inner webview (content) region so tests
    // see exactly the app UI rather than the entire OS chrome.
    // Use outer position/size (includes title bar) in physical coords
    let pos = window
        .outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
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

    Ok(json!({
        "data": base64_data,
        "path": file_path.map(|p| p.to_string_lossy().into_owned()),
        "width": size.width,
        "height": size.height
    }))
}

#[cfg(target_os = "macos")]
fn capture_macos_window<R: Runtime>(window: &tauri::WebviewWindow<R>) -> Result<Value, String> {
    let ns_win_ptr = window.ns_window().map_err(|e| format!("Failed to get ns_window: {}", e))?;
    let ns_win: &NSWindow = unsafe { (ns_win_ptr as *mut NSWindow).as_ref() }
        .ok_or("ns_window pointer null")?;

    let window_id = ns_win.windowNumber() as u32;
    log::info!("[MCP] macOS window capture for id={}", window_id);

    // Compute window rect in physical coords
    let scale = window.scale_factor().map_err(|e| format!("Failed to get scale factor: {}", e))?;
    let pos = window.outer_position().map_err(|e| format!("Failed to get window position: {}", e))?;
    let size = window.outer_size().map_err(|e| format!("Failed to get window size: {}", e))?;
    let rect = CGRect::new(
        &CGPoint::new(pos.x as f64 * scale, pos.y as f64 * scale),
        &CGSize::new(size.width as f64 * scale, size.height as f64 * scale),
    );

    // Capture just this window (CG will render only the specified window id)
    let cg_image = create_image(
        rect,
        kCGWindowListOptionIncludingWindow,
        window_id,
        kCGWindowImageBoundsIgnoreFraming | kCGWindowImageNominalResolution,
    )
    .ok_or("CGWindowListCreateImage failed")?;

    let width = cg_image.width() as u32;
    let height = cg_image.height() as u32;
    let data = cg_image.data().to_vec();
    let _bytes_per_row = cg_image.bytes_per_row();

    // Convert BGRA to RGBA
    let mut rgba = Vec::with_capacity((width * height * 4) as usize);
    for chunk in data.chunks_exact(4) {
        rgba.push(chunk[2]); // R
        rgba.push(chunk[1]); // G
        rgba.push(chunk[0]); // B
        rgba.push(chunk[3]); // A
    }

    let buffer = {
        let mut buf = Vec::new();
        let img = image::RgbaImage::from_raw(width, height, rgba)
            .ok_or("Failed to build RGBA image from CGImage data")?;
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Png)
            .map_err(|e| format!("Failed to encode PNG: {}", e))?;
        buf
    };

    let base64_data = STANDARD.encode(&buffer);
    log::info!("[MCP] macOS window capture success: {}x{}, {} bytes", width, height, buffer.len());

    Ok(json!({
        "data": base64_data,
        "path": null,
        "width": width,
        "height": height
    }))
}
