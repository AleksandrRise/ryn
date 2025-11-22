// Unix socket server for receiving MCP requests from TypeScript client
// Listens on ~/.tauri/mcp.sock and processes JSON-RPC 2.0 messages

use std::path::PathBuf;
use tokio::net::{UnixListener, UnixStream};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc;
use tauri::{AppHandle, Runtime, Manager};
use serde_json::Value;

use crate::state::MCPState;
use crate::error::{Result, TauriMCPError};
use crate::protocol::{
    JsonRpcRequest, JsonRpcResponse, JsonRpcError, JsonRpcMessage, MessageFramer
};

const SOCKET_PATH: &str = ".tauri/mcp.sock";

/// Start Unix socket server listening on ~/.tauri/mcp.sock
pub async fn start_socket_server<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    let socket_path = get_socket_path()?;

    // Create directory with proper permissions (0o700)
    create_socket_dir(&socket_path)?;

    // Remove stale socket if exists
    if socket_path.exists() {
        std::fs::remove_file(&socket_path)
            .map_err(|e| TauriMCPError::PermissionDenied(format!("Cannot remove stale socket: {}", e)))?;
    }

    // Bind Unix socket
    let listener = UnixListener::bind(&socket_path)
        .map_err(|e| TauriMCPError::ConnectionFailed(format!("Bind failed: {}", e)))?;

    // Set socket permissions to 0o600 (owner rw only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&socket_path, perms)
            .map_err(|e| TauriMCPError::PermissionDenied(format!("Cannot chmod socket: {}", e)))?;
    }

    log::info!("[MCP] Socket server listening at {:?}", socket_path);

    // Accept connections in loop
    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                log::info!("[MCP] New connection accepted");
                let app_handle = app.clone();

                // Spawn handler for this connection
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, app_handle).await {
                        log::error!("[MCP] Connection handler error: {}", e);
                    }
                });
            }
            Err(e) => {
                log::error!("[MCP] Accept error: {}", e);
            }
        }
    }
}

/// Handle a single client connection
async fn handle_connection<R: Runtime>(
    stream: UnixStream,
    app: AppHandle<R>,
) -> Result<()> {
    // Split stream for full duplex
    let (mut reader, mut writer) = stream.into_split();
    
    // Channel for sending responses from reader -> writer
    let (tx_response, mut rx_response) = mpsc::channel::<String>(32);
    
    // Subscribe to broadcast notifications
    let state = app.state::<MCPState>();
    let mut rx_notify = state.notification_sender.subscribe();
    
    // Spawn writer task
    tokio::spawn(async move {
        loop {
            tokio::select! {
                // Handle responses from request processing
                Some(response_str) = rx_response.recv() => {
                    if let Err(e) = writer.write_all(response_str.as_bytes()).await {
                        log::error!("[MCP] Writer error (response): {}", e);
                        break;
                    }
                }
                
                // Handle broadcast notifications
                Ok(notification) = rx_notify.recv() => {
                    // Frame the notification
                    match MessageFramer::frame_message(&notification) {
                        Ok(framed) => {
                            if let Err(e) = writer.write_all(framed.as_bytes()).await {
                                log::error!("[MCP] Writer error (notification): {}", e);
                                break;
                            }
                        }
                        Err(e) => {
                            log::error!("[MCP] Notification framing error: {}", e);
                        }
                    }
                }
                
                // Stop if channels closed
                else => break,
            }
        }
    });

    // Reader Loop
    let mut read_buffer = String::new();
    let mut buf = vec![0u8; 4096];

    loop {
        // Read from stream
        let n = reader.read(&mut buf).await
            .map_err(|e| TauriMCPError::Disconnected(format!("Read failed: {}", e)))?;

        if n == 0 {
            log::info!("[MCP] Connection closed by client");
            break;
        }

        // Parse messages
        let data = String::from_utf8_lossy(&buf[..n]);
        read_buffer.push_str(&data);

        let (messages, remaining) = MessageFramer::parse_messages(&read_buffer);
        read_buffer = remaining;

        // Process each message
        for msg_str in messages {
            match MessageFramer::parse_json_rpc(&msg_str) {
                Ok(JsonRpcMessage::Request(request)) => {
                    // Handle request
                    let response = handle_request(request, &app).await;
                    let framed = MessageFramer::frame_message(&response)?;

                    // Send to writer task
                    if let Err(_) = tx_response.send(framed).await {
                        // Writer task dead, stop reading
                        return Err(TauriMCPError::Disconnected("Writer task closed".to_string()));
                    }
                }
                Ok(JsonRpcMessage::Notification(notif)) => {
                    log::debug!("[MCP] Received notification: {:?}", notif);
                }
                Ok(JsonRpcMessage::Response(_)) => {
                    log::warn!("[MCP] Unexpected response from client (ignored)");
                }
                Err(e) => {
                    log::error!("[MCP] Failed to parse message: {}", e);
                }
            }
        }
    }

    Ok(())
}

