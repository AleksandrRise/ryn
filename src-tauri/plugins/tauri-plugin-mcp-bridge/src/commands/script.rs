// Script interaction commands for MCP bridge
// Implements: browser_click, browser_type, browser_wait, browser_snapshot
// Uses JavaScript injection + invoke callback pattern

use tauri::{AppHandle, Manager, Runtime, State};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::oneshot;

use crate::state::MCPState;
use crate::commands::get_window;

/// Helper to execute JS and await callback result
pub async fn execute_with_callback<R: Runtime>(
    app: &AppHandle<R>,
    label: Option<&str>,
    js_template: &str,
) -> Result<Value, String> {
    // Generate callback ID
    let callback_id = uuid::Uuid::new_v4().to_string();

    // Create oneshot channel
    let (tx, rx) = oneshot::channel();

    // Store callback in state
    app.state::<MCPState>()
        .js_callbacks
        .lock()
        .map_err(|e| format!("State lock poisoned: {}", e))? 
        .insert(callback_id.clone(), tx);

    // Format JS with callback ID
    let js = js_template.replace("{CALLBACK_ID}", &callback_id);

    // Execute JavaScript directly in the target webview window.
    // The JS is responsible for calling `plugin:mcp-bridge|js_callback`
    // via the Tauri `invoke` API with the same callback ID.
    let window = get_window(app, label)
        .map_err(|e| format!("Failed to get window for JS execution: {}", e))?;

    window
        .eval(&js)
        .map_err(|e| format!("Failed to eval JavaScript in webview: {}", e))?;

    // Await callback with timeout
    tokio::time::timeout(Duration::from_secs(30), rx)
        .await
        .map_err(|_| "JavaScript callback timeout".to_string())? 
        .map_err(|_| "JavaScript callback cancelled".to_string())
}

/// Click an element
/// Params: { element: string (selector), button?: string, modifiers?: array, label?: string }
pub async fn click<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let selector = params.get("element")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: element")?;
    let label = params.get("label").and_then(|v| v.as_str());

    // Escape selector for JS
    let escaped_selector = selector.replace('\\', "\\\\").replace('"', "\\\"");

    let js = format!(r#"
        (function() {{
            const start = Date.now();
            const attempt = () => {{
                try {{
                    const tauri = window.__TAURI__;
                    const invoke = tauri?.core?.invoke || tauri?.invoke;

                    if (invoke) {{
                        try {{
                            const element = document.querySelector("{}");
                            if (!element) {{
                                invoke('plugin:mcp-bridge|js_callback', {{
                                    id: '{{CALLBACK_ID}}',
                                    error: 'Element not found: {}'
                                }});
                                return;
                            }}

                            // Capture element state BEFORE click
                            const beforeState = {{
                                checked: element.checked,
                                value: element.value,
                                disabled: element.disabled,
                                tagName: element.tagName,
                                type: element.type || null,
                                id: element.id || null,
                                className: element.className || null
                            }};

                            // Click the element
                            element.click();

                            // Capture state AFTER click with requestAnimationFrame
                            requestAnimationFrame(() => {{
                                const afterState = {{
                                    checked: element.checked,
                                    value: element.value,
                                    disabled: element.disabled,
                                    tagName: element.tagName,
                                    type: element.type || null
                                }};

                                // Return detailed response
                                invoke('plugin:mcp-bridge|js_callback', {{
                                    id: '{{CALLBACK_ID}}',
                                    data: {{
                                        clicked: true,
                                        element: {{
                                            selector: "{}",
                                            matched: true,
                                            tagName: element.tagName,
                                            type: element.type || null,
                                            id: element.id || null,
                                            className: element.className || null
                                        }},
                                        state: {{
                                            checked: afterState.checked,
                                            previouslyChecked: beforeState.checked,
                                            stateChanged: beforeState.checked !== afterState.checked || beforeState.value !== afterState.value,
                                            value: afterState.value,
                                            disabled: afterState.disabled
                                        }}
                                    }}
                                }});
                            }});
                        }} catch (e) {{
                            invoke('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                error: 'JS Error: ' + e.toString()
                            }});
                        }}
                        return;
                    }}
                }} catch (e) {{
                    // Ignore errors during polling
                }}

                if (Date.now() - start < 5000) {{
                    setTimeout(attempt, 100);
                }} else {{
                    try {{
                        const tauri = window.__TAURI__;
                        const invoke = tauri?.core?.invoke || tauri?.invoke;
                        if (invoke) {{
                            invoke('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                error: 'Tauri object not found after 5s'
                            }});
                        }} else {{
                            document.title = "DEBUG: TAURI MISSING FOR CLICK";
                        }}
                    }} catch(e) {{}}
                }}
            }};
            attempt();
        }})();
    "#, escaped_selector, escaped_selector, escaped_selector);

    execute_with_callback(app, label, &js).await
}

