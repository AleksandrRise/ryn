// Eval command for MCP bridge: run arbitrary JS in webview and return result via callback

use tauri::{AppHandle, Runtime};
use serde_json::Value;

use crate::commands::script::execute_with_callback;

/// Execute provided JavaScript in the target webview and return its resolved value.
/// Params: { code: string, label?: string }
/// The code can be async; the resolved value (or error) is returned via MCP response.
pub async fn eval<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let code = params.get("code")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: code")?;
    let label = params.get("label").and_then(|v| v.as_str());

    // Wrap user code so we can capture result and errors consistently
    let js = format!(r#"
        (async () => {{
            try {{
                const result = await (async () => {{ {} }})();
                const invoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
                if (!invoke) throw new Error('TAURI invoke not available');
                invoke('plugin:mcp-bridge|js_callback', {{
                    id: '{{CALLBACK_ID}}',
                    data: result
                }});
            }} catch (e) {{
                try {{
                    const invoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
                    if (invoke) {{
                        invoke('plugin:mcp-bridge|js_callback', {{
                            id: '{{CALLBACK_ID}}',
                            error: String(e?.message || e)
                        }});
                        return;
                    }}
                }} catch(_) {{}}
            }}
        }})();
    "#, code);

    // This returns the data (or error) supplied by the injected JS via js_callback
    execute_with_callback(app, label, &js).await
}