/// Route request to appropriate handler
async fn handle_request<R: Runtime>(
    request: JsonRpcRequest,
    app: &AppHandle<R>,
) -> JsonRpcResponse {
    log::debug!("[MCP] Handling request: method={}", request.method);

    let params = request.params.as_ref().unwrap_or(&Value::Null);

    // Route to command handlers
    let result = match request.method.as_str() {
        // Window commands (6)
        "window_list" => crate::commands::window::list(app).await,
        "window_info" => crate::commands::window::info(app, params).await,
        "window_show" => crate::commands::window::show(app, params).await,
        "window_hide" => crate::commands::window::hide(app, params).await,
        "window_move" => crate::commands::window::move_window(app, params).await,
        "window_resize" => crate::commands::window::resize(app, params).await,

        // Webview/Navigation commands (4)
        "browser_navigate" => crate::commands::webview::navigate(app, params).await,
        "browser_state" => crate::commands::webview::state(app, params).await,
        "browser_execute" => crate::commands::webview::execute(app, params).await,
        "browser_tabs" => crate::commands::webview::tabs(app, params).await,

        // DevTools commands (2)
        "devtools_open" => crate::commands::devtools::open(app, params).await,
        "devtools_close" => crate::commands::devtools::close(app, params).await,

        // Screenshot command (1)
        "browser_screenshot" => crate::commands::screenshot::capture(app, params).await,

        // Script/Interaction commands (4)
        "browser_click" => crate::commands::script::click(app, params).await,
        "browser_type" => crate::commands::script::type_text(app, params).await,
        "browser_wait" => crate::commands::script::wait(app, params).await,
        "browser_snapshot" => crate::commands::script::snapshot(app, params).await,

        // Event commands (3)
        "events_subscribe" => crate::commands::events::subscribe(app, params).await,
        "events_unsubscribe" => crate::commands::events::unsubscribe(app, params).await,
        "events_list" => crate::commands::events::list(app, params).await,

        // Performance command (1)
        "performance_metrics" => crate::commands::performance::metrics(app, params).await,

        // Testing commands (2)
        "test_record" => crate::commands::testing::record(app, params).await,
        "test_replay" => crate::commands::testing::replay(app, params).await,

        // Legacy test commands
        "ping" => Ok(serde_json::json!({"status": "ok", "server": "tauri-mcp-bridge"})),
        "echo" => Ok(request.params.unwrap_or(Value::Null)),

        // Unknown method
        _ => Err(format!("Method not found: {}", request.method)),
    };

    // Convert result to JSON-RPC response
    match result {
        Ok(data) => JsonRpcResponse::success(data, request.id),
        Err(e) => JsonRpcResponse::error(
            JsonRpcError::internal_error(e),
            request.id
        ),
    }
}

/// Get absolute socket path (~/.tauri/mcp.sock)
fn get_socket_path() -> Result<PathBuf> {
    let home = std::env::var("HOME")
        .map_err(|_| TauriMCPError::InvalidConfig("HOME env var not set".to_string()))?;

    let path = std::path::Path::new(&home).join(SOCKET_PATH);

    // Validate path length (Unix socket limitation on macOS: 104 bytes)
    if path.as_os_str().len() >= 104 {
        return Err(TauriMCPError::InvalidConfig(format!(
            "Socket path too long: {} >= 104",
            path.as_os_str().len()
        )));
    }

    Ok(path)
}

/// Create socket directory with proper permissions (0o700)
fn create_socket_dir(socket_path: &PathBuf) -> Result<()> {
    if let Some(parent) = socket_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| TauriMCPError::PermissionDenied(format!("Failed to create dir: {}", e)))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o700);
            std::fs::set_permissions(parent, perms)
                .map_err(|e| TauriMCPError::PermissionDenied(format!("Failed to chmod dir: {}", e)))?;
        }
    }

    Ok(())
}
