// Tauri MCP Bridge - Model Context Protocol integration for Tauri
// Provides Unix socket-based communication between MCP servers and Tauri apps

pub mod error;
pub mod protocol;
pub mod connection;
pub mod state;
pub mod commands;
mod server;

// Re-export commonly used types
pub use error::{TauriMCPError, Result};
pub use protocol::{
    JsonRpcRequest, JsonRpcResponse, JsonRpcError, JsonRpcNotification,
    JsonRpcMessage, MessageFramer,
};
pub use connection::MCPConnection;

use tauri::{plugin::{Builder, TauriPlugin}, Manager, Runtime};

/// Initialize the MCP bridge plugin
/// This starts a Unix socket server at ~/.tauri/mcp.sock for MCP communication
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("mcp-bridge")
        .setup(|app, _api| {
            #[cfg(debug_assertions)]
            {
                // Only enable MCP bridge in debug builds for security
                println!("[MCP] Tauri MCP Bridge initializing...");

                // Initialize and manage plugin state
                app.manage(state::MCPState::new());

                // Clone app handle for background task
                let app_handle = app.clone();

                // Spawn socket server in background
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = server::start_socket_server(app_handle).await {
                        eprintln!("[MCP] Socket server failed: {}", e);
                    }
                });

                println!("[MCP] Socket server started");
            }

            #[cfg(not(debug_assertions))]
            {
                log::info!("[MCP] Bridge disabled in production builds");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::script::js_callback,
        ])
        .build()
}
