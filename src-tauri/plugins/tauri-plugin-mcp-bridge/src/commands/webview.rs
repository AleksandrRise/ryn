// WebView/browser navigation commands for MCP bridge
// Implements: browser_navigate, browser_state, browser_execute, browser_tabs

use tauri::{AppHandle, Emitter, Listener, Manager, Runtime, Url, WebviewWindowBuilder};
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

/// Navigate webview to URL
/// Params: { url: string, label?: string, wait_until?: string }
pub async fn navigate<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let url_str = params.get("url")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: url")?;
    let label = params.get("label")
        .and_then(|v| v.as_str());

    // Parse URL
    let url = Url::parse(url_str)
        .map_err(|e| format!("Invalid URL: {}", e))?;

    // Extract path from URL (for SPA routing)
    let path = url.path();
    if path.is_empty() {
        return Err("URL must contain a path".to_string());
    }

    // Create JavaScript to find and click the navigation link for this route.
    // This uses the same routing mechanism that manual clicks use (e.g. SPA links).
    // We POLL for the URL change instead of sending callback immediately,
    // because link.click() typically triggers async navigation.
    let js = format!(r#"
        (function() {{
            const targetPath = "{}";
            const selector = 'a[href="{}"]';
            const maxTauriWaitMs = 5000;

            const start = Date.now();

            const attempt = () => {{
                try {{
                    const tauri = window.__TAURI__;
                    const invoke = tauri?.core?.invoke || tauri?.invoke;

                    // Tauri not ready yet: retry for a bit, then fail with a callback
                    if (!invoke) {{
                        if (Date.now() - start < maxTauriWaitMs) {{
                            setTimeout(attempt, 100);
                            return;
                        }}
                        try {{
                            const tauriFinal = window.__TAURI__;
                            const invokeFinal = tauriFinal?.core?.invoke || tauriFinal?.invoke;
                            if (invokeFinal) {{
                                invokeFinal('plugin:mcp-bridge|js_callback', {{
                                    id: '{{CALLBACK_ID}}',
                                    error: 'Tauri object not available for navigation after ' + maxTauriWaitMs + 'ms'
                                }});
                            }}
                        }} catch (_) {{}}
                        return;
                    }}

                    const link = document.querySelector(selector);
                    if (!link) {{
                        invoke('plugin:mcp-bridge|js_callback', {{
                            id: '{{CALLBACK_ID}}',
                            error: 'Navigation link not found for selector: ' + selector
                        }});
                        return;
                    }}

                    // Start polling BEFORE clicking to catch the URL change
                    const startTime = Date.now();

                    const checkNavigation = () => {{
                        try {{
                            // Check if URL pathname matches target
                            if (window.location.pathname === targetPath) {{
                                invoke('plugin:mcp-bridge|js_callback', {{
                                    id: '{{CALLBACK_ID}}',
                                    data: {{ navigated: true }}
                                }});
                                return;
                            }}

                            // Check timeout (5 seconds)
                            if (Date.now() - startTime > 5000) {{
                                invoke('plugin:mcp-bridge|js_callback', {{
                                    id: '{{CALLBACK_ID}}',
                                    error: 'Navigation timeout: URL did not change to ' + targetPath + ', current: ' + window.location.pathname
                                }});
                                return;
                            }}

                            // Not yet changed, poll again
                            requestAnimationFrame(checkNavigation);
                        }} catch (e) {{
                            invoke('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                error: 'Navigation error: ' + e.toString()
                            }});
                        }}
                    }};

                    // Click the link (triggers SPA link handler with async navigation)
                    link.click();

                    // Start polling for URL change
                    requestAnimationFrame(checkNavigation);
                }} catch (e) {{
                    console.error('[MCP] Navigation error:', e);
                    try {{
                        const tauriInner = window.__TAURI__;
                        const invokeInner = tauriInner?.core?.invoke || tauriInner?.invoke;
                        if (invokeInner) {{
                            invokeInner('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                error: 'Navigation error: ' + e.toString()
                            }});
                        }}
                    }} catch (_) {{}}
                }}
            }};

            attempt();
        }})();
    "#, path, path);

    // Use callback mechanism to execute JavaScript and wait for completion
    use crate::commands::script::execute_with_callback;
    execute_with_callback(app, label, &js).await?;

    Ok(json!({"navigated": true, "url": url_str}))
}

/// Get current browser/webview state
/// Params: { label?: string }
/// Returns: { url, title, window_state }
pub async fn state<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label").and_then(|v| v.as_str());

    // Get window
    let window = super::get_window(app, label)?;
    let url = get_url_via_event(&window).await.unwrap_or_default();

    // Get window state
    let is_focused = window.is_focused().unwrap_or(false);
    let is_visible = window.is_visible().unwrap_or(false);
    let is_minimized = window.is_minimized().unwrap_or(false);

    Ok(json!({
        "url": url,
        "label": window.label(),
        "focused": is_focused,
        "visible": is_visible,
        "minimized": is_minimized
    }))
}

