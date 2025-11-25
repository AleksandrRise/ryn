use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use std::collections::HashMap;
use tokio::net::UnixStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{Mutex, oneshot};
use serde_json::Value;

use crate::error::{Result, TauriMCPError};
use crate::protocol::{JsonRpcRequest, JsonRpcResponse, JsonRpcMessage, MessageFramer};

/// Unix socket path for MCP communication
const SOCKET_PATH: &str = ".tauri/mcp.sock";

/// Max Unix socket path length (macOS limit)
const MAX_SOCKET_PATH_LEN: usize = 104;

/// Connection timeout (5 seconds)
const CONNECT_TIMEOUT_MS: u64 = 5000;

/// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS: u64 = 30000;

/// Max reconnect backoff (30 seconds)
const MAX_BACKOFF_MS: u64 = 30000;

/// Initial reconnect backoff (1 second)
const INITIAL_BACKOFF_MS: u64 = 1000;

/// Connection state and Unix socket manager
pub struct MCPConnection {
    /// Unix socket stream (wrapped in Mutex for async access)
    stream: Mutex<Option<UnixStream>>,

    /// Socket path (absolute)
    socket_path: PathBuf,

    /// Last activity timestamp (for staleness detection)
    last_activity: Mutex<SystemTime>,

    /// Pending requests (request_id -> response channel)
    pending_requests: Mutex<HashMap<String, oneshot::Sender<JsonRpcResponse>>>,

    /// Message buffer for partial reads
    read_buffer: Mutex<String>,
}

impl MCPConnection {
    /// Create new connection instance (doesn't connect yet)
    pub fn new() -> Result<Self> {
        let socket_path = Self::get_socket_path()?;

        Ok(Self {
            stream: Mutex::new(None),
            socket_path,
            last_activity: Mutex::new(SystemTime::now()),
            pending_requests: Mutex::new(HashMap::new()),
            read_buffer: Mutex::new(String::new()),
        })
    }

    /// Get absolute socket path (~/.tauri/mcp.sock)
    fn get_socket_path() -> Result<PathBuf> {
        let home = std::env::var("HOME")
            .map_err(|_| TauriMCPError::InvalidConfig("HOME env var not set".to_string()))?;

        let path = Path::new(&home).join(SOCKET_PATH);

        // Validate path length (Unix socket limitation on macOS)
        if path.as_os_str().len() >= MAX_SOCKET_PATH_LEN {
            return Err(TauriMCPError::InvalidConfig(format!(
                "Socket path too long: {} >= {}",
                path.as_os_str().len(),
                MAX_SOCKET_PATH_LEN
            )));
        }

        Ok(path)
    }