/// Type text into an element
/// Params: { text: string, submit?: bool, clear?: bool, label?: string }
pub async fn type_text<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let text = params.get("text")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: text")?;
    let clear = params.get("clear").and_then(|v| v.as_bool()).unwrap_or(false);
    let submit = params.get("submit").and_then(|v| v.as_bool()).unwrap_or(false);
    let label = params.get("label").and_then(|v| v.as_str());

    // Escape text for JS
    let escaped_text = text.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n");

    let js = format!(r#"
        (function() {{
            const start = Date.now();
            const attempt = () => {{
                try {{
                    const tauri = window.__TAURI__;
                    const invoke = tauri?.core?.invoke || tauri?.invoke;

                    if (invoke) {{
                        try {{
                            const element = document.activeElement;
                            if (!element) {{
                                invoke('plugin:mcp-bridge|js_callback', {{
                                    id: '{{CALLBACK_ID}}',
                                    error: 'No active element'
                                }});
                                return;
                            }}
                            if ({}) {{
                                element.value = '';
                            }}
                            element.value += "{}";
                            element.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            if ({}) {{
                                const form = element.closest('form');
                                if (form) form.submit();
                            }}
                            invoke('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                data: {{ typed: true }}
                            }});
                        }} catch (e) {{
                            invoke('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                error: 'JS Error: ' + e.toString()
                            }});
                        }}
                        return;
                    }}
                }} catch (e) {{
                    // Ignore errors during polling
                }}

                if (Date.now() - start < 5000) {{
                    setTimeout(attempt, 100);
                }} else {{
                    try {{
                        const tauri = window.__TAURI__;
                        const invoke = tauri?.core?.invoke || tauri?.invoke;
                        if (invoke) {{
                            invoke('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                error: 'Tauri object not found after 5s'
                            }});
                        }} else {{
                            document.title = "DEBUG: TAURI MISSING FOR TYPE";
                        }}
                    }} catch(e) {{}}
                }}
            }};
            attempt();
        }})();
    "#, clear, escaped_text, submit);

    execute_with_callback(app, label, &js).await
}