/// Execute JavaScript in webview (fire-and-forget)
/// Params: { code: string, label?: string }
pub async fn execute<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let code = params.get("code")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: code")?;

    // Emit event globally to execute JavaScript in page context (not init context)
    // Tauri 2.0: window.eval() executes in isolated context without DOM access
    // Using app.emit() instead of window.emit() to ensure event reaches all windows
    app.emit("mcp-execute-js", code)
        .map_err(|e| format!("Failed to emit execute event: {}", e))?;

    Ok(json!({"executed": true}))
}

/// Manage "tabs" (mapped to windows in Tauri)
/// Params: { action: "list"|"create"|"close"|"switch", index?: number, url?: string, label?: string }
pub async fn tabs<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let action = params.get("action")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: action")?;

    match action {
        "list" => {
            // List all windows (tabs)
            let windows = app.webview_windows();
            let mut tabs: Vec<Value> = Vec::new();

            for (index, (label, window)) in windows.iter().enumerate() {
                let url = get_url_via_event(window).await.unwrap_or_default();
                tabs.push(json!({
                    "index": index,
                    "label": label,
                    "url": url,
                    "focused": window.is_focused().unwrap_or(false)
                }));
            }

            Ok(json!(tabs))
        }
        "create" => {
            // Create new window (tab)
            let url = params.get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("about:blank");

            // Generate label (from param or auto-generate)
            let generated_label = format!("window-{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs());
            let label = params.get("label")
                .and_then(|v| v.as_str())
                .unwrap_or(&generated_label);

            // Parse URL
            let parsed_url = Url::parse(url)
                .map_err(|e| format!("Invalid URL: {}", e))?;

            // Create new window
            WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::External(parsed_url))
                .build()
                .map_err(|e| format!("Failed to create window: {}", e))?;

            Ok(json!({"created": true, "label": label}))
        }
        "close" => {
            // Close window by label
            let label = params.get("label")
                .and_then(|v| v.as_str())
                .ok_or("Missing required parameter: label")?;

            let window = super::get_window(app, Some(label))?;

            window.close()
                .map_err(|e| format!("Failed to close window: {}", e))?;

            Ok(json!({"closed": true, "label": label}))
        }
        "switch" => {
            // Switch focus to window by label or index
            let window = if let Some(label) = params.get("label").and_then(|v| v.as_str()) {
                super::get_window(app, Some(label))?
            } else if let Some(index) = params.get("index").and_then(|v| v.as_u64()) {
                let windows = app.webview_windows();
                windows
                    .values()
                    .nth(index as usize)
                    .cloned()
                    .ok_or(format!("Window index out of bounds: {}", index))?
            } else {
                return Err("Missing required parameter: label or index".to_string());
            };

            window.set_focus()
                .map_err(|e| format!("Failed to focus window: {}", e))?;

            // Verify focus succeeded
            let is_focused = window.is_focused()
                .map_err(|e| format!("Failed to verify focus: {}", e))?;

            if !is_focused {
                return Err("Failed to focus window: focus verification failed".to_string());
            }

            Ok(json!({"switched": true, "label": window.label(), "focused": is_focused}))
        }
        _ => Err(format!("Unknown action: {}", action))
    }
}

/// Request the current URL from the webview via frontend event to avoid wry::WebView::url panics.
async fn get_url_via_event<R: Runtime>(window: &tauri::WebviewWindow<R>) -> Option<String> {
    let request_id = format!(
        "req-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_millis()
    );

    let (tx, rx) = oneshot::channel::<Option<String>>();
    let app = window.app_handle();

    let sender = Arc::new(Mutex::new(Some(tx)));
    let sender_for_listener = Arc::clone(&sender);
    let request_id_for_listener = request_id.clone();

    let listener_id = app.listen_any("mcp-url-response", move |event| {
        eprintln!("[MCP] received mcp-url-response event: {:?}", event.payload());
        let parsed: Value = serde_json::from_str(event.payload()).unwrap_or(Value::Null);
        let payload = match parsed.as_object() {
            Some(obj) => obj,
            None => return,
        };

        let id_matches = payload
            .get("requestId")
            .and_then(|v| v.as_str())
            .map(|id| id == request_id_for_listener)
            .unwrap_or(false);

        if !id_matches {
            return;
        }

        let href = payload
            .get("href")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        if let Ok(mut guard) = sender_for_listener.lock() {
            if let Some(sender) = guard.take() {
                let _ = sender.send(href);
            }
        }
    });

    if let Err(e) = window.emit("mcp-get-url", json!({ "requestId": request_id })) {
        eprintln!("[MCP] Failed to emit mcp-get-url: {}", e);
        let _ = app.unlisten(listener_id);
        return None;
    }

    let result = timeout(Duration::from_millis(2500), rx)
        .await
        .ok()
        .and_then(|r| r.ok().flatten());
    if result.is_none() {
        eprintln!("[MCP] mcp-url-response timed out for request {}", request_id);
    }
    let _ = app.unlisten(listener_id);
    result
}