    /// Create socket directory with proper permissions (0o700)
    fn create_socket_dir(&self) -> Result<()> {
        if let Some(parent) = self.socket_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                TauriMCPError::PermissionDenied(format!("Failed to create dir: {}", e))
            })?;

            // Set directory permissions to 0o700 (owner rwx only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let perms = std::fs::Permissions::from_mode(0o700);
                std::fs::set_permissions(parent, perms).map_err(|e| {
                    TauriMCPError::PermissionDenied(format!("Failed to chmod dir: {}", e))
                })?;
            }
        }

        Ok(())
    }

    /// Check if socket exists and is stale (no process listening)
    pub async fn check_socket_stale(&self) -> Result<bool> {
        if !self.socket_path.exists() {
            return Ok(false);
        }

        // Try to connect with very short timeout (100ms)
        // If connection fails, socket is stale
        match tokio::time::timeout(
            Duration::from_millis(100),
            UnixStream::connect(&self.socket_path),
        )
        .await
        {
            Ok(Ok(_)) => Ok(false), // Connected successfully = not stale
            Ok(Err(_)) | Err(_) => {
                // Connection failed = stale socket, remove it
                std::fs::remove_file(&self.socket_path).ok();
                Ok(true)
            }
        }
    }

    /// Connect to Unix socket with timeout (5s)
    pub async fn connect(&self) -> Result<()> {
        // Check and remove stale socket first
        self.check_socket_stale().await?;

        // Create directory if needed
        self.create_socket_dir()?;

        // Connect with timeout
        let stream = tokio::time::timeout(
            Duration::from_millis(CONNECT_TIMEOUT_MS),
            UnixStream::connect(&self.socket_path),
        )
        .await
        .map_err(|_| TauriMCPError::Timeout("Connection timeout".to_string()))?
        .map_err(|e| TauriMCPError::ConnectionFailed(format!("Failed to connect: {}", e)))?;

        // Set socket permissions to 0o600 (owner rw only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(&self.socket_path, perms).map_err(|e| {
                TauriMCPError::PermissionDenied(format!("Failed to chmod socket: {}", e))
            })?;
        }

        // Store stream
        *self.stream.lock().await = Some(stream);
        *self.last_activity.lock().await = SystemTime::now();

        log::info!("Connected to MCP server at {:?}", self.socket_path);

        Ok(())
    }

    /// Connect with exponential backoff retry logic
    /// Backoff: 1s → 2s → 4s → 8s → 16s → 30s (max)
    pub async fn connect_with_retry(&self, max_attempts: u32) -> Result<()> {
        let mut backoff_ms = INITIAL_BACKOFF_MS;

        for attempt in 1..=max_attempts {
            match self.connect().await {
                Ok(_) => return Ok(()),
                Err(e) if e.is_retryable() && attempt < max_attempts => {
                    log::warn!(
                        "Connection attempt {}/{} failed: {}. Retrying in {}ms...",
                        attempt,
                        max_attempts,
                        e,
                        backoff_ms
                    );

                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;

                    // Exponential backoff with cap
                    backoff_ms = (backoff_ms * 2).min(MAX_BACKOFF_MS);
                }
                Err(e) => return Err(e),
            }
        }

        Err(TauriMCPError::ConnectionFailed(format!(
            "Failed after {} attempts",
            max_attempts
        )))
    }

    /// Send JSON-RPC request and wait for response (with correlation)
    pub async fn send_request(
        &self,
        method: String,
        params: Option<Value>,
    ) -> Result<JsonRpcResponse> {
        // Generate unique request ID
        let request_id = uuid::Uuid::new_v4().to_string();

        // Create request
        let request = JsonRpcRequest::new(method, params, Value::String(request_id.clone()));

        // Frame message
        let framed = MessageFramer::frame_message(&request)?;

        // Get stream lock
        let mut stream_guard = self.stream.lock().await;
        let stream = stream_guard
            .as_mut()
            .ok_or_else(|| TauriMCPError::Disconnected("Not connected".to_string()))?;

        // Send request
        stream
            .write_all(framed.as_bytes())
            .await
            .map_err(|e| TauriMCPError::Disconnected(format!("Write failed: {}", e)))?;

        *self.last_activity.lock().await = SystemTime::now();

        // Create response channel
        let (tx, rx) = oneshot::channel();
        self.pending_requests.lock().await.insert(request_id.clone(), tx);

        // Release stream lock before waiting
        drop(stream_guard);

        // Wait for response with timeout
        let response = tokio::time::timeout(Duration::from_millis(REQUEST_TIMEOUT_MS), rx)
            .await
            .map_err(|_| TauriMCPError::Timeout("Request timeout".to_string()))?
            .map_err(|_| TauriMCPError::InternalError("Response channel closed".to_string()))?;

        Ok(response)
    }

    /// Read and process incoming messages (call in background task)
    pub async fn process_messages(&self) -> Result<()> {
        loop {
            let mut stream_guard = self.stream.lock().await;
            let stream = stream_guard
                .as_mut()
                .ok_or_else(|| TauriMCPError::Disconnected("Not connected".to_string()))?;

            // Read from stream
            let mut buf = vec![0u8; 4096];
            let n = stream
                .read(&mut buf)
                .await
                .map_err(|e| TauriMCPError::Disconnected(format!("Read failed: {}", e)))?;

            if n == 0 {
                return Err(TauriMCPError::Disconnected("Connection closed".to_string()));
            }

            // Update activity timestamp
            *self.last_activity.lock().await = SystemTime::now();

            // Parse messages
            let data = String::from_utf8_lossy(&buf[..n]);
            let mut buffer = self.read_buffer.lock().await;
            buffer.push_str(&data);

            let (messages, remaining) = MessageFramer::parse_messages(&buffer);
            *buffer = remaining;

            // Release locks before processing
            drop(buffer);
            drop(stream_guard);

            // Process each message
            for msg_str in messages {
                match MessageFramer::parse_json_rpc(&msg_str) {
                    Ok(JsonRpcMessage::Response(response)) => {
                        // Match with pending request
                        if let Value::String(id) = &response.id {
                            if let Some(tx) = self.pending_requests.lock().await.remove(id) {
                                let _ = tx.send(response);
                            }
                        }
                    }
                    Ok(JsonRpcMessage::Notification(notif)) => {
                        log::debug!("Received notification: {:?}", notif);
                        // Handle notifications (events, etc.)
                    }
                    Ok(JsonRpcMessage::Request(_)) => {
                        log::warn!("Unexpected request from server (should only send responses)");
                    }
                    Err(e) => {
                        log::error!("Failed to parse message: {}", e);
                    }
                }
            }
        }
    }

    /// Disconnect from socket
    pub async fn disconnect(&self) -> Result<()> {
        // Cancel all pending requests
        let mut pending = self.pending_requests.lock().await;
        pending.clear();

        // Close stream
        *self.stream.lock().await = None;

        log::info!("Disconnected from MCP server");

        Ok(())
    }

    /// Check if currently connected
    pub async fn is_connected(&self) -> bool {
        self.stream.lock().await.is_some()
    }
}

// Add uuid dependency to Cargo.toml
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_socket_path_validation() {
        let conn = MCPConnection::new().unwrap();
        assert!(conn.socket_path.to_str().unwrap().contains(".tauri/mcp.sock"));
        assert!(conn.socket_path.to_str().unwrap().len() < MAX_SOCKET_PATH_LEN);
    }

    #[tokio::test]
    async fn test_connection_initially_disconnected() {
        let conn = MCPConnection::new().unwrap();
        assert!(!conn.is_connected().await);
    }

    #[tokio::test]
    async fn test_check_stale_socket_nonexistent() {
        let conn = MCPConnection::new().unwrap();
        // Should return false if socket doesn't exist
        let is_stale = conn.check_socket_stale().await.unwrap();
        assert!(!is_stale);
    }
}
