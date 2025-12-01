//! LSP process management commands
//!
//! Handles spawning, stopping, and monitoring the LSP server process.
//! The LSP runs as a child process in TCP mode, allowing IDEs to connect.

use serde::Serialize;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

/// Default TCP port for LSP server
pub const DEFAULT_LSP_PORT: u16 = 9257;

/// LSP process state - managed globally by Tauri
///
/// This is registered with Tauri's state management and accessed
/// by all LSP commands via `tauri::State`.
#[derive(Default)]
pub struct LspProcessState {
    pub inner: Arc<Mutex<LspProcessInner>>,
}

/// Inner state (behind mutex)
#[derive(Default)]
pub struct LspProcessInner {
    /// The child process handle (None if not running)
    pub child: Option<Child>,
    /// Process ID (for display)
    pub pid: Option<u32>,
    /// When the process was started
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    /// TCP port the LSP is listening on
    pub port: Option<u16>,
}

/// Status returned to frontend
#[derive(Serialize, Clone, Default)]
pub struct LspStatus {
    /// Whether the LSP server is running
    pub running: bool,
    /// Process ID (if running)
    pub pid: Option<u32>,
    /// Seconds since started (if running)
    pub uptime_seconds: Option<i64>,
    /// ISO timestamp when started (if running)
    pub started_at: Option<String>,
    /// TCP port (if running)
    pub port: Option<u16>,
}

/// Start the LSP server as a child process
///
/// Spawns `ryn --lsp --tcp --port 9257` as a background process.
/// Returns error if already running.
#[tauri::command]
pub fn start_lsp_server(
    state: tauri::State<'_, LspProcessState>,
) -> Result<LspStatus, String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;

    // Check if already running
    if inner.child.is_some() {
        // Verify it's still alive
        if let Some(ref mut child) = inner.child {
            match child.try_wait() {
                Ok(Some(_)) => {
                    // Process exited, clean up
                    inner.child = None;
                    inner.pid = None;
                    inner.started_at = None;
                    inner.port = None;
                }
                Ok(None) => {
                    // Still running
                    return Err("LSP server is already running".to_string());
                }
                Err(e) => {
                    return Err(format!("Failed to check process status: {}", e));
                }
            }
        }
    }

    // Get current executable path
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    let port = DEFAULT_LSP_PORT;

    // Spawn child process: ryn --lsp --tcp --port 9257
    let child = Command::new(&exe_path)
        .args(["--lsp", "--tcp", "--port", &port.to_string()])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped()) // Capture stderr for debugging
        .spawn()
        .map_err(|e| format!("Failed to spawn LSP server: {}", e))?;

    let pid = child.id();
    let started_at = chrono::Utc::now();

    inner.child = Some(child);
    inner.pid = Some(pid);
    inner.started_at = Some(started_at);
    inner.port = Some(port);

    Ok(LspStatus {
        running: true,
        pid: Some(pid),
        uptime_seconds: Some(0),
        started_at: Some(started_at.to_rfc3339()),
        port: Some(port),
    })
}

/// Stop the LSP server
///
/// Kills the child process if running.
#[tauri::command]
pub fn stop_lsp_server(
    state: tauri::State<'_, LspProcessState>,
) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = inner.child.take() {
        child
            .kill()
            .map_err(|e| format!("Failed to kill LSP server: {}", e))?;
        // Wait to reap the zombie process
        let _ = child.wait();
    }

    inner.pid = None;
    inner.started_at = None;
    inner.port = None;

    Ok(())
}

/// Get current LSP server status
///
/// Checks if the process is still alive and returns status.
#[tauri::command]
pub fn get_lsp_status(
    state: tauri::State<'_, LspProcessState>,
) -> Result<LspStatus, String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;

    // Check if process is still alive
    if let Some(ref mut child) = inner.child {
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Process exited - clean up state
                inner.child = None;
                inner.pid = None;
                inner.started_at = None;
                inner.port = None;

                return Ok(LspStatus::default());
            }
            Ok(None) => {
                // Still running - calculate uptime
                let uptime = inner
                    .started_at
                    .map(|s| (chrono::Utc::now() - s).num_seconds())
                    .unwrap_or(0);

                return Ok(LspStatus {
                    running: true,
                    pid: inner.pid,
                    uptime_seconds: Some(uptime),
                    started_at: inner.started_at.map(|s| s.to_rfc3339()),
                    port: inner.port,
                });
            }
            Err(e) => {
                return Err(format!("Failed to check process status: {}", e));
            }
        }
    }

    // Not running
    Ok(LspStatus::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lsp_status_default() {
        let status = LspStatus::default();
        assert!(!status.running);
        assert!(status.pid.is_none());
        assert!(status.uptime_seconds.is_none());
        assert!(status.started_at.is_none());
        assert!(status.port.is_none());
    }

    #[test]
    fn test_lsp_process_state_default() {
        let state = LspProcessState::default();
        let inner = state.inner.lock().unwrap();
        assert!(inner.child.is_none());
        assert!(inner.pid.is_none());
    }
}
