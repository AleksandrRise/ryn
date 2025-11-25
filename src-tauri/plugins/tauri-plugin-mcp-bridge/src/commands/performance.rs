// Performance metrics command for MCP bridge
// Implements: performance_metrics
// Uses JavaScript Performance API via invoke callback

use tauri::{AppHandle, Runtime};
use serde_json::Value;
use crate::commands::script::execute_with_callback;

/// Get performance metrics from browser
/// Params: { label?: string }
pub async fn metrics<R: Runtime>(app: &AppHandle<R>, params: &Value) -> Result<Value, String> {
    let label = params.get("label").and_then(|v| v.as_str());

    // Execute JS to collect performance data
    let js = r#"
        (function() {
            const start = Date.now();
            const attempt = () => {
                try {
                    const tauri = window.__TAURI__;
                    const invoke = tauri?.core?.invoke || tauri?.invoke;

                    if (invoke) {
                        try {
                            const perf = window.performance;
                            const data = {
                                timing: perf.timing ? {
                                    navigationStart: perf.timing.navigationStart,
                                    loadEventEnd: perf.timing.loadEventEnd,
                                    domContentLoadedEventEnd: perf.timing.domContentLoadedEventEnd,
                                    responseEnd: perf.timing.responseEnd,
                                    domInteractive: perf.timing.domInteractive,
                                } : null,
                                memory: perf.memory ? {
                                    usedJSHeapSize: perf.memory.usedJSHeapSize,
                                    totalJSHeapSize: perf.memory.totalJSHeapSize,
                                    jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
                                } : null,
                                navigation: perf.navigation ? {
                                    type: perf.navigation.type,
                                    redirectCount: perf.navigation.redirectCount,
                                } : null,
                                timeOrigin: perf.timeOrigin,
                                now: perf.now(),
                            };

                            invoke('plugin:mcp-bridge|js_callback', {
                                id: '{CALLBACK_ID}',
                                data: data
                            });
                        } catch (e) {
                            invoke('plugin:mcp-bridge|js_callback', {
                                id: '{CALLBACK_ID}',
                                error: 'JS Error: ' + e.toString()
                            });
                        }
                        return;
                    }
                } catch (e) {
                    // Ignore errors during polling
                }

                if (Date.now() - start < 5000) {
                    setTimeout(attempt, 100);
                } else {
                    try {
                        const tauri = window.__TAURI__;
                        const invoke = tauri?.core?.invoke || tauri?.invoke;
                        if (invoke) {
                            invoke('plugin:mcp-bridge|js_callback', {
                                id: '{CALLBACK_ID}',
                                error: 'Tauri object not found after 5s'
                            });
                        } else {
                            document.title = "DEBUG: TAURI MISSING FOR PERF";
                        }
                    } catch(e) {}
                }
            };
            attempt();
        })();
    "#;

    execute_with_callback(app, label, js).await
}