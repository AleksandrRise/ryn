//! File watching module
//!
//! Monitors project files for changes in real-time using the notify crate.

use anyhow::{anyhow, Result};
use notify::{RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::task::JoinHandle;

/// File event types emitted by the watcher
#[derive(Debug, Clone)]
pub enum FileEvent {
    /// File was modified
    FileModified { path: PathBuf },
    /// File was created
    FileCreated { path: PathBuf },
    /// File was deleted
    FileDeleted { path: PathBuf },
}

/// Handle to manage the file watcher lifecycle
pub struct WatcherHandle {
    rx: async_channel::Receiver<FileEvent>,
    #[allow(dead_code)]
    watcher_handle: JoinHandle<()>,
}

impl WatcherHandle {
    /// Receive the next file event
    pub async fn recv(&self) -> Option<FileEvent> {
        self.rx.recv().await.ok()
    }
}

/// File system watcher with ignore patterns and extension filtering
pub struct FileWatcher {
    ignore_patterns: Vec<String>,
    extensions: Vec<String>,
}

impl FileWatcher {
    /// Create a new FileWatcher with default settings
    pub fn new() -> Self {
        Self::default()
    }

    /// Set custom ignore patterns
    pub fn with_ignore(mut self, patterns: Vec<String>) -> Self {
        self.ignore_patterns = patterns;
        self
    }

    /// Set file extensions to watch
    pub fn with_extensions(mut self, extensions: Vec<String>) -> Self {
        self.extensions = extensions;
        self
    }

    /// Start watching a directory for file changes
    ///
    /// # Arguments
    /// * `path` - Directory path to watch
    ///
    /// # Returns
    /// * `Ok(WatcherHandle)` containing a channel receiver for events
    /// * `Err(...)` if watcher setup fails
    pub async fn watch_directory(self, path: &Path) -> Result<WatcherHandle> {
        if !path.exists() {
            return Err(anyhow!("Watch path does not exist: {:?}", path));
        }

        let path_buf = path.to_path_buf();
        let ignore_patterns = self.ignore_patterns.clone();
        let extensions = self.extensions.clone();

        let (tx, rx) = async_channel::unbounded::<FileEvent>();

        // Spawn blocking task for file watching
        let watcher_handle = tokio::task::spawn_blocking(move || {
            let ignore_patterns = Arc::new(ignore_patterns);
            let extensions = Arc::new(extensions);

            let tx_clone = tx.clone();
            let ignore_patterns_clone = ignore_patterns.clone();
            let extensions_clone = extensions.clone();

            let result = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                match res {
                    Ok(event) => {
                        use notify::EventKind;
                        match event.kind {
                            EventKind::Modify(_) => {
                                for path in &event.paths {
                                    if Self::should_watch_path(
                                        path,
                                        &ignore_patterns_clone,
                                        &extensions_clone,
                                    ) {
                                        let _ =
                                            tx_clone.send_blocking(FileEvent::FileModified {
                                                path: path.clone(),
                                            });
                                    }
                                }
                            }
                            EventKind::Create(_) => {
                                for path in &event.paths {
                                    if Self::should_watch_path(
                                        path,
                                        &ignore_patterns_clone,
                                        &extensions_clone,
                                    ) {
                                        let _ = tx_clone.send_blocking(FileEvent::FileCreated {
                                            path: path.clone(),
                                        });
                                    }
                                }
                            }
                            EventKind::Remove(_) => {
                                for path in &event.paths {
                                    if Self::should_watch_path(
                                        path,
                                        &ignore_patterns_clone,
                                        &extensions_clone,
                                    ) {
                                        let _ = tx_clone.send_blocking(FileEvent::FileDeleted {
                                            path: path.clone(),
                                        });
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    Err(e) => eprintln!("Watch error: {}", e),
                }
            });

            match result {
                Ok(mut watcher) => {
                    if let Err(e) = watcher.watch(&path_buf, RecursiveMode::Recursive) {
                        eprintln!("Failed to watch directory: {}", e);
                        return;
                    }

                    // Keep watcher alive
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(1));
                    }
                }
                Err(e) => {
                    eprintln!("Failed to create watcher: {}", e);
                }
            }
        });

        Ok(WatcherHandle { rx, watcher_handle })
    }

    fn should_watch_path(
        path: &Path,
        ignore_patterns: &[String],
        extensions: &[String],
    ) -> bool {
        let path_str = path.to_string_lossy();

        // Check if in ignore list
        for pattern in ignore_patterns {
            if path_str.contains(pattern) {
                return false;
            }
        }

        // Check extension
        if let Some(ext) = path.extension() {
            if let Some(ext_str) = ext.to_str() {
                return extensions.contains(&ext_str.to_string());
            }
        }

        false
    }
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self {
            ignore_patterns: vec![
                ".git".to_string(),
                "__pycache__".to_string(),
                "node_modules".to_string(),
                ".pytest_cache".to_string(),
                ".venv".to_string(),
                "target".to_string(),
            ],
            extensions: vec![
                "py".to_string(),
                "js".to_string(),
                "jsx".to_string(),
                "ts".to_string(),
                "tsx".to_string(),
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_temp_project() -> tempfile::TempDir {
        tempfile::tempdir().expect("Failed to create temp dir")
    }

    #[test]
    fn test_file_watcher_default() {
        let watcher = FileWatcher::default();
        assert_eq!(watcher.ignore_patterns.len(), 6);
        assert_eq!(watcher.extensions.len(), 5);
        assert!(watcher.ignore_patterns.contains(&".git".to_string()));
        assert!(watcher.extensions.contains(&"py".to_string()));
    }

    #[test]
    fn test_should_watch_path_basic() {
        let patterns = vec![".git".to_string(), "node_modules".to_string()];
        let extensions = vec!["py".to_string(), "js".to_string()];

        assert!(FileWatcher::should_watch_path(Path::new("app.py"), &patterns, &extensions));
        assert!(!FileWatcher::should_watch_path(Path::new("app.txt"), &patterns, &extensions));
    }

    #[test]
    fn test_should_ignore_patterns() {
        let patterns = vec![".git".to_string(), "node_modules".to_string()];
        let extensions = vec!["py".to_string()];

        assert!(!FileWatcher::should_watch_path(
            Path::new(".git/config.py"),
            &patterns,
            &extensions
        ));
        assert!(!FileWatcher::should_watch_path(
            Path::new("node_modules/lib.py"),
            &patterns,
            &extensions
        ));
    }

    #[test]
    fn test_extension_filtering() {
        let patterns = vec![];
        let extensions = vec!["py".to_string()];

        assert!(FileWatcher::should_watch_path(Path::new("test.py"), &patterns, &extensions));
        assert!(!FileWatcher::should_watch_path(
            Path::new("test.js"),
            &patterns,
            &extensions
        ));
        assert!(!FileWatcher::should_watch_path(
            Path::new("test.ts"),
            &patterns,
            &extensions
        ));
    }

    #[tokio::test]
    async fn test_watcher_creation_and_cleanup() {
        let temp_dir = setup_temp_project();
        let watcher = FileWatcher::default();
        let result = watcher.watch_directory(temp_dir.path()).await;

        // Should successfully create watcher
        assert!(result.is_ok());

        // Drop the handle - should clean up gracefully
        drop(result.unwrap());
    }

    #[test]
    fn test_error_on_missing_path() {
        let fake_path = Path::new("/nonexistent/path");
        let watcher = FileWatcher::default();
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(watcher.watch_directory(fake_path));

        assert!(result.is_err());
    }
}