/// Wait for a condition
/// Params: { condition: string, value?: string, timeout?: number, label?: string }
pub async fn wait<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let condition = params.get("condition")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: condition")?;
    let value = params.get("value").and_then(|v| v.as_str()).unwrap_or("");
    let timeout = params.get("timeout").and_then(|v| v.as_u64()).unwrap_or(30000);
    let label = params.get("label").and_then(|v| v.as_str());

    // Escape value for JS
    let escaped_value = value.replace('\\', "\\\\").replace('"', "\\\"");

    // Build condition check JS based on condition type
    let condition_js = match condition {
        "selector" => format!(r#"document.querySelector("{}")"#,
            escaped_value
        ),
        "url" => format!(r#"window.location.href.includes("{}")"#,
            escaped_value
        ),
        "title" => format!(r#"document.title.includes("{}")"#,
            escaped_value
        ),
        _ => return Err(format!("Unknown condition type: {}", condition)),
    };

    let js = format!(r#"
        (function() {{
            const start = Date.now();
            const attempt = () => {{
                try {{
                    const tauri = window.__TAURI__;
                    const invoke = tauri?.core?.invoke || tauri?.invoke;

                    if (invoke) {{
                        const startTime = Date.now();
                        const check = () => {{
                            try {{
                                if ({}) {{
                                    invoke('plugin:mcp-bridge|js_callback', {{
                                        id: '{{CALLBACK_ID}}',
                                        data: {{ waited: true, condition: '{}' }}
                                    }});
                                }} else if (Date.now() - startTime > {}) {{
                                    invoke('plugin:mcp-bridge|js_callback', {{
                                        id: '{{CALLBACK_ID}}',
                                        error: 'Wait timeout: condition not met'
                                    }});
                                }} else {{
                                    setTimeout(check, 100);
                                }}
                            }} catch (e) {{
                                invoke('plugin:mcp-bridge|js_callback', {{
                                    id: '{{CALLBACK_ID}}',
                                    error: 'JS Error: ' + e.toString()
                                }});
                            }}
                        }};
                        check();
                        return;
                    }}
                }} catch (e) {{
                    // Ignore errors during polling
                }}

                if (Date.now() - start < 5000) {{
                    setTimeout(attempt, 100);
                }} else {{
                    try {{
                        const tauri = window.__TAURI__;
                        const invoke = tauri?.core?.invoke || tauri?.invoke;
                        if (invoke) {{
                            invoke('plugin:mcp-bridge|js_callback', {{
                                id: '{{CALLBACK_ID}}',
                                error: 'Tauri object not found after 5s'
                            }});
                        }} else {{
                            document.title = "DEBUG: TAURI MISSING FOR WAIT";
                        }}
                    }} catch(e) {{}}
                }}
            }};
            attempt();
        }})();
    "#, condition_js, condition, timeout);

    execute_with_callback(app, label, &js).await
}

/// Get DOM snapshot
/// Params: { includeText?: bool, maxDepth?: number, label?: string }
pub async fn snapshot<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label").and_then(|v| v.as_str());

    let js = r#"
        (function() {
            const start = Date.now();
            const attempt = () => {
                try {
                    const tauri = window.__TAURI__;
                    // Check both v2 (core.invoke) and v1/compat (invoke)
                    const invoke = tauri?.core?.invoke || tauri?.invoke;

                    if (invoke) {
                        invoke('plugin:mcp-bridge|js_callback', {
                            id: '{CALLBACK_ID}',
                            data: {
                                html: document.documentElement.outerHTML,
                                url: window.location.href,
                                title: document.title
                            }
                        });
                        return;
                    }
                } catch (e) {
                    // Ignore errors during polling
                }
                
                if (Date.now() - start < 5000) {
                    setTimeout(attempt, 100);
                } else {
                   // Timeout - try to report error one last time
                   try {
                        const tauri = window.__TAURI__;
                        const invoke = tauri?.core?.invoke || tauri?.invoke;
                        if (invoke) {
                            invoke('plugin:mcp-bridge|js_callback', {
                                id: '{CALLBACK_ID}',
                                error: 'Tauri object not found after 5s'
                            });
                        } else {
                            document.title = "DEBUG: TAURI MISSING AFTER 5s";
                        }
                   } catch(e) {}
                }
            };
            attempt();
        })();
    "#;

    execute_with_callback(app, label, js).await
}

/// Tauri command to receive JS callbacks
/// This needs to be registered in the main app
#[tauri::command]
pub fn js_callback(
    state: State<MCPState>,
    id: String,
    data: Option<Value>,
    error: Option<String>,
) -> Result<(), String> {
    // Get callback sender from state
    let sender = state.js_callbacks.lock() 
        .map_err(|e| format!("State lock poisoned: {}", e))? 
        .remove(&id);

    if let Some(tx) = sender {
        let result = if let Some(err) = error {
            Err(err)
        } else {
            Ok(data.unwrap_or(Value::Null))
        };

        // Send result (ignore if receiver dropped)
        let _ = match result {
            Ok(val) => tx.send(val),
            Err(e) => tx.send(json!({"error": e})),
        };
    }

    Ok(())
}
